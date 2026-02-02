/**
 * Recorder - Map state recorder for presentations
 *
 * Records map state changes (view, layers, markers) as keyframes
 * for creating animated presentations.
 *
 * @example
 * const recorder = new Recorder();
 * recorder.add_to(map);
 *
 * // Record keyframes
 * recorder.record_keyframe({ duration: 2000 });
 * map.fly_to([40.7, -74.0], 14);
 * recorder.record_keyframe({ duration: 3000 });
 *
 * // Export
 * const presentation = recorder.export();
 */

import { EventEmitter } from '../core/event_emitter.js';
import { deep_clone, uid } from '../core/utils.js';

/**
 * Keyframe type constants.
 */
export const KeyframeType = {
    VIEW: 'view',
    LAYER: 'layer',
    MARKER: 'marker',
    STYLE: 'style',
    ANNOTATION: 'annotation'
};

/**
 * Easing function constants.
 */
export const Easing = {
    LINEAR: 'linear',
    EASE_IN: 'ease-in',
    EASE_OUT: 'ease-out',
    EASE_IN_OUT: 'ease-in-out'
};

/**
 * Default recorder options.
 */
const DEFAULT_OPTIONS = {
    auto_record: false,        // Auto-record on view changes
    record_interval: 1000,     // Minimum ms between auto-records
    include_layers: true,      // Include layer visibility
    include_styles: false      // Include style changes
};

/**
 * Recorder class for recording map states.
 */
export class Recorder extends EventEmitter {
    /**
     * Create a new Recorder.
     *
     * @param {Object} [options] - Recorder options
     */
    constructor(options = {}) {
        super();

        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._map = null;
        this._keyframes = [];
        this._recording = false;
        this._last_record_time = 0;
        this._metadata = {
            id: uid(),
            title: 'Untitled Presentation',
            description: '',
            author: '',
            created: null,
            duration: 0
        };
    }

    /**
     * Add recorder to map.
     *
     * @param {Osman} map - Map instance
     * @returns {this} Returns this for chaining
     */
    add_to(map) {
        this._map = map;

        if (this._options.auto_record) {
            this._bind_auto_record();
        }

        return this;
    }

    /**
     * Remove recorder from map.
     *
     * @returns {this} Returns this for chaining
     */
    remove() {
        this._unbind_auto_record();
        this._map = null;
        return this;
    }

    /**
     * Start recording.
     *
     * @returns {this} Returns this for chaining
     */
    start() {
        if (this._recording) return this;

        this._recording = true;
        this._metadata.created = new Date().toISOString();

        // Record initial state
        this.record_keyframe({ duration: 0 });

        this.emit('recorder:start');
        return this;
    }

    /**
     * Stop recording.
     *
     * @returns {this} Returns this for chaining
     */
    stop() {
        if (!this._recording) return this;

        this._recording = false;
        this._update_duration();

        this.emit('recorder:stop');
        return this;
    }

    /**
     * Check if recording.
     *
     * @returns {boolean} True if recording
     */
    is_recording() {
        return this._recording;
    }

    /**
     * Record a keyframe at current map state.
     *
     * @param {Object} [options] - Keyframe options
     * @param {number} [options.duration=2000] - Duration to hold this frame (ms)
     * @param {number} [options.transition=1000] - Transition time to next frame (ms)
     * @param {string} [options.easing='ease-in-out'] - Easing function
     * @param {string} [options.annotation] - Text annotation for this frame
     * @returns {Object} Created keyframe
     */
    record_keyframe(options = {}) {
        if (!this._map) return null;

        const keyframe = {
            id: uid(),
            index: this._keyframes.length,
            timestamp: Date.now(),
            duration: options.duration ?? 2000,
            transition: options.transition ?? 1000,
            easing: options.easing ?? Easing.EASE_IN_OUT,
            annotation: options.annotation || null,
            state: this._capture_state()
        };

        this._keyframes.push(keyframe);
        this._last_record_time = Date.now();
        this._update_duration();

        this.emit('recorder:keyframe', { keyframe });
        return keyframe;
    }

    /**
     * Record a view change keyframe.
     *
     * @param {LatLng|Array} center - Target center
     * @param {number} zoom - Target zoom
     * @param {Object} [options] - Keyframe options
     * @returns {Object} Created keyframe
     */
    record_view(center, zoom, options = {}) {
        return this.record_keyframe({
            ...options,
            state: {
                view: { center, zoom }
            }
        });
    }

    /**
     * Record a layer visibility change.
     *
     * @param {Layer} layer - Layer to toggle
     * @param {boolean} visible - Visibility state
     * @param {Object} [options] - Keyframe options
     * @returns {Object} Created keyframe
     */
    record_layer_toggle(layer, visible, options = {}) {
        const keyframe = this.record_keyframe(options);

        keyframe.actions = keyframe.actions || [];
        keyframe.actions.push({
            type: KeyframeType.LAYER,
            layer_id: layer._id,
            visible
        });

        return keyframe;
    }

    /**
     * Record an annotation.
     *
     * @param {string} text - Annotation text
     * @param {Object} [options] - Display options
     * @returns {Object} Created keyframe
     */
    record_annotation(text, options = {}) {
        return this.record_keyframe({
            ...options,
            annotation: text
        });
    }

    /**
     * Update a keyframe.
     *
     * @param {number|string} id_or_index - Keyframe ID or index
     * @param {Object} updates - Properties to update
     * @returns {Object|null} Updated keyframe or null
     */
    update_keyframe(id_or_index, updates) {
        const keyframe = this._find_keyframe(id_or_index);
        if (!keyframe) return null;

        Object.assign(keyframe, updates);
        this._update_duration();

        this.emit('recorder:update', { keyframe });
        return keyframe;
    }

