/**
 * SymbolMarker - Marker using text symbols
 *
 * Displays a marker using UTF-8 characters or icon fonts.
 *
 * @example
 * const marker = new SymbolMarker([40.7128, -74.0060], {
 *     symbol: '\u2605', // Star
 *     color: '#ff0000',
 *     size: 24
 * });
 * marker.add_to(map);
 *
 * // Using factory method
 * const hospital = SymbolMarker.hospital([40.71, -74.00]);
 */

import { Marker } from './marker.js';
import { merge_options } from '../core/options.js';

/**
 * Default symbol marker options.
 */
const DEFAULT_OPTIONS = {
    symbol: '\u2022', // Bullet
    color: '#3388ff',
    size: 24,
    font_family: 'sans-serif',
    font_weight: 'normal',
    background: null,
    background_radius: 0,
    border: null,
    border_width: 0,
    anchor_x: 0.5,
    anchor_y: 0.5
};

/**
 * Preset symbols.
 */
const SYMBOL_PRESETS = {
    pin: '\u{1F4CD}',         // Pushpin
    star: '\u2605',           // Star
    circle: '\u25CF',         // Circle
    square: '\u25A0',         // Square
    diamond: '\u25C6',        // Diamond
    triangle: '\u25B2',       // Triangle
    heart: '\u2665',          // Heart
    check: '\u2713',          // Checkmark
    cross: '\u2717',          // Cross
    plus: '\u2795',           // Plus
    minus: '\u2796',          // Minus
    hospital: '\u{1F3E5}',    // Hospital
    school: '\u{1F3EB}',      // School
    home: '\u{1F3E0}',        // Home
    building: '\u{1F3E2}',    // Building
    bus: '\u{1F68C}',         // Bus
    train: '\u{1F689}',       // Train
    parking: '\u{1F17F}',     // Parking
    restaurant: '\u{1F374}',  // Restaurant
    coffee: '\u2615',         // Coffee
    shopping: '\u{1F6D2}',    // Shopping cart
    tree: '\u{1F333}',        // Tree
    park: '\u{1F3DE}',        // Park
    water: '\u{1F30A}',       // Water
    warning: '\u26A0',        // Warning
    info: '\u2139'            // Info
};

/**
 * SymbolMarker class for text-based markers.
 */
export class SymbolMarker extends Marker {
    /**
     * Create a new SymbolMarker.
     *
     * @param {LatLng|Array} latlng - Marker position
     * @param {Object} [options] - Symbol marker options
     */
    constructor(latlng, options = {}) {
        super(latlng, merge_options(DEFAULT_OPTIONS, options));
    }

    /**
     * Create the marker DOM element.
     *
     * @returns {HTMLElement} Marker element
     * @protected
     */
    _create_element() {
        const el = document.createElement('div');
        el.className = 'um-marker um-symbol-marker';

        if (this._options.title) {
            el.title = this._options.title;
        }

        this._update_symbol_element(el);
        el.style.opacity = this._opacity;

        return el;
    }

    /**
     * Update symbol element styling.
     *
     * @param {HTMLElement} el - Element to update
     * @private
     */
    _update_symbol_element(el) {
        const opts = this._options;

        el.textContent = opts.symbol;
        el.style.color = opts.color;
        el.style.fontSize = `${opts.size}px`;
        el.style.fontFamily = opts.font_family;
        el.style.fontWeight = opts.font_weight;
        el.style.lineHeight = '1';
        el.style.textAlign = 'center';
        el.style.width = `${opts.size}px`;
        el.style.height = `${opts.size}px`;

        if (opts.background) {
            el.style.backgroundColor = opts.background;
            el.style.borderRadius = `${opts.background_radius}px`;
            el.style.padding = '4px';
        }

        if (opts.border) {
            el.style.border = `${opts.border_width}px solid ${opts.border}`;
        }
    }

