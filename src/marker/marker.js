/**
 * Marker - Base marker class
 *
 * Represents a marker at a geographic location. Markers can be
 * customized with icons or symbols.
 *
 * @example
 * const marker = new Marker([40.7128, -74.0060]);
 * marker.add_to(map);
 */

import { Layer } from '../layer/layer.js';
import { LatLng } from '../geo/lat_lng.js';
import { merge_options } from '../core/options.js';

/**
 * Default marker options.
 */
const DEFAULT_OPTIONS = {
    draggable: false,
    keyboard: true,
    title: '',
    alt: 'Marker',
    opacity: 1,
    rise_on_hover: false,
    rise_offset: 250,
    interactive: true
};

/**
 * Marker base class.
 */
export class Marker extends Layer {
    /**
     * Create a new Marker.
     *
     * @param {LatLng|Array} latlng - Marker position
     * @param {Object} [options] - Marker options
     */
    constructor(latlng, options = {}) {
        super(merge_options(DEFAULT_OPTIONS, options));

        this._latlng = null;
        this._element = null;
        this._dragging = false;

        this.set_latlng(latlng);
    }

    // ==================== Position ====================

    /**
     * Get marker position.
     *
     * @returns {LatLng} Position
     */
    get_latlng() {
        return this._latlng;
    }

    /**
     * Set marker position.
     *
     * @param {LatLng|Array} latlng - New position
     * @returns {this} Returns this for chaining
     */
    set_latlng(latlng) {
        const ll = LatLng.from(latlng);
        if (ll) {
            const old = this._latlng;
            this._latlng = ll;
            this._update_position();

            if (old && !old.equals(ll)) {
                this.emit('marker:move', { old_latlng: old, latlng: ll });
            }
        }
        return this;
    }

    // ==================== Lifecycle ====================

    /**
     * Called when marker is added to a map.
     *
     * @param {Osman} map - The map instance
     */
    on_add(map) {
        super.on_add(map);

        // Create marker element
        this._element = this._create_element();

        // Add to marker pane
        const pane = map.get_pane('marker');
        if (pane) {
            pane.appendChild(this._element);
        }

        // Setup events
        this._setup_events();

        // Position marker
        this._update_position();
    }

    /**
     * Called when marker is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._element = null;

        super.on_remove(map);
    }

    /**
     * Create the marker DOM element.
     * Override in subclass for custom markers.
     *
     * @returns {HTMLElement} Marker element
     * @protected
     */
    _create_element() {
        const el = document.createElement('div');
        el.className = 'um-marker';

        if (this._options.title) {
            el.title = this._options.title;
        }

        // Default marker appearance (simple circle)
        el.innerHTML = `
            <svg width="24" height="36" viewBox="0 0 24 36">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
                      fill="#3388ff" stroke="#fff" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="#fff"/>
            </svg>
        `;

        el.style.opacity = this._opacity;

        return el;
    }

    /**
     * Setup event handlers.
     * @private
     */
    _setup_events() {
        if (!this._element || !this._options.interactive) return;

        this._element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.emit('marker:click', { latlng: this._latlng, original_event: e });
        });

        this._element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.emit('marker:dblclick', { latlng: this._latlng, original_event: e });
        });

        this._element.addEventListener('mouseenter', () => {
            this.emit('marker:mouseover', { latlng: this._latlng });
            if (this._options.rise_on_hover) {
                this._element.style.zIndex = this._options.rise_offset;
            }
        });

        this._element.addEventListener('mouseleave', () => {
            this.emit('marker:mouseout', { latlng: this._latlng });
            if (this._options.rise_on_hover) {
                this._element.style.zIndex = '';
            }
        });

        // Dragging
        if (this._options.draggable) {
            this._setup_drag();
        }
    }

    /**
     * Setup drag handling.
     * @private
     */
    _setup_drag() {
        if (!this._element) return;

        this._element.style.cursor = 'move';

        let start_pos = null;
        let start_latlng = null;

        const on_move = (e) => {
            if (!this._dragging) return;

            const rect = this._map.get_container().getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;

            const latlng = this._map.pixel_to_latlng({ x, y });
            this.set_latlng(latlng);

            this.emit('marker:drag', { latlng });
        };

        const on_end = () => {
            if (!this._dragging) return;

            this._dragging = false;
            document.removeEventListener('mousemove', on_move);
            document.removeEventListener('mouseup', on_end);
            document.removeEventListener('touchmove', on_move);
            document.removeEventListener('touchend', on_end);

            this.emit('marker:dragend', { latlng: this._latlng });
        };

        this._element.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            this._dragging = true;
            start_pos = { x: e.clientX, y: e.clientY };
            start_latlng = this._latlng;

            document.addEventListener('mousemove', on_move);
            document.addEventListener('mouseup', on_end);

            this.emit('marker:dragstart', { latlng: this._latlng });
        });

        this._element.addEventListener('touchstart', (e) => {
            e.preventDefault();

            this._dragging = true;
            start_pos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            start_latlng = this._latlng;

            document.addEventListener('touchmove', on_move);
            document.addEventListener('touchend', on_end);

            this.emit('marker:dragstart', { latlng: this._latlng });
        });
    }

    // ==================== Position Update ====================

    /**
     * Update marker position on screen.
     * @private
     */
    _update_position() {
        if (!this._map || !this._element || !this._latlng) return;

        const pos = this._map.latlng_to_pixel(this._latlng);

        // Center marker on position (adjust for default marker size)
        const width = this._element.offsetWidth || 24;
        const height = this._element.offsetHeight || 36;

        this._element.style.left = `${pos.x - width / 2}px`;
        this._element.style.top = `${pos.y - height}px`;
    }

    /**
     * Update marker on view change.
     *
     * @param {Transform} transform - Current transform
     */
    update(transform) {
        this._update_position();
    }

    // ==================== Visibility ====================

    /**
     * Show the marker.
     *
     * @returns {this} Returns this for chaining
     */
    show() {
        super.show();
        if (this._element) {
            this._element.style.display = '';
        }
        return this;
    }

    /**
     * Hide the marker.
     *
     * @returns {this} Returns this for chaining
     */
    hide() {
        super.hide();
        if (this._element) {
            this._element.style.display = 'none';
        }
        return this;
    }

    // ==================== Opacity ====================

    /**
     * Set marker opacity.
     *
     * @param {number} opacity - Opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    set_opacity(opacity) {
        super.set_opacity(opacity);
        if (this._element) {
            this._element.style.opacity = this._opacity;
        }
        return this;
    }

    // ==================== Bounds ====================

    /**
     * Get marker bounds (just the point).
     *
     * @returns {Bounds|null} Point bounds
     */
    get_bounds() {
        if (!this._latlng) return null;

        const { Bounds } = require('../geo/bounds.js');
        return Bounds.from_points([this._latlng]);
    }

    // ==================== Rendering ====================

    /**
     * Markers use DOM, not canvas rendering.
     */
    render(ctx, transform) {
        // No-op: markers are DOM elements
    }

    // ==================== Utilities ====================

    /**
     * Get the marker element.
     *
     * @returns {HTMLElement|null} Marker element
     */
    get_element() {
        return this._element;
    }

    /**
     * Convert to GeoJSON.
     *
     * @returns {Object} GeoJSON Point feature
     */
    to_geojson() {
        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: this._latlng.to_geojson()
            },
            properties: {
                title: this._options.title
            }
        };
    }
}
