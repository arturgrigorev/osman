/**
 * Osman - Main map class (Facade pattern)
 *
 * Central entry point for all map operations. Provides a fluent API
 * for creating and interacting with urban analysis maps.
 *
 * @example
 * const map = new Osman('container', {
 *     center: [40.7128, -74.0060],
 *     zoom: 12
 * });
 *
 * map.set_view([40.71, -74.00], 14)
 *    .add_layer(buildings)
 *    .add_control(zoom_control);
 */

import { EventEmitter } from '../core/event_emitter.js';
import { PluginManager } from '../core/plugin_manager.js';
import { uid, is_string, is_browser } from '../core/utils.js';
import { merge_options } from '../core/options.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { Point } from '../geo/projection.js';
import { Viewport } from './viewport.js';
import { InputHandler } from './input_handler.js';

/**
 * Default map options.
 */
const DEFAULT_OPTIONS = {
    center: [0, 0],
    zoom: 1,
    min_zoom: 0,
    max_zoom: 22,
    max_bounds: null,
    zoom_snap: 1,
    zoom_delta: 1,
    drag_enabled: true,
    scroll_zoom_enabled: true,
    double_click_zoom_enabled: true,
    keyboard_enabled: true,
    touch_enabled: true,
    inertia_enabled: true,
    attribution: true,
    debug: false
};

/**
 * Osman main class.
 */
export class Osman extends EventEmitter {
    /**
     * Create a new Osman.
     *
     * @param {string|HTMLElement} container - Container element or ID
     * @param {Object} [options] - Map options
     * @param {Array<number>|LatLng} [options.center=[0,0]] - Initial center
     * @param {number} [options.zoom=1] - Initial zoom level
     * @param {number} [options.min_zoom=0] - Minimum zoom level
     * @param {number} [options.max_zoom=22] - Maximum zoom level
     * @param {Bounds|Array} [options.max_bounds] - Max panning bounds
     */
    constructor(container, options = {}) {
        super();

        // Validate browser environment
        if (!is_browser()) {
            throw new Error('Osman requires a browser environment');
        }

        // Get container element
        this._container = is_string(container)
            ? document.getElementById(container)
            : container;

        if (!this._container) {
            throw new Error(`Container '${container}' not found`);
        }

        // Generate unique ID
        this._id = uid('map');

        // Merge options
        this._options = merge_options(DEFAULT_OPTIONS, options);

        // Initialize state
        this._ready = false;
        this._layers = new Map();
        this._controls = new Map();
        this._panes = new Map();

        // Initialize components
        this._init_container();
        this._init_viewport();
        this._init_input_handler();
        this._init_plugins();
        this._init_renderer();

        // Mark as ready
        this._ready = true;
        this.emit('map:ready', { map: this });
    }

    // ==================== Initialization ====================

    /**
     * Initialize container structure.
     * @private
     */
    _init_container() {
        // Add map class
        this._container.classList.add('um-map');

        // Set tabindex for keyboard focus
        if (!this._container.hasAttribute('tabindex')) {
            this._container.setAttribute('tabindex', '0');
        }

        // Create main panes
        this._map_pane = this._create_pane('map', this._container);
        this._tile_pane = this._create_pane('tile', this._map_pane);
        this._overlay_pane = this._create_pane('overlay', this._map_pane);
        this._marker_pane = this._create_pane('marker', this._map_pane);
        this._popup_pane = this._create_pane('popup', this._map_pane);
        this._control_pane = this._create_pane('control', this._container);

        // Create canvas for vector rendering
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'um-canvas';
        this._canvas.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%;';
        this._overlay_pane.appendChild(this._canvas);

        // Alias for vector layers
        this._vector_container = this._overlay_pane;
    }

    /**
     * Create a map pane.
     * @private
     */
    _create_pane(name, parent) {
        const pane = document.createElement('div');
        pane.className = `um-pane um-${name}-pane`;
        parent.appendChild(pane);
        this._panes.set(name, pane);
        return pane;
    }

    /**
     * Initialize viewport.
     * @private
     */
    _init_viewport() {
        this._viewport = new Viewport(this._container, {
            center: this._options.center,
            zoom: this._options.zoom,
            min_zoom: this._options.min_zoom,
            max_zoom: this._options.max_zoom,
            max_bounds: this._options.max_bounds,
            zoom_snap: this._options.zoom_snap,
            zoom_delta: this._options.zoom_delta
        });

        // Forward viewport events
        this._viewport.on('view:move', (e) => {
            this._update_layers();
            this.emit('map:move', e);
        });

        this._viewport.on('view:zoom', (e) => {
            this._update_layers();
            this.emit('map:zoom', e);
        });

        this._viewport.on('view:resize', (e) => {
            this._resize_canvas();
            this._update_layers();
            this.emit('map:resize', e);
        });
    }