    /**
     * Update marker position on screen.
     * @private
     */
    _update_position() {
        if (!this._map || !this._element || !this._latlng) return;

        const pos = this._map.latlng_to_pixel(this._latlng);
        const size = this._options.size;

        // Use anchor points
        const offset_x = size * this._options.anchor_x;
        const offset_y = size * this._options.anchor_y;

        this._element.style.left = `${pos.x - offset_x}px`;
        this._element.style.top = `${pos.y - offset_y}px`;
    }

    // ==================== Symbol Configuration ====================

    /**
     * Get symbol.
     *
     * @returns {string} Symbol character
     */
    get_symbol() {
        return this._options.symbol;
    }

    /**
     * Set symbol.
     *
     * @param {string} symbol - Symbol character
     * @returns {this} Returns this for chaining
     */
    set_symbol(symbol) {
        this._options.symbol = symbol;
        if (this._element) {
            this._element.textContent = symbol;
        }
        return this;
    }

    /**
     * Get color.
     *
     * @returns {string} Color
     */
    get_color() {
        return this._options.color;
    }

    /**
     * Set color.
     *
     * @param {string} color - New color
     * @returns {this} Returns this for chaining
     */
    set_color(color) {
        this._options.color = color;
        if (this._element) {
            this._element.style.color = color;
        }
        return this;
    }

    /**
     * Get size.
     *
     * @returns {number} Size in pixels
     */
    get_size() {
        return this._options.size;
    }

    /**
     * Set size.
     *
     * @param {number} size - New size in pixels
     * @returns {this} Returns this for chaining
     */
    set_size(size) {
        this._options.size = size;
        if (this._element) {
            this._element.style.fontSize = `${size}px`;
            this._element.style.width = `${size}px`;
            this._element.style.height = `${size}px`;
            this._update_position();
        }
        return this;
    }

    // ==================== Factory Methods ====================

    /**
     * Create marker with preset symbol.
     *
     * @param {string} preset - Preset name
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Additional options
     * @returns {SymbolMarker} New marker
     */
    static preset(preset, latlng, options = {}) {
        const symbol = SYMBOL_PRESETS[preset] || preset;
        return new SymbolMarker(latlng, { symbol, ...options });
    }

    /**
     * Create pin marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static pin(latlng, options = {}) {
        return SymbolMarker.preset('pin', latlng, { color: '#e74c3c', ...options });
    }

    /**
     * Create star marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static star(latlng, options = {}) {
        return SymbolMarker.preset('star', latlng, { color: '#f1c40f', ...options });
    }

    /**
     * Create circle marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static circle(latlng, options = {}) {
        return SymbolMarker.preset('circle', latlng, options);
    }

    /**
     * Create hospital marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static hospital(latlng, options = {}) {
        return SymbolMarker.preset('hospital', latlng, { size: 28, ...options });
    }

    /**
     * Create school marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static school(latlng, options = {}) {
        return SymbolMarker.preset('school', latlng, { size: 28, ...options });
    }

    /**
     * Create transit marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static transit(latlng, options = {}) {
        return SymbolMarker.preset('bus', latlng, { size: 24, ...options });
    }

    /**
     * Create parking marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static parking(latlng, options = {}) {
        return SymbolMarker.preset('parking', latlng, { color: '#3498db', size: 24, ...options });
    }

    /**
     * Create warning marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static warning(latlng, options = {}) {
        return SymbolMarker.preset('warning', latlng, { color: '#f39c12', size: 28, ...options });
    }

    /**
     * Create info marker.
     *
     * @param {LatLng|Array} latlng - Position
     * @param {Object} [options] - Options
     * @returns {SymbolMarker} New marker
     */
    static info(latlng, options = {}) {
        return SymbolMarker.preset('info', latlng, {
            color: '#fff',
            background: '#3498db',
            background_radius: 50,
            size: 20,
            ...options
        });
    }

    /**
     * Get all available preset names.
     *
     * @returns {Array<string>} Preset names
     */
    static get_presets() {
        return Object.keys(SYMBOL_PRESETS);
    }

    /**
     * Get preset symbol character.
     *
     * @param {string} name - Preset name
     * @returns {string|null} Symbol character or null
     */
    static get_preset_symbol(name) {
        return SYMBOL_PRESETS[name] || null;
    }
}
