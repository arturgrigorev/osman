/**
 * Layer - Abstract base class for all layers
 *
 * Provides the foundation for map layers with lifecycle management,
 * visibility control, and event handling.
 *
 * @abstract
 * @example
 * class MyLayer extends Layer {
 *     on_add(map) {
 *         super.on_add(map);
 *         // Initialize layer
 *     }
 *
 *     render(ctx, transform) {
 *         // Draw layer content
 *     }
 * }
 */

import { EventEmitter } from '../core/event_emitter.js';
import { uid } from '../core/utils.js';
import { merge_options } from '../core/options.js';

/**
 * Default layer options.
 */
const DEFAULT_OPTIONS = {
    opacity: 1,
    visible: true,
    interactive: true,
    z_index: 0,
    attribution: null
};

/**
 * Abstract Layer base class.
 */
export class Layer extends EventEmitter {
    /**
     * Create a new Layer.
     *
     * @param {Object} [options] - Layer options
     * @param {number} [options.opacity=1] - Layer opacity (0-1)
     * @param {boolean} [options.visible=true] - Initial visibility
     * @param {boolean} [options.interactive=true] - Enable interaction
     * @param {number} [options.z_index=0] - Layer z-index
     * @param {string} [options.attribution] - Attribution text
     */
    constructor(options = {}) {
        super();

        this._id = uid('layer');
        this._options = merge_options(DEFAULT_OPTIONS, options);
        this._map = null;
        this._visible = this._options.visible;
        this._opacity = this._options.opacity;
        this._z_index = this._options.z_index;
    }

    // ==================== Lifecycle ====================

    /**
     * Called when layer is added to a map.
     * Override in subclass to initialize layer.
     *
     * @param {Osman} map - The map instance
     */
    on_add(map) {
        this._map = map;
        this.emit('layer:add', { map });
    }

    /**
     * Called when layer is removed from a map.
     * Override in subclass to clean up resources.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        this._map = null;
        this.emit('layer:remove', { map });
    }

    /**
     * Add this layer to a map.
     *
     * @param {Osman} map - The map to add to
     * @returns {this} Returns this for chaining
     */
    add_to(map) {
        map.add_layer(this);
        return this;
    }

    /**
     * Remove this layer from its map.
     *
     * @returns {this} Returns this for chaining
     */
    remove() {
        if (this._map) {
            this._map.remove_layer(this);
        }
        return this;
    }

    // ==================== Rendering ====================

    /**
     * Update layer state based on current view.
     * Override in subclass.
     *
     * @param {Transform} transform - Current transform
     */
    update(transform) {
        // Override in subclass
    }

    /**
     * Render the layer to canvas.
     * Override in subclass.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Transform} transform - Current transform
     */
    render(ctx, transform) {
        // Override in subclass
    }

    /**
     * Request a redraw of this layer.
     */
    redraw() {
        if (this._map) {
            this._map._request_render();
        }
    }

    // ==================== Visibility ====================

    /**
     * Show the layer.
     *
     * @returns {this} Returns this for chaining
     */
    show() {
        if (!this._visible) {
            this._visible = true;
            this.redraw();
            this.emit('layer:show');
        }
        return this;
    }

    /**
     * Hide the layer.
     *
     * @returns {this} Returns this for chaining
     */
    hide() {
        if (this._visible) {
            this._visible = false;
            this.redraw();
            this.emit('layer:hide');
        }
        return this;
    }

    /**
     * Toggle layer visibility.
     *
     * @returns {this} Returns this for chaining
     */
    toggle() {
        return this._visible ? this.hide() : this.show();
    }

    /**
     * Check if layer is visible.
     *
     * @returns {boolean} True if visible
     */
    is_visible() {
        return this._visible;
    }

    /**
     * Set layer visibility.
     *
     * @param {boolean} visible - Visibility state
     * @returns {this} Returns this for chaining
     */
    set_visible(visible) {
        return visible ? this.show() : this.hide();
    }

    // ==================== Opacity ====================

    /**
     * Get layer opacity.
     *
     * @returns {number} Opacity (0-1)
     */
    get_opacity() {
        return this._opacity;
    }

    /**
     * Set layer opacity.
     *
     * @param {number} opacity - Opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    set_opacity(opacity) {
        this._opacity = Math.max(0, Math.min(1, opacity));
        this.redraw();
        this.emit('layer:opacity', { opacity: this._opacity });
        return this;
    }

    // ==================== Z-Index ====================

    /**
     * Get layer z-index.
     *
     * @returns {number} Z-index
     */
    get_z_index() {
        return this._z_index;
    }

    /**
     * Set layer z-index.
     *
     * @param {number} z_index - New z-index
     * @returns {this} Returns this for chaining
     */
    set_z_index(z_index) {
        this._z_index = z_index;
        this.emit('layer:z_index', { z_index });
        return this;
    }

    /**
     * Bring layer to front.
     *
     * @returns {this} Returns this for chaining
     */
    bring_to_front() {
        // TODO: Implement layer ordering
        return this;
    }

    /**
     * Send layer to back.
     *
     * @returns {this} Returns this for chaining
     */
    bring_to_back() {
        // TODO: Implement layer ordering
        return this;
    }

    // ==================== Bounds ====================

    /**
     * Get layer bounds.
     * Override in subclass.
     *
     * @returns {Bounds|null} Layer bounds or null
     */
    get_bounds() {
        return null;
    }

    // ==================== Identification ====================

    /**
     * Get layer ID.
     *
     * @returns {string} Layer ID
     */
    get_id() {
        return this._id;
    }

    /**
     * Get the map this layer is added to.
     *
     * @returns {Osman|null} Map instance or null
     */
    get_map() {
        return this._map;
    }

    /**
     * Check if layer is added to a map.
     *
     * @returns {boolean} True if added to a map
     */
    is_added() {
        return this._map !== null;
    }

    // ==================== Attribution ====================

    /**
     * Get layer attribution.
     *
     * @returns {string|null} Attribution text or null
     */
    get_attribution() {
        return this._options.attribution;
    }

    /**
     * Set layer attribution.
     *
     * @param {string} attribution - Attribution text
     * @returns {this} Returns this for chaining
     */
    set_attribution(attribution) {
        this._options.attribution = attribution;
        return this;
    }

    // ==================== Interaction ====================

    /**
     * Check if layer is interactive.
     *
     * @returns {boolean} True if interactive
     */
    is_interactive() {
        return this._options.interactive;
    }

    /**
     * Enable interaction.
     *
     * @returns {this} Returns this for chaining
     */
    enable_interaction() {
        this._options.interactive = true;
        return this;
    }

    /**
     * Disable interaction.
     *
     * @returns {this} Returns this for chaining
     */
    disable_interaction() {
        this._options.interactive = false;
        return this;
    }

    // ==================== Utilities ====================

    /**
     * Get options.
     *
     * @returns {Object} Layer options
     */
    get_options() {
        return { ...this._options };
    }

    /**
     * Apply canvas opacity for rendering.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @protected
     */
    _apply_opacity(ctx) {
        ctx.globalAlpha = this._opacity;
    }

    /**
     * Reset canvas state after rendering.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @protected
     */
    _reset_canvas(ctx) {
        ctx.globalAlpha = 1;
    }
}