    /**
     * Initialize input handler.
     * @private
     */
    _init_input_handler() {
        this._input = new InputHandler(this._container, this._viewport, {
            drag_enabled: this._options.drag_enabled,
            scroll_zoom_enabled: this._options.scroll_zoom_enabled,
            double_click_zoom_enabled: this._options.double_click_zoom_enabled,
            keyboard_enabled: this._options.keyboard_enabled,
            touch_enabled: this._options.touch_enabled,
            inertia_enabled: this._options.inertia_enabled
        });

        // Forward input events
        this._input.on('input:click', (e) => {
            this.emit('map:click', e);
        });

        this._input.on('input:dblclick', (e) => {
            this.emit('map:dblclick', e);
        });

        this._input.on('input:contextmenu', (e) => {
            this.emit('map:contextmenu', e);
        });

        this._input.on('input:drag_start', () => {
            this.emit('map:drag_start');
        });

        this._input.on('input:drag_end', () => {
            this.emit('map:drag_end');
        });
    }

    /**
     * Initialize plugin manager.
     * @private
     */
    _init_plugins() {
        this._plugins = new PluginManager(this);
    }

    /**
     * Initialize canvas renderer.
     * @private
     */
    _init_renderer() {
        this._resize_canvas();
        this._ctx = this._canvas.getContext('2d');
    }

    /**
     * Resize canvas to match container.
     * @private
     */
    _resize_canvas() {
        const rect = this._container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;
        this._canvas.style.width = `${rect.width}px`;
        this._canvas.style.height = `${rect.height}px`;

        if (this._ctx) {
            this._ctx.scale(dpr, dpr);
        }
    }

    // ==================== View Methods ====================

    /**
     * Set map view (center and zoom).
     *
     * @param {LatLng|Array<number>} center - New center
     * @param {number} zoom - New zoom level
     * @param {Object} [options] - Animation options
     * @returns {this} Returns this for chaining
     * @fires map:move
     * @fires map:zoom
     */
    set_view(center, zoom, options = {}) {
        this._viewport.set_view(center, zoom, options);
        return this;
    }

    /**
     * Set map center.
     *
     * @param {LatLng|Array<number>} center - New center
     * @param {Object} [options] - Animation options
     * @returns {this} Returns this for chaining
     */
    set_center(center, options = {}) {
        this._viewport.set_center(center, options);
        return this;
    }

    /**
     * Set zoom level.
     *
     * @param {number} zoom - New zoom level
     * @param {Object} [options] - Animation options
     * @returns {this} Returns this for chaining
     */
    set_zoom(zoom, options = {}) {
        this._viewport.set_zoom(zoom, options);
        return this;
    }

    /**
     * Get current center.
     *
     * @returns {LatLng} Center coordinate
     */
    get_center() {
        return this._viewport.get_center();
    }

    /**
     * Get current zoom level.
     *
     * @returns {number} Zoom level
     */
    get_zoom() {
        return this._viewport.get_zoom();
    }

    /**
     * Get visible bounds.
     *
     * @returns {Bounds} Visible geographic bounds
     */
    get_bounds() {
        return this._viewport.get_bounds();
    }

    /**
     * Get container size.
     *
     * @returns {Object} Size { width, height }
     */
    get_size() {
        return this._viewport.get_size();
    }

    /**
     * Zoom in.
     *
     * @param {number} [delta=1] - Zoom delta
     * @returns {this} Returns this for chaining
     */
    zoom_in(delta) {
        this._viewport.zoom_in(delta);
        return this;
    }

    /**
     * Zoom out.
     *
     * @param {number} [delta=1] - Zoom delta
     * @returns {this} Returns this for chaining
     */
    zoom_out(delta) {
        this._viewport.zoom_out(delta);
        return this;
    }

    /**
     * Fit bounds in view.
     *
     * @param {Bounds|Array} bounds - Bounds to fit
     * @param {Object} [options] - Fit options
     * @returns {this} Returns this for chaining
     */
    fit_bounds(bounds, options = {}) {
        this._viewport.fit_bounds(bounds, options);
        return this;
    }

    /**
     * Animated fly to a location.
     *
     * @param {LatLng|Array<number>} center - Target center
     * @param {number} [zoom] - Target zoom
     * @param {Object} [options] - Animation options
     * @returns {Promise<void>} Resolves when animation completes
     */
    fly_to(center, zoom, options = {}) {
        return this._viewport.fly_to(center, zoom, options);
    }

