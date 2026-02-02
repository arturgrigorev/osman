/**
 * Player - Presentation playback engine
 *
 * Plays back recorded presentations with animated transitions
 * between keyframes, annotations, and layer visibility changes.
 *
 * @example
 * const player = new Player();
 * player.add_to(map);
 * player.load(presentation_data);
 *
 * player.on('player:keyframe', (e) => {
 *     console.log('Now showing:', e.keyframe.annotation);
 * });
 *
 * player.play();
 */

import { EventEmitter } from '../core/event_emitter.js';
import { LatLng } from '../geo/lat_lng.js';
import { Easing } from './recorder.js';

/**
 * Player state constants.
 */
export const PlayerState = {
    STOPPED: 'stopped',
    PLAYING: 'playing',
    PAUSED: 'paused'
};

/**
 * Default player options.
 */
const DEFAULT_OPTIONS = {
    loop: false,
    autoplay: false,
    show_annotations: true,
    annotation_position: 'bottom_left',
    playback_rate: 1.0
};

/**
 * Player class for presentation playback.
 */
export class Player extends EventEmitter {
    /**
     * Create a new Player.
     *
     * @param {Object} [options] - Player options
     */
    constructor(options = {}) {
        super();

        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._map = null;
        this._presentation = null;
        this._keyframes = [];
        this._current_index = -1;
        this._state = PlayerState.STOPPED;
        this._timer = null;
        this._transition_start = null;
        this._transition_frame = null;
        this._annotation_element = null;
    }

    /**
     * Add player to map.
     *
     * @param {Osman} map - Map instance
     * @returns {this} Returns this for chaining
     */
    add_to(map) {
        this._map = map;
        this._create_annotation_element();
        return this;
    }

    /**
     * Remove player from map.
     *
     * @returns {this} Returns this for chaining
     */
    remove() {
        this.stop();
        this._remove_annotation_element();
        this._map = null;
        return this;
    }

    /**
     * Load presentation data.
     *
     * @param {Object|string} data - Presentation data or JSON string
     * @returns {this} Returns this for chaining
     */
    load(data) {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        this._presentation = data;
        this._keyframes = data.keyframes || [];
        this._current_index = -1;
        this._state = PlayerState.STOPPED;

        this.emit('player:load', {
            metadata: data.metadata,
            keyframe_count: this._keyframes.length
        });

        if (this._options.autoplay && this._keyframes.length > 0) {
            this.play();
        }

        return this;
    }

    /**
     * Play the presentation.
     *
     * @returns {this} Returns this for chaining
     */
    play() {
        if (!this._keyframes.length) return this;

        if (this._state === PlayerState.STOPPED) {
            this._current_index = -1;
        }

        this._state = PlayerState.PLAYING;
        this.emit('player:play');

        this._next_keyframe();
        return this;
    }

    /**
     * Pause playback.
     *
     * @returns {this} Returns this for chaining
     */
    pause() {
        if (this._state !== PlayerState.PLAYING) return this;

        this._state = PlayerState.PAUSED;
        this._clear_timer();

        this.emit('player:pause');
        return this;
    }

    /**
     * Resume playback.
     *
     * @returns {this} Returns this for chaining
     */
    resume() {
        if (this._state !== PlayerState.PAUSED) return this;

        this._state = PlayerState.PLAYING;
        this.emit('player:resume');

        // Continue from current position
        const keyframe = this._keyframes[this._current_index];
        if (keyframe) {
            this._schedule_next(keyframe.duration);
        }

        return this;
    }

    /**
     * Stop playback.
     *
     * @returns {this} Returns this for chaining
     */
    stop() {
        this._state = PlayerState.STOPPED;
        this._current_index = -1;
        this._clear_timer();
        this._cancel_transition();
        this._hide_annotation();

        this.emit('player:stop');
        return this;
    }

