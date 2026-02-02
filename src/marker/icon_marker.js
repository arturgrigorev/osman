/**
 * IconMarker - Marker using custom images
 *
 * Displays a marker using a custom image icon.
 *
 * @example
 * const marker = new IconMarker([40.7128, -74.0060], {
 *     icon_url: '/icons/marker.png',
 *     icon_size: [32, 32],
 *     icon_anchor: [16, 32]
 * });
 * marker.add_to(map);
 */

import { Marker } from './marker.js';
import { merge_options } from '../core/options.js';

/**
 * Default icon marker options.
 */
const DEFAULT_OPTIONS = {
    icon_url: null,
    icon_retina_url: null,
    icon_size: [24, 24],
    icon_anchor: [12, 24],
    popup_anchor: [0, -24],
    shadow_url: null,
    shadow_size: null,
    shadow_anchor: null,
    class_name: ''
};

/**
 * IconMarker class for image-based markers.
 */
export class IconMarker extends Marker {
    /**
     * Create a new IconMarker.
     *
     * @param {LatLng|Array} latlng - Marker position
     * @param {Object} [options] - Icon marker options
     */
    constructor(latlng, options = {}) {
        super(latlng, merge_options(DEFAULT_OPTIONS, options));

        this._icon_loaded = false;
        this._shadow_element = null;
    }

    /**
     * Create the marker DOM element.
     *
     * @returns {HTMLElement} Marker element
     * @protected
     */
    _create_element() {
        const el = document.createElement('div');
        el.className = `um-marker um-icon-marker ${this._options.class_name}`;

        if (this._options.title) {
            el.title = this._options.title;
        }

        // Create icon image
        const icon = document.createElement('img');
        icon.className = 'um-marker-icon';
        icon.alt = this._options.alt || '';

        // Use retina URL if available and on retina display
        const use_retina = this._options.icon_retina_url && window.devicePixelRatio > 1;
        icon.src = use_retina ? this._options.icon_retina_url : this._options.icon_url;

        const [width, height] = this._options.icon_size;
        icon.style.width = `${width}px`;
        icon.style.height = `${height}px`;

        icon.onload = () => {
            this._icon_loaded = true;
            this._update_position();
        };

        el.appendChild(icon);
        el.style.opacity = this._opacity;

        return el;
    }

    /**
     * Called when marker is added to a map.
     *
     * @param {Osman} map - The map instance
     */
    on_add(map) {
        super.on_add(map);

        // Add shadow if specified
        if (this._options.shadow_url) {
            this._create_shadow();
        }
    }

    /**
     * Called when marker is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        if (this._shadow_element && this._shadow_element.parentNode) {
            this._shadow_element.parentNode.removeChild(this._shadow_element);
        }
        this._shadow_element = null;

        super.on_remove(map);
    }

    /**
     * Create shadow element.
     * @private
     */
    _create_shadow() {
        if (!this._map) return;

        const shadow = document.createElement('img');
        shadow.className = 'um-marker-shadow';
        shadow.src = this._options.shadow_url;

        const size = this._options.shadow_size || this._options.icon_size;
        shadow.style.width = `${size[0]}px`;
        shadow.style.height = `${size[1]}px`;
        shadow.style.position = 'absolute';

        const pane = this._map.get_pane('marker');
        if (pane) {
            // Insert shadow before icon so icon appears on top
            pane.insertBefore(shadow, this._element);
        }

        this._shadow_element = shadow;
        this._update_position();
    }

    /**
     * Update marker position on screen.
     * @private
     */
    _update_position() {
        if (!this._map || !this._element || !this._latlng) return;

        const pos = this._map.latlng_to_pixel(this._latlng);
        const [anchor_x, anchor_y] = this._options.icon_anchor;

        this._element.style.left = `${pos.x - anchor_x}px`;
        this._element.style.top = `${pos.y - anchor_y}px`;

        // Update shadow position
        if (this._shadow_element) {
            const shadow_anchor = this._options.shadow_anchor || this._options.icon_anchor;
            this._shadow_element.style.left = `${pos.x - shadow_anchor[0]}px`;
            this._shadow_element.style.top = `${pos.y - shadow_anchor[1]}px`;
        }
    }

    // ==================== Icon Configuration ====================

    /**
     * Get icon URL.
     *
     * @returns {string} Icon URL
     */
    get_icon_url() {
        return this._options.icon_url;
    }

    /**
     * Set icon URL.
     *
     * @param {string} url - New icon URL
     * @returns {this} Returns this for chaining
     */
    set_icon_url(url) {
        this._options.icon_url = url;
        this._icon_loaded = false;

        if (this._element) {
            const icon = this._element.querySelector('.um-marker-icon');
            if (icon) {
                icon.src = url;
            }
        }

        return this;
    }

    /**
     * Get icon size.
     *
     * @returns {Array<number>} Icon size [width, height]
     */
    get_icon_size() {
        return [...this._options.icon_size];
    }

    /**
     * Set icon size.
     *
     * @param {Array<number>} size - New size [width, height]
     * @returns {this} Returns this for chaining
     */
    set_icon_size(size) {
        this._options.icon_size = size;

        if (this._element) {
            const icon = this._element.querySelector('.um-marker-icon');
            if (icon) {
                icon.style.width = `${size[0]}px`;
                icon.style.height = `${size[1]}px`;
            }
            this._update_position();
        }

        return this;
    }

    /**
     * Get icon anchor.
     *
     * @returns {Array<number>} Icon anchor [x, y]
     */
    get_icon_anchor() {
        return [...this._options.icon_anchor];
    }

    /**
     * Set icon anchor.
     *
     * @param {Array<number>} anchor - New anchor [x, y]
     * @returns {this} Returns this for chaining
     */
    set_icon_anchor(anchor) {
        this._options.icon_anchor = anchor;
        this._update_position();
        return this;
    }

    // ==================== Visibility ====================

    /**
     * Show the marker.
     *
     * @returns {this} Returns this for chaining
     */
    show() {
        super.show();
        if (this._shadow_element) {
            this._shadow_element.style.display = '';
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
        if (this._shadow_element) {
            this._shadow_element.style.display = 'none';
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
        if (this._shadow_element) {
            this._shadow_element.style.opacity = this._opacity;
        }
        return this;
    }
}

/**
 * Icon - Reusable icon configuration
 *
 * Define icon properties once and reuse for multiple markers.
 *
 * @example
 * const custom_icon = new Icon({
 *     icon_url: '/icons/marker.png',
 *     icon_size: [32, 32],
 *     icon_anchor: [16, 32]
 * });
 *
 * new IconMarker([40.71, -74.00], custom_icon.get_options()).add_to(map);
 */
export class Icon {
    /**
     * Create a new Icon configuration.
     *
     * @param {Object} options - Icon options
     */
    constructor(options = {}) {
        this._options = merge_options(DEFAULT_OPTIONS, options);
    }

    /**
     * Get icon options.
     *
     * @returns {Object} Icon options
     */
    get_options() {
        return { ...this._options };
    }

    /**
     * Create an IconMarker with this icon.
     *
     * @param {LatLng|Array} latlng - Marker position
     * @param {Object} [options] - Additional options
     * @returns {IconMarker} New marker
     */
    create_marker(latlng, options = {}) {
        return new IconMarker(latlng, { ...this._options, ...options });
    }
}