    /**
     * Pan by pixel offset.
     *
     * @param {number} dx - X offset in pixels
     * @param {number} dy - Y offset in pixels
     * @param {Object} [options] - Animation options
     * @returns {this} Returns this for chaining
     */
    pan_by(dx, dy, options = {}) {
        this._viewport.pan_by(dx, dy, options);
        return this;
    }

    // ==================== Layer Methods ====================

    /**
     * Add a layer to the map.
     *
     * @param {Layer} layer - Layer to add
     * @returns {this} Returns this for chaining
     * @fires layer:add
     */
    add_layer(layer) {
        if (!layer || this._layers.has(layer)) return this;

        const id = layer.get_id ? layer.get_id() : uid('layer');
        this._layers.set(layer, id);

        if (layer.on_add) {
            layer.on_add(this);
        }

        this.emit('layer:add', { layer });
        this._request_render();

        return this;
    }

    /**
     * Remove a layer from the map.
     *
     * @param {Layer} layer - Layer to remove
     * @returns {this} Returns this for chaining
     * @fires layer:remove
     */
    remove_layer(layer) {
        if (!layer || !this._layers.has(layer)) return this;

        if (layer.on_remove) {
            layer.on_remove(this);
        }

        this._layers.delete(layer);
        this.emit('layer:remove', { layer });
        this._request_render();

        return this;
    }

    /**
     * Check if map has a layer.
     *
     * @param {Layer} layer - Layer to check
     * @returns {boolean} True if map has the layer
     */
    has_layer(layer) {
        return this._layers.has(layer);
    }

    /**
     * Get all layers.
     *
     * @returns {Array<Layer>} Array of layers
     */
    get_layers() {
        return Array.from(this._layers.keys());
    }

    /**
     * Clear all layers.
     *
     * @returns {this} Returns this for chaining
     */
    clear_layers() {
        for (const layer of this._layers.keys()) {
            this.remove_layer(layer);
        }
        return this;
    }

    // ==================== Control Methods ====================

    /**
     * Add a control to the map.
     *
     * @param {Control} control - Control to add
     * @returns {this} Returns this for chaining
     * @fires control:add
     */
    add_control(control) {
        if (!control || this._controls.has(control)) return this;

        const id = control.get_id ? control.get_id() : uid('control');
        this._controls.set(control, id);

        if (control.on_add) {
            const element = control.on_add(this);
            if (element) {
                this._position_control(control, element);
            }
        }

        this.emit('control:add', { control });
        return this;
    }

    /**
     * Remove a control from the map.
     *
     * @param {Control} control - Control to remove
     * @returns {this} Returns this for chaining
     * @fires control:remove
     */
    remove_control(control) {
        if (!control || !this._controls.has(control)) return this;

        if (control.on_remove) {
            control.on_remove(this);
        }

        this._controls.delete(control);
        this.emit('control:remove', { control });

        return this;
    }

    /**
     * Check if map has a control.
     *
     * @param {Control} control - Control to check
     * @returns {boolean} True if map has the control
     */
    has_control(control) {
        return this._controls.has(control);
    }

    /**
     * Position control element in the control pane.
     * @private
     */
    _position_control(control, element) {
        const position = control.get_position ? control.get_position() : 'top_right';

        // Create or get position container
        let container = this._control_pane.querySelector(`.um-${position}`);
        if (!container) {
            container = document.createElement('div');
            container.className = `um-control-container um-${position}`;
            this._control_pane.appendChild(container);
        }

        container.appendChild(element);
    }

    // ==================== Plugin Methods ====================

    /**
     * Register a plugin.
     *
     * @param {Function} PluginClass - Plugin class
     * @returns {this} Returns this for chaining
     */
    use_plugin(PluginClass) {
        this._plugins.register(PluginClass);
        return this;
    }

    /**
     * Get a plugin by ID.
     *
     * @param {string} id - Plugin ID
     * @returns {Object|null} Plugin instance or null
     */
    get_plugin(id) {
        return this._plugins.get(id);
    }

    /**
     * List all plugins.
     *
     * @returns {Array<string>} Plugin IDs
     */
    list_plugins() {
        return this._plugins.list();
    }

    /**
     * Remove a plugin.
     *
     * @param {string} id - Plugin ID
     * @returns {this} Returns this for chaining
     */
    remove_plugin(id) {
        this._plugins.unregister(id);
        return this;
    }

    // ==================== Coordinate Conversion ====================

