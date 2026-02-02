/**
 * Options - Options merging and builder pattern utilities
 *
 * Provides consistent options handling across all Osman components.
 */

import { deep_merge, is_object, deep_clone } from './utils.js';

/**
 * Merge user options with defaults.
 *
 * @param {Object} defaults - Default options
 * @param {Object} [options] - User-provided options
 * @returns {Object} Merged options
 * @example
 * const merged = merge_options(
 *     { stroke: '#000', fill: 'transparent' },
 *     { fill: '#ff0000' }
 * );
 * // { stroke: '#000', fill: '#ff0000' }
 */
export function merge_options(defaults, options = {}) {
    return deep_merge(defaults, options);
}

/**
 * StyleBuilder - Builder pattern for creating style objects
 *
 * Creates immutable style objects through a fluent API.
 *
 * @example
 * const style = new StyleBuilder()
 *     .stroke('#333')
 *     .stroke_width(2)
 *     .fill('#ff0000')
 *     .opacity(0.5)
 *     .build();
 */
export class StyleBuilder {
    constructor() {
        this._style = {
            stroke: null,
            stroke_width: 1,
            stroke_opacity: 1,
            stroke_dasharray: null,
            stroke_linecap: 'round',
            stroke_linejoin: 'round',
            fill: null,
            fill_opacity: 1,
            opacity: 1
        };
    }

    /**
     * Set stroke color.
     *
     * @param {string} color - Stroke color (CSS color value)
     * @returns {this} Returns this for chaining
     */
    stroke(color) {
        this._style.stroke = color;
        return this;
    }

    /**
     * Set stroke width.
     *
     * @param {number} width - Stroke width in pixels
     * @returns {this} Returns this for chaining
     */
    stroke_width(width) {
        this._style.stroke_width = width;
        return this;
    }

    /**
     * Set stroke opacity.
     *
     * @param {number} opacity - Stroke opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    stroke_opacity(opacity) {
        this._style.stroke_opacity = opacity;
        return this;
    }

    /**
     * Set stroke dash pattern.
     *
     * @param {string|Array<number>} pattern - Dash pattern (e.g., '5,3' or [5, 3])
     * @returns {this} Returns this for chaining
     */
    stroke_dasharray(pattern) {
        this._style.stroke_dasharray = Array.isArray(pattern) ? pattern.join(',') : pattern;
        return this;
    }

    /**
     * Set stroke line cap.
     *
     * @param {'butt'|'round'|'square'} cap - Line cap style
     * @returns {this} Returns this for chaining
     */
    stroke_linecap(cap) {
        this._style.stroke_linecap = cap;
        return this;
    }

    /**
     * Set stroke line join.
     *
     * @param {'miter'|'round'|'bevel'} join - Line join style
     * @returns {this} Returns this for chaining
     */
    stroke_linejoin(join) {
        this._style.stroke_linejoin = join;
        return this;
    }

    /**
     * Set fill color.
     *
     * @param {string} color - Fill color (CSS color value)
     * @returns {this} Returns this for chaining
     */
    fill(color) {
        this._style.fill = color;
        return this;
    }

    /**
     * Set fill opacity.
     *
     * @param {number} opacity - Fill opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    fill_opacity(opacity) {
        this._style.fill_opacity = opacity;
        return this;
    }

    /**
     * Set overall opacity (affects both stroke and fill).
     *
     * @param {number} opacity - Overall opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    opacity(opacity) {
        this._style.opacity = opacity;
        return this;
    }

    /**
     * Create a dashed stroke.
     *
     * @param {number} [dash=5] - Dash length
     * @param {number} [gap=3] - Gap length
     * @returns {this} Returns this for chaining
     */
    dashed(dash = 5, gap = 3) {
        this._style.stroke_dasharray = `${dash},${gap}`;
        return this;
    }

    /**
     * Create a dotted stroke.
     *
     * @param {number} [size=2] - Dot size
     * @param {number} [gap=4] - Gap between dots
     * @returns {this} Returns this for chaining
     */
    dotted(size = 2, gap = 4) {
        this._style.stroke_dasharray = `${size},${gap}`;
        this._style.stroke_linecap = 'round';
        return this;
    }

    /**
     * Build the immutable style object.
     *
     * @returns {Object} Immutable style object
     */
    build() {
        const style = deep_clone(this._style);
        return Object.freeze(style);
    }

    /**
     * Create a StyleBuilder from an existing style object.
     *
     * @param {Object} style - Style object to copy
     * @returns {StyleBuilder} New StyleBuilder instance
     */
    static from(style) {
        const builder = new StyleBuilder();
        if (is_object(style)) {
            Object.assign(builder._style, style);
        }
        return builder;
    }
}

/**
 * Default styles for various element types.
 */
export const DEFAULT_STYLES = Object.freeze({
    polygon: Object.freeze({
        stroke: '#3388ff',
        stroke_width: 2,
        stroke_opacity: 1,
        fill: '#3388ff',
        fill_opacity: 0.2,
        opacity: 1
    }),

    polyline: Object.freeze({
        stroke: '#3388ff',
        stroke_width: 3,
        stroke_opacity: 1,
        stroke_linecap: 'round',
        stroke_linejoin: 'round',
        fill: null,
        opacity: 1
    }),

    circle: Object.freeze({
        stroke: '#3388ff',
        stroke_width: 2,
        stroke_opacity: 1,
        fill: '#3388ff',
        fill_opacity: 0.2,
        opacity: 1
    }),

    marker: Object.freeze({
        color: '#3388ff',
        size: 24,
        opacity: 1
    }),

    highlight: Object.freeze({
        stroke: '#ff7800',
        stroke_width: 4,
        stroke_opacity: 1,
        fill: '#ff7800',
        fill_opacity: 0.3,
        opacity: 1
    }),

    selection: Object.freeze({
        stroke: '#00ff00',
        stroke_width: 3,
        stroke_opacity: 1,
        stroke_dasharray: '5,5',
        fill: '#00ff00',
        fill_opacity: 0.1,
        opacity: 1
    })
});

/**
 * Validate that required options are present.
 *
 * @param {Object} options - Options object to validate
 * @param {Array<string>} required - Array of required option names
 * @throws {Error} If a required option is missing
 */
export function validate_options(options, required) {
    for (const key of required) {
        if (options[key] === undefined || options[key] === null) {
            throw new Error(`Required option '${key}' is missing`);
        }
    }
}

/**
 * Create an options object with validation.
 *
 * @param {Object} defaults - Default options
 * @param {Object} options - User options
 * @param {Array<string>} [required=[]] - Required option names
 * @returns {Object} Validated and merged options
 */
export function create_options(defaults, options, required = []) {
    const merged = merge_options(defaults, options);
    validate_options(merged, required);
    return merged;
}
