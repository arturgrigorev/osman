/**
 * Path - Abstract vector path base class
 *
 * Base class for all vector shapes (polylines, polygons, circles).
 * Provides common functionality for styling, interaction, and rendering.
 *
 * @abstract
 */

import { Layer } from '../layer/layer.js';
import { merge_options, DEFAULT_STYLES } from '../core/options.js';
import { Bounds } from '../geo/bounds.js';
import { LatLng } from '../geo/lat_lng.js';

/**
 * Default path options.
 */
const DEFAULT_OPTIONS = {
    stroke: '#3388ff',
    stroke_width: 3,
    stroke_opacity: 1,
    stroke_linecap: 'round',
    stroke_linejoin: 'round',
    stroke_dasharray: null,
    fill: null,
    fill_opacity: 0.2,
    interactive: true,
    class_name: ''
};

/**
 * Abstract Path base class.
 */
export class Path extends Layer {
    /**
     * Create a new Path.
     *
     * @param {Object} [options] - Path options
     */
    constructor(options = {}) {
        super(merge_options(DEFAULT_OPTIONS, options));

        this._bounds = null;
        this._pixel_bounds = null;
        this._selected = false;
        this._highlighted = false;
    }

    // ==================== Style ====================

    /**
     * Get path style.
     *
     * @returns {Object} Style object
     */
    get_style() {
        return {
            stroke: this._options.stroke,
            stroke_width: this._options.stroke_width,
            stroke_opacity: this._options.stroke_opacity,
            stroke_linecap: this._options.stroke_linecap,
            stroke_linejoin: this._options.stroke_linejoin,
            stroke_dasharray: this._options.stroke_dasharray,
            fill: this._options.fill,
            fill_opacity: this._options.fill_opacity,
            opacity: this._opacity
        };
    }

    /**
     * Set path style.
     *
     * @param {Object} style - Style properties to set
     * @returns {this} Returns this for chaining
     */
    set_style(style) {
        Object.assign(this._options, style);
        this.redraw();
        return this;
    }

    /**
     * Apply highlight style.
     *
     * @returns {this} Returns this for chaining
     */
    highlight() {
        if (!this._highlighted) {
            this._highlighted = true;
            this.redraw();
            this.emit('path:highlight');
        }
        return this;
    }

    /**
     * Remove highlight style.
     *
     * @returns {this} Returns this for chaining
     */
    unhighlight() {
        if (this._highlighted) {
            this._highlighted = false;
            this.redraw();
            this.emit('path:unhighlight');
        }
        return this;
    }

    /**
     * Check if path is highlighted.
     *
     * @returns {boolean} True if highlighted
     */
    is_highlighted() {
        return this._highlighted;
    }

    /**
     * Select the path.
     *
     * @returns {this} Returns this for chaining
     */
    select() {
        if (!this._selected) {
            this._selected = true;
            this.redraw();
            this.emit('path:select');
        }
        return this;
    }

    /**
     * Deselect the path.
     *
     * @returns {this} Returns this for chaining
     */
    deselect() {
        if (this._selected) {
            this._selected = false;
            this.redraw();
            this.emit('path:deselect');
        }
        return this;
    }

    /**
     * Check if path is selected.
     *
     * @returns {boolean} True if selected
     */
    is_selected() {
        return this._selected;
    }

    // ==================== Rendering ====================

    /**
     * Get effective style for rendering.
     *
     * @returns {Object} Style with highlight/selection applied
     * @protected
     */
    _get_render_style() {
        const base = this.get_style();

        if (this._selected) {
            return {
                ...base,
                stroke: DEFAULT_STYLES.selection.stroke,
                stroke_width: base.stroke_width + 2,
                stroke_dasharray: DEFAULT_STYLES.selection.stroke_dasharray
            };
        }

        if (this._highlighted) {
            return {
                ...base,
                stroke: DEFAULT_STYLES.highlight.stroke,
                stroke_width: base.stroke_width + 1
            };
        }

        return base;
    }

    /**
     * Update pixel coordinates from geographic coordinates.
     * Override in subclass.
     *
     * @param {Transform} transform - Current transform
     * @protected
     */
    _update_pixels(transform) {
        // Override in subclass
    }

    /**
     * Update the path.
     *
     * @param {Transform} transform - Current transform
     */
    update(transform) {
        this._update_pixels(transform);
    }

    // ==================== Bounds ====================

    /**
     * Get geographic bounds.
     * Override in subclass.
     *
     * @returns {Bounds|null} Geographic bounds
     */
    get_bounds() {
        return this._bounds;
    }

    /**
     * Recompute bounds from coordinates.
     * Override in subclass.
     *
     * @protected
     */
    _compute_bounds() {
        // Override in subclass
    }

    // ==================== Hit Testing ====================

    /**
     * Check if a pixel point is within the path.
     * Override in subclass.
     *
     * @param {Point} point - Pixel point
     * @param {number} [tolerance=5] - Hit tolerance in pixels
     * @returns {boolean} True if point hits the path
     */
    contains_point(point, tolerance = 5) {
        return false; // Override in subclass
    }

    // ==================== Lifecycle ====================

    /**
     * Called when path is added to a map.
     *
     * @param {Osman} map - The map instance
     */
    on_add(map) {
        super.on_add(map);

        // Register for click events
        if (this._options.interactive) {
            this._setup_interaction();
        }
    }

    /**
     * Set up interaction handlers.
     * @private
     */
    _setup_interaction() {
        if (!this._map) return;

        this._click_handler = (e) => {
            if (!this._visible || !this._options.interactive) return;

            const pixel = e.point;
            if (this.contains_point(pixel)) {
                this.emit('path:click', { latlng: e.latlng, path: this });
                e.propagation_stopped = true;
            }
        };

        this._map.on('map:click', this._click_handler);
    }

    /**
     * Called when path is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        if (this._click_handler) {
            map.off('map:click', this._click_handler);
            this._click_handler = null;
        }

        super.on_remove(map);
    }
}