    /**
     * Convert geographic coordinate to pixel coordinate.
     *
     * @param {LatLng|Array<number>} latlng - Geographic coordinate
     * @returns {Point} Container pixel coordinate
     */
    latlng_to_pixel(latlng) {
        return this._viewport.latlng_to_pixel(latlng);
    }

    /**
     * Convert geographic coordinate to point (alias for latlng_to_pixel).
     *
     * @param {LatLng|Array<number>} latlng - Geographic coordinate
     * @returns {Point} Container pixel coordinate
     */
    latlng_to_point(latlng) {
        return this._viewport.latlng_to_pixel(latlng);
    }

    /**
     * Convert pixel coordinate to geographic coordinate.
     *
     * @param {Point|Array<number>} pixel - Container pixel coordinate
     * @returns {LatLng} Geographic coordinate
     */
    pixel_to_latlng(pixel) {
        return this._viewport.pixel_to_latlng(pixel);
    }

    // ==================== Panes ====================

    /**
     * Get a map pane by name.
     *
     * @param {string} name - Pane name
     * @returns {HTMLElement|null} Pane element or null
     */
    get_pane(name) {
        return this._panes.get(name) || null;
    }

    /**
     * Create a custom pane.
     *
     * @param {string} name - Pane name
     * @param {string} [parent='overlay'] - Parent pane name
     * @returns {HTMLElement} Created pane element
     */
    create_pane(name, parent = 'overlay') {
        if (this._panes.has(name)) {
            return this._panes.get(name);
        }

        const parent_pane = this._panes.get(parent) || this._map_pane;
        return this._create_pane(name, parent_pane);
    }

    // ==================== Rendering ====================

    /**
     * Request a render update.
     */
    _request_render() {
        if (this._render_requested) return;
        this._render_requested = true;

        requestAnimationFrame(() => {
            this._render_requested = false;
            this._render();
        });
    }

    /**
     * Render all layers.
     * @private
     */
    _render() {
        if (!this._ctx) return;

        const size = this.get_size();
        this._ctx.clearRect(0, 0, size.width, size.height);

        // Render layers in order
        for (const layer of this._layers.keys()) {
            if (layer.render) {
                layer.render(this._ctx, this._viewport.get_transform());
            }
        }
    }

    /**
     * Update all layers.
     * @private
     */
    _update_layers() {
        for (const layer of this._layers.keys()) {
            if (layer.update) {
                layer.update(this._viewport.get_transform());
            }
        }
        this._request_render();
    }

    // ==================== State ====================

    /**
     * Check if map is ready.
     *
     * @returns {boolean} True if ready
     */
    is_ready() {
        return this._ready;
    }

    /**
     * Wait for map to be ready.
     *
     * @returns {Promise<void>} Resolves when ready
     */
    wait_for_ready() {
        if (this._ready) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.once('map:ready', resolve);
        });
    }

    /**
     * Invalidate map size (call after container resize).
     *
     * @returns {this} Returns this for chaining
     */
    invalidate_size() {
        this._viewport.invalidate_size();
        this._resize_canvas();
        return this;
    }

    /**
     * Get the container element.
     *
     * @returns {HTMLElement} Container element
     */
    get_container() {
        return this._container;
    }

    /**
     * Get the canvas element.
     *
     * @returns {HTMLCanvasElement} Canvas element
     */
    get_canvas() {
        return this._canvas;
    }

    /**
     * Get the canvas 2D context.
     *
     * @returns {CanvasRenderingContext2D} Canvas context
     */
    get_context() {
        return this._ctx;
    }

    /**
     * Get debug info.
     *
     * @returns {Object} Debug information
     */
    get_debug_info() {
        return {
            id: this._id,
            center: this.get_center().to_array(),
            zoom: this.get_zoom(),
            bounds: this.get_bounds().to_array(),
            size: this.get_size(),
            layer_count: this._layers.size,
            control_count: this._controls.size,
            plugin_count: this._plugins.list().length
        };
    }

    // ==================== Cleanup ====================

    /**
     * Remove the map and clean up resources.
     */
    remove() {
        // Remove layers
        this.clear_layers();

        // Remove controls
        for (const control of this._controls.keys()) {
            this.remove_control(control);
        }

        // Dispose plugins
        this._plugins.dispose();

        // Dispose input handler
        this._input.dispose();

        // Clear event listeners
        this.off_all();

        // Remove DOM elements
        while (this._container.firstChild) {
            this._container.removeChild(this._container.firstChild);
        }
        this._container.classList.remove('um-map');

        this._ready = false;
        this.emit('map:remove');
    }
}