    /**
     * Go to a specific keyframe.
     *
     * @param {number} index - Keyframe index
     * @param {boolean} [animate=true] - Animate transition
     * @returns {this} Returns this for chaining
     */
    go_to(index, animate = true) {
        if (index < 0 || index >= this._keyframes.length) return this;

        this._clear_timer();
        this._current_index = index;

        const keyframe = this._keyframes[index];
        this._apply_keyframe(keyframe, animate);

        if (this._state === PlayerState.PLAYING) {
            this._schedule_next(keyframe.duration);
        }

        return this;
    }

    /**
     * Go to next keyframe.
     *
     * @returns {this} Returns this for chaining
     */
    next() {
        if (this._current_index < this._keyframes.length - 1) {
            this.go_to(this._current_index + 1);
        } else if (this._options.loop) {
            this.go_to(0);
        }
        return this;
    }

    /**
     * Go to previous keyframe.
     *
     * @returns {this} Returns this for chaining
     */
    previous() {
        if (this._current_index > 0) {
            this.go_to(this._current_index - 1);
        }
        return this;
    }

    /**
     * Get current state.
     *
     * @returns {string} Player state
     */
    get_state() {
        return this._state;
    }

    /**
     * Get current keyframe index.
     *
     * @returns {number} Current index (-1 if not started)
     */
    get_current_index() {
        return this._current_index;
    }

    /**
     * Get current keyframe.
     *
     * @returns {Object|null} Current keyframe or null
     */
    get_current_keyframe() {
        return this._keyframes[this._current_index] || null;
    }

    /**
     * Get total keyframe count.
     *
     * @returns {number} Keyframe count
     */
    get_keyframe_count() {
        return this._keyframes.length;
    }

    /**
     * Get total duration in milliseconds.
     *
     * @returns {number} Total duration
     */
    get_duration() {
        return this._presentation?.metadata?.duration || 0;
    }

    /**
     * Get current progress (0-1).
     *
     * @returns {number} Progress
     */
    get_progress() {
        if (this._keyframes.length === 0) return 0;
        return (this._current_index + 1) / this._keyframes.length;
    }

    /**
     * Set playback rate.
     *
     * @param {number} rate - Playback rate (0.5 = half speed, 2 = double speed)
     * @returns {this} Returns this for chaining
     */
    set_playback_rate(rate) {
        this._options.playback_rate = Math.max(0.1, Math.min(10, rate));
        return this;
    }

    /**
     * Get playback rate.
     *
     * @returns {number} Playback rate
     */
    get_playback_rate() {
        return this._options.playback_rate;
    }

    /**
     * Set loop mode.
     *
     * @param {boolean} loop - Enable loop
     * @returns {this} Returns this for chaining
     */
    set_loop(loop) {
        this._options.loop = loop;
        return this;
    }

    /**
     * Move to next keyframe.
     * @private
     */
    _next_keyframe() {
        if (this._state !== PlayerState.PLAYING) return;

        this._current_index++;

        if (this._current_index >= this._keyframes.length) {
            if (this._options.loop) {
                this._current_index = 0;
            } else {
                this._state = PlayerState.STOPPED;
                this.emit('player:complete');
                return;
            }
        }

        const keyframe = this._keyframes[this._current_index];
        this._apply_keyframe(keyframe, true);
        this._schedule_next(keyframe.duration + keyframe.transition);
    }

    /**
     * Apply a keyframe to the map.
     * @private
     */
    _apply_keyframe(keyframe, animate) {
        if (!this._map || !keyframe) return;

        const state = keyframe.state;
        const transition = animate ? keyframe.transition / this._options.playback_rate : 0;

        // Apply view change
        if (state?.view) {
            const center = state.view.center instanceof LatLng
                ? state.view.center
                : new LatLng(state.view.center.lat || state.view.center[0],
                             state.view.center.lng || state.view.center[1]);

            if (animate && transition > 0) {
                this._animate_view(center, state.view.zoom, transition, keyframe.easing);
            } else {
                this._map.set_view(center, state.view.zoom);
            }
        }

        // Apply layer visibility
        if (state?.layers) {
            for (const layer_state of state.layers) {
                // Would apply layer visibility changes
            }
        }

        // Apply actions
        if (keyframe.actions) {
            for (const action of keyframe.actions) {
                this._apply_action(action);
            }
        }

        // Show annotation
        if (keyframe.annotation && this._options.show_annotations) {
            this._show_annotation(keyframe.annotation);
        } else {
            this._hide_annotation();
        }

        this.emit('player:keyframe', {
            index: this._current_index,
            keyframe,
            progress: this.get_progress()
        });
    }

