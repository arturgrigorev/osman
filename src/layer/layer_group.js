/**
 * LayerGroup - Container for multiple layers
 *
 * Groups multiple layers together for unified management.
 * Useful for toggling visibility of related layers as a group.
 *
 * @example
 * const group = new LayerGroup([layer1, layer2, layer3]);
 * group.add_to(map);
 *
 * // Toggle all layers at once
 * group.hide();
 */

import { Layer } from './layer.js';

/**
 * LayerGroup class for grouping layers.
 */
export class LayerGroup extends Layer {
    /**
     * Create a new LayerGroup.
     *
     * @param {Array<Layer>} [layers=[]] - Initial layers
     * @param {Object} [options] - Group options
     */
    constructor(layers = [], options = {}) {
        super(options);

        this._layers = new Map();

        // Add initial layers
        for (const layer of layers) {
            this.add_layer(layer);
        }
    }

    // ==================== Layer Management ====================

    /**
     * Add a layer to the group.
     *
     * @param {Layer} layer - Layer to add
     * @returns {this} Returns this for chaining
     */
    add_layer(layer) {
        if (!layer || this._layers.has(layer)) return this;

        this._layers.set(layer, layer.get_id());

        // If group is already on a map, add layer to map
        if (this._map) {
            this._map.add_layer(layer);
        }

        this.emit('layergroup:add', { layer });
        return this;
    }

    /**
     * Remove a layer from the group.
     *
     * @param {Layer} layer - Layer to remove
     * @returns {this} Returns this for chaining
     */
    remove_layer(layer) {
        if (!layer || !this._layers.has(layer)) return this;

        this._layers.delete(layer);

        // If group is on a map, remove layer from map
        if (this._map) {
            this._map.remove_layer(layer);
        }

        this.emit('layergroup:remove', { layer });
        return this;
    }

    /**
     * Check if group has a layer.
     *
     * @param {Layer} layer - Layer to check
     * @returns {boolean} True if group has the layer
     */
    has_layer(layer) {
        return this._layers.has(layer);
    }

    /**
     * Get all layers in the group.
     *
     * @returns {Array<Layer>} Array of layers
     */
    get_layers() {
        return Array.from(this._layers.keys());
    }

    /**
     * Get layer by ID.
     *
     * @param {string} id - Layer ID
     * @returns {Layer|null} Layer or null
     */
    get_layer(id) {
        for (const [layer, layer_id] of this._layers) {
            if (layer_id === id) return layer;
        }
        return null;
    }

    /**
     * Clear all layers from the group.
     *
     * @returns {this} Returns this for chaining
     */
    clear_layers() {
        for (const layer of this._layers.keys()) {
            this.remove_layer(layer);
        }
        return this;
    }

    /**
     * Get number of layers in the group.
     *
     * @returns {number} Layer count
     */
    get_layer_count() {
        return this._layers.size;
    }

    // ==================== Lifecycle ====================

    /**
     * Called when group is added to a map.
     *
     * @param {Osman} map - The map instance
     */
    on_add(map) {
        super.on_add(map);

        // Add all layers to map
        for (const layer of this._layers.keys()) {
            map.add_layer(layer);
        }
    }

    /**
     * Called when group is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        // Remove all layers from map
        for (const layer of this._layers.keys()) {
            map.remove_layer(layer);
        }

        super.on_remove(map);
    }

    // ==================== Visibility ====================

    /**
     * Show all layers in the group.
     *
     * @returns {this} Returns this for chaining
     */
    show() {
        super.show();
        for (const layer of this._layers.keys()) {
            layer.show();
        }
        return this;
    }

    /**
     * Hide all layers in the group.
     *
     * @returns {this} Returns this for chaining
     */
    hide() {
        super.hide();
        for (const layer of this._layers.keys()) {
            layer.hide();
        }
        return this;
    }

    // ==================== Opacity ====================

    /**
     * Set opacity for all layers in the group.
     *
     * @param {number} opacity - Opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    set_opacity(opacity) {
        super.set_opacity(opacity);
        for (const layer of this._layers.keys()) {
            layer.set_opacity(opacity);
        }
        return this;
    }

    // ==================== Bounds ====================

    /**
     * Get combined bounds of all layers.
     *
     * @returns {Bounds|null} Combined bounds or null
     */
    get_bounds() {
        const bounds_list = [];

        for (const layer of this._layers.keys()) {
            const bounds = layer.get_bounds();
            if (bounds) {
                bounds_list.push(bounds);
            }
        }

        if (bounds_list.length === 0) return null;

        // Import Bounds for union
        const { Bounds } = require('../geo/bounds.js');
        return Bounds.union(bounds_list);
    }

    // ==================== Iteration ====================

    /**
     * Execute a function for each layer.
     *
     * @param {Function} fn - Function to execute (receives layer)
     * @returns {this} Returns this for chaining
     */
    each_layer(fn) {
        for (const layer of this._layers.keys()) {
            fn(layer);
        }
        return this;
    }

    /**
     * Make the group iterable.
     */
    *[Symbol.iterator]() {
        yield* this._layers.keys();
    }

    // ==================== Rendering ====================

    /**
     * LayerGroup doesn't render itself - child layers render.
     */
    render(ctx, transform) {
        // No-op: child layers render themselves
    }

    /**
     * Update all child layers.
     *
     * @param {Transform} transform - Current transform
     */
    update(transform) {
        for (const layer of this._layers.keys()) {
            if (layer.update) {
                layer.update(transform);
            }
        }
    }
}
