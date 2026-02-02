/**
 * Control - Abstract base class for map controls
 *
 * Provides the foundation for UI controls with positioning
 * and lifecycle management.
 *
 * @abstract
 * @example
 * class MyControl extends Control {
 *     on_add(map) {
 *         const container = super.on_add(map);
 *         container.innerHTML = '<button>Click me</button>';
 *         return container;
 *     }
 * }
 */

import { EventEmitter } from '../core/event_emitter.js';
import { uid } from '../core/utils.js';
import { merge_options } from '../core/options.js';

/**
 * Valid control positions.
 */
export const ControlPosition = Object.freeze({
    TOP_LEFT: 'top_left',
    TOP_RIGHT: 'top_right',
    BOTTOM_LEFT: 'bottom_left',
    BOTTOM_RIGHT: 'bottom_right'
});

/**
 * Default control options.
 */
const DEFAULT_OPTIONS = {
    position: ControlPosition.TOP_RIGHT
};

/**
 * Abstract Control base class.
 */
export class Control extends EventEmitter {
    /**
     * Create a new Control.
     *
     * @param {Object} [options] - Control options
     * @param {string} [options.position='top_right'] - Control position
     */
    constructor(options = {}) {
        super();

        this._id = uid('control');
        this._options = merge_options(DEFAULT_OPTIONS, options);
        this._map = null;
        this._container = null;
        this._visible = true;
        this._enabled = true;
    }

    // ==================== Lifecycle ====================

    /**
     * Called when control is added to a map.
     * Override in subclass to create control UI.
     *
     * @param {Osman} map - The map instance
     * @returns {HTMLElement} The control container element
     */
    on_add(map) {
        this._map = map;

        // Create container
        this._container = document.createElement('div');
        this._container.className = 'um-control';

        this.emit('control:add', { map });

        return this._container;
    }

    /**
     * Called when control is removed from a map.
     * Override in subclass to clean up.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }

        this._container = null;
        this._map = null;

        this.emit('control:remove', { map });
    }

    /**
     * Add this control to a map.
     *
     * @param {Osman} map - The map to add to
     * @returns {this} Returns this for chaining
     */
    add_to(map) {
        map.add_control(this);
        return this;
    }

    /**
     * Remove this control from its map.
     *
     * @returns {this} Returns this for chaining
     */
    remove() {
        if (this._map) {
            this._map.remove_control(this);
        }
        return this;
    }

    // ==================== Position ====================

    /**
     * Get control position.
     *
     * @returns {string} Position string
     */
    get_position() {
        return this._options.position;
    }

    /**
     * Set control position.
     *
     * @param {string} position - New position
     * @returns {this} Returns this for chaining
     */
    set_position(position) {
        this._options.position = position;

        // If already on map, reposition
        if (this._map && this._container) {
            this.remove();
            this.add_to(this._map);
        }

        return this;
    }

    // ==================== Visibility ====================

    /**
     * Show the control.
     *
     * @returns {this} Returns this for chaining
     */
    show() {
        if (!this._visible) {
            this._visible = true;
            if (this._container) {
                this._container.style.display = '';
            }
            this.emit('control:show');
        }
        return this;
    }

    /**
     * Hide the control.
     *
     * @returns {this} Returns this for chaining
     */
    hide() {
        if (this._visible) {
            this._visible = false;
            if (this._container) {
                this._container.style.display = 'none';
            }
            this.emit('control:hide');
        }
        return this;
    }

    /**
     * Toggle control visibility.
     *
     * @returns {this} Returns this for chaining
     */
    toggle() {
        return this._visible ? this.hide() : this.show();
    }

    /**
     * Check if control is visible.
     *
     * @returns {boolean} True if visible
     */
    is_visible() {
        return this._visible;
    }

    // ==================== Enable/Disable ====================

    /**
     * Enable the control.
     *
     * @returns {this} Returns this for chaining
     */
    enable() {
        if (!this._enabled) {
            this._enabled = true;
            if (this._container) {
                this._container.classList.remove('um-disabled');
            }
            this.emit('control:enable');
        }
        return this;
    }

    /**
     * Disable the control.
     *
     * @returns {this} Returns this for chaining
     */
    disable() {
        if (this._enabled) {
            this._enabled = false;
            if (this._container) {
                this._container.classList.add('um-disabled');
            }
            this.emit('control:disable');
        }
        return this;
    }

    /**
     * Check if control is enabled.
     *
     * @returns {boolean} True if enabled
     */
    is_enabled() {
        return this._enabled;
    }

    // ==================== Identification ====================

    /**
     * Get control ID.
     *
     * @returns {string} Control ID
     */
    get_id() {
        return this._id;
    }

    /**
     * Get the map this control is added to.
     *
     * @returns {Osman|null} Map instance or null
     */
    get_map() {
        return this._map;
    }

    /**
     * Get the container element.
     *
     * @returns {HTMLElement|null} Container element or null
     */
    get_container() {
        return this._container;
    }

    /**
     * Check if control is added to a map.
     *
     * @returns {boolean} True if added to a map
     */
    is_added() {
        return this._map !== null;
    }

    // ==================== Utilities ====================

    /**
     * Create a button element.
     *
     * @param {string} html - Button HTML content
     * @param {string} title - Button title/tooltip
     * @param {Function} handler - Click handler
     * @returns {HTMLButtonElement} Button element
     * @protected
     */
    _create_button(html, title, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = html;
        button.title = title;
        button.setAttribute('aria-label', title);

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this._enabled) {
                handler(e);
            }
        });

        return button;
    }

    /**
     * Stop event propagation to the map.
     *
     * @param {HTMLElement} element - Element to prevent propagation on
     * @protected
     */
    _disable_click_propagation(element) {
        const events = ['click', 'dblclick', 'mousedown', 'touchstart'];
        for (const event of events) {
            element.addEventListener(event, (e) => e.stopPropagation());
        }
    }
}