    /**
     * Animate view change.
     * @private
     */
    _animate_view(center, zoom, duration, easing) {
        const start_center = this._map.get_center();
        const start_zoom = this._map.get_zoom();
        const start_time = performance.now();

        this._cancel_transition();

        const animate = (current_time) => {
            const elapsed = current_time - start_time;
            let t = Math.min(1, elapsed / duration);

            // Apply easing
            t = this._apply_easing(t, easing);

            // Interpolate
            const lat = start_center.lat + (center.lat - start_center.lat) * t;
            const lng = start_center.lng + (center.lng - start_center.lng) * t;
            const z = start_zoom + (zoom - start_zoom) * t;

            this._map.set_view(new LatLng(lat, lng), z, { animate: false });

            if (elapsed < duration) {
                this._transition_frame = requestAnimationFrame(animate);
            }
        };

        this._transition_frame = requestAnimationFrame(animate);
    }

    /**
     * Apply easing function.
     * @private
     */
    _apply_easing(t, easing) {
        switch (easing) {
            case Easing.EASE_IN:
                return t * t;
            case Easing.EASE_OUT:
                return t * (2 - t);
            case Easing.EASE_IN_OUT:
                return t < 0.5
                    ? 2 * t * t
                    : -1 + (4 - 2 * t) * t;
            case Easing.LINEAR:
            default:
                return t;
        }
    }

    /**
     * Apply an action.
     * @private
     */
    _apply_action(action) {
        // Would apply layer visibility and other actions
    }

    /**
     * Schedule next keyframe.
     * @private
     */
    _schedule_next(delay) {
        this._clear_timer();

        const adjusted_delay = delay / this._options.playback_rate;

        this._timer = setTimeout(() => {
            this._next_keyframe();
        }, adjusted_delay);
    }

    /**
     * Clear timer.
     * @private
     */
    _clear_timer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    /**
     * Cancel transition animation.
     * @private
     */
    _cancel_transition() {
        if (this._transition_frame) {
            cancelAnimationFrame(this._transition_frame);
            this._transition_frame = null;
        }
    }

    /**
     * Create annotation display element.
     * @private
     */
    _create_annotation_element() {
        if (!this._map || this._annotation_element) return;

        this._annotation_element = document.createElement('div');
        this._annotation_element.className = 'urban-player-annotation';
        this._annotation_element.style.cssText = `
            position: absolute;
            ${this._get_position_css()}
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            max-width: 400px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;

        this._map.get_container().appendChild(this._annotation_element);
    }

    /**
     * Get CSS for annotation position.
     * @private
     */
    _get_position_css() {
        const positions = {
            'top_left': 'top: 20px; left: 20px;',
            'top_right': 'top: 20px; right: 20px;',
            'bottom_left': 'bottom: 20px; left: 20px;',
            'bottom_right': 'bottom: 20px; right: 20px;',
            'top_center': 'top: 20px; left: 50%; transform: translateX(-50%);',
            'bottom_center': 'bottom: 20px; left: 50%; transform: translateX(-50%);'
        };

        return positions[this._options.annotation_position] || positions['bottom_left'];
    }

    /**
     * Remove annotation element.
     * @private
     */
    _remove_annotation_element() {
        if (this._annotation_element && this._annotation_element.parentNode) {
            this._annotation_element.parentNode.removeChild(this._annotation_element);
        }
        this._annotation_element = null;
    }

    /**
     * Show annotation.
     * @private
     */
    _show_annotation(text) {
        if (!this._annotation_element) return;

        this._annotation_element.textContent = text;
        this._annotation_element.style.opacity = '1';
    }

    /**
     * Hide annotation.
     * @private
     */
    _hide_annotation() {
        if (!this._annotation_element) return;

        this._annotation_element.style.opacity = '0';
    }
}