    /**
     * Delete a keyframe.
     *
     * @param {number|string} id_or_index - Keyframe ID or index
     * @returns {boolean} True if deleted
     */
    delete_keyframe(id_or_index) {
        const index = this._find_keyframe_index(id_or_index);
        if (index === -1) return false;

        const [keyframe] = this._keyframes.splice(index, 1);

        // Re-index remaining keyframes
        for (let i = index; i < this._keyframes.length; i++) {
            this._keyframes[i].index = i;
        }

        this._update_duration();
        this.emit('recorder:delete', { keyframe });
        return true;
    }

    /**
     * Move a keyframe to a new position.
     *
     * @param {number|string} id_or_index - Keyframe ID or index
     * @param {number} new_index - New position index
     * @returns {boolean} True if moved
     */
    move_keyframe(id_or_index, new_index) {
        const index = this._find_keyframe_index(id_or_index);
        if (index === -1) return false;

        const [keyframe] = this._keyframes.splice(index, 1);
        this._keyframes.splice(new_index, 0, keyframe);

        // Re-index
        for (let i = 0; i < this._keyframes.length; i++) {
            this._keyframes[i].index = i;
        }

        return true;
    }

    /**
     * Get all keyframes.
     *
     * @returns {Array} Array of keyframes
     */
    get_keyframes() {
        return [...this._keyframes];
    }

    /**
     * Get keyframe by ID or index.
     *
     * @param {number|string} id_or_index - Keyframe ID or index
     * @returns {Object|null} Keyframe or null
     */
    get_keyframe(id_or_index) {
        return this._find_keyframe(id_or_index);
    }

    /**
     * Get total keyframe count.
     *
     * @returns {number} Keyframe count
     */
    get_count() {
        return this._keyframes.length;
    }

    /**
     * Clear all keyframes.
     *
     * @returns {this} Returns this for chaining
     */
    clear() {
        this._keyframes = [];
        this._metadata.duration = 0;

        this.emit('recorder:clear');
        return this;
    }

    /**
     * Set metadata.
     *
     * @param {Object} metadata - Metadata to set
     * @returns {this} Returns this for chaining
     */
    set_metadata(metadata) {
        Object.assign(this._metadata, metadata);
        return this;
    }

    /**
     * Get metadata.
     *
     * @returns {Object} Metadata
     */
    get_metadata() {
        return { ...this._metadata };
    }

    /**
     * Export presentation data.
     *
     * @returns {Object} Presentation data
     */
    export() {
        return {
            version: '1.0',
            metadata: { ...this._metadata },
            keyframes: deep_clone(this._keyframes)
        };
    }

    /**
     * Export as JSON string.
     *
     * @param {boolean} [pretty=false] - Pretty print
     * @returns {string} JSON string
     */
    export_json(pretty = false) {
        return JSON.stringify(this.export(), null, pretty ? 2 : 0);
    }

    /**
     * Import presentation data.
     *
     * @param {Object|string} data - Presentation data or JSON string
     * @returns {this} Returns this for chaining
     */
    import(data) {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (data.metadata) {
            this._metadata = { ...this._metadata, ...data.metadata };
        }

        if (data.keyframes) {
            this._keyframes = deep_clone(data.keyframes);
        }

        this._update_duration();
        this.emit('recorder:import');
        return this;
    }

    /**
     * Capture current map state.
     * @private
     */
    _capture_state() {
        const state = {
            view: {
                center: this._map.get_center(),
                zoom: this._map.get_zoom()
            }
        };

        if (this._options.include_layers) {
            state.layers = this._capture_layers();
        }

        return state;
    }

    /**
     * Capture layer states.
     * @private
     */
    _capture_layers() {
        const layers = [];

        // Would iterate map layers and capture visibility/opacity
        // Implementation depends on map.get_layers() being available

        return layers;
    }

    /**
     * Find keyframe by ID or index.
     * @private
     */
    _find_keyframe(id_or_index) {
        if (typeof id_or_index === 'number') {
            return this._keyframes[id_or_index] || null;
        }
        return this._keyframes.find(k => k.id === id_or_index) || null;
    }

    /**
     * Find keyframe index.
     * @private
     */
    _find_keyframe_index(id_or_index) {
        if (typeof id_or_index === 'number') {
            return id_or_index >= 0 && id_or_index < this._keyframes.length
                ? id_or_index
                : -1;
        }
        return this._keyframes.findIndex(k => k.id === id_or_index);
    }

    /**
     * Update total duration.
     * @private
     */
    _update_duration() {
        this._metadata.duration = this._keyframes.reduce((total, kf) => {
            return total + kf.duration + kf.transition;
        }, 0);
    }

    /**
     * Bind auto-record events.
     * @private
     */
    _bind_auto_record() {
        this._on_view_change = this._on_view_change.bind(this);
        if (this._map) {
            this._map.on('map:moveend', this._on_view_change);
            this._map.on('map:zoomend', this._on_view_change);
        }
    }

    /**
     * Unbind auto-record events.
     * @private
     */
    _unbind_auto_record() {
        if (this._map) {
            this._map.off('map:moveend', this._on_view_change);
            this._map.off('map:zoomend', this._on_view_change);
        }
    }

    /**
     * Handle view change for auto-record.
     * @private
     */
    _on_view_change() {
        if (!this._recording) return;

        const now = Date.now();
        if (now - this._last_record_time < this._options.record_interval) {
            return;
        }

        this.record_keyframe();
    }
}
