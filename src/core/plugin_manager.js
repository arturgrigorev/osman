/**
 * PluginManager - Plugin registration and lifecycle management
 *
 * Manages plugins for Osman. Plugins can extend functionality through
 * three extension points: Analysis, Renderer, and Control.
 *
 * @example
 * const manager = new PluginManager(map);
 * manager.register(MyAnalysisPlugin);
 * const plugin = manager.get('my-analysis');
 * plugin.compute_something();
 */

import { EventEmitter } from './event_emitter.js';

/**
 * Plugin types enumeration.
 */
export const PluginType = Object.freeze({
    ANALYSIS: 'analysis',
    RENDERER: 'renderer',
    CONTROL: 'control'
});

/**
 * PluginManager class for managing plugin lifecycle.
 */
export class PluginManager extends EventEmitter {
    /**
     * Create a new PluginManager.
     *
     * @param {Object} map - The Osman instance
     */
    constructor(map) {
        super();
        this._map = map;
        this._plugins = new Map();
        this._plugin_classes = new Map();
    }

    /**
     * Register a plugin class.
     *
     * @param {Function} PluginClass - Plugin class to register
     * @returns {this} Returns this for chaining
     * @throws {Error} If plugin ID is missing or already registered
     * @fires plugin:register
     */
    register(PluginClass) {
        if (typeof PluginClass !== 'function') {
            throw new TypeError('Plugin must be a class/constructor');
        }

        const id = PluginClass.id;
        if (!id) {
            throw new Error('Plugin must have a static "id" property');
        }

        if (this._plugin_classes.has(id)) {
            throw new Error(`Plugin '${id}' is already registered`);
        }

        this._plugin_classes.set(id, PluginClass);

        // Instantiate and install the plugin
        const instance = new PluginClass();
        this._plugins.set(id, instance);

        if (typeof instance.on_install === 'function') {
            instance.on_install(this._map);
        }

        this.emit('plugin:register', { plugin_id: id, plugin: instance });

        return this;
    }

    /**
     * Unregister and remove a plugin.
     *
     * @param {string} id - Plugin ID to remove
     * @returns {this} Returns this for chaining
     * @fires plugin:unregister
     */
    unregister(id) {
        const instance = this._plugins.get(id);

        if (instance) {
            if (typeof instance.on_uninstall === 'function') {
                instance.on_uninstall();
            }

            this._plugins.delete(id);
            this._plugin_classes.delete(id);

            this.emit('plugin:unregister', { plugin_id: id });
        }

        return this;
    }

    /**
     * Get a plugin instance by ID.
     *
     * @param {string} id - Plugin ID
     * @returns {Object|null} Plugin instance or null if not found
     */
    get(id) {
        return this._plugins.get(id) || null;
    }

    /**
     * Check if a plugin is registered.
     *
     * @param {string} id - Plugin ID
     * @returns {boolean} True if plugin is registered
     */
    has(id) {
        return this._plugins.has(id);
    }

    /**
     * Get all registered plugin IDs.
     *
     * @returns {Array<string>} Array of plugin IDs
     */
    list() {
        return Array.from(this._plugins.keys());
    }

    /**
     * Get all plugins of a specific type.
     *
     * @param {string} type - Plugin type (from PluginType enum)
     * @returns {Array<Object>} Array of plugin instances
     */
    get_by_type(type) {
        const result = [];
        for (const [id, instance] of this._plugins) {
            const PluginClass = this._plugin_classes.get(id);
            if (PluginClass && PluginClass.type === type) {
                result.push(instance);
            }
        }
        return result;
    }

    /**
     * Get plugin metadata.
     *
     * @param {string} id - Plugin ID
     * @returns {Object|null} Plugin metadata or null
     */
    get_metadata(id) {
        const PluginClass = this._plugin_classes.get(id);
        if (!PluginClass) return null;

        return {
            id: PluginClass.id,
            name: PluginClass.name || id,
            type: PluginClass.type || 'unknown',
            version: PluginClass.version || '1.0.0',
            description: PluginClass.description || ''
        };
    }

    /**
     * Call a method on all plugins of a specific type.
     *
     * @param {string} type - Plugin type
     * @param {string} method - Method name to call
     * @param {...*} args - Arguments to pass to the method
     */
    broadcast(type, method, ...args) {
        const plugins = this.get_by_type(type);
        for (const plugin of plugins) {
            if (typeof plugin[method] === 'function') {
                try {
                    plugin[method](...args);
                } catch (error) {
                    console.error(`Error calling ${method} on plugin:`, error);
                }
            }
        }
    }

    /**
     * Dispose all plugins and clean up.
     */
    dispose() {
        for (const id of this._plugins.keys()) {
            this.unregister(id);
        }

        this._plugins.clear();
        this._plugin_classes.clear();
        this.off_all();
    }
}

/**
 * Base Plugin class - all plugins should extend this.
 *
 * @abstract
 */
export class Plugin {
    /**
     * Plugin ID - must be unique. Override in subclass.
     * @type {string}
     */
    static get id() {
        throw new Error('Plugin must define static id property');
    }

    /**
     * Plugin type - one of PluginType values. Override in subclass.
     * @type {string}
     */
    static get type() {
        return 'unknown';
    }

    /**
     * Plugin name for display. Override in subclass.
     * @type {string}
     */
    static get name() {
        return this.id;
    }

    /**
     * Plugin version. Override in subclass.
     * @type {string}
     */
    static get version() {
        return '1.0.0';
    }

    /**
     * Plugin description. Override in subclass.
     * @type {string}
     */
    static get description() {
        return '';
    }

    constructor() {
        this._map = null;
        this._installed = false;
    }

    /**
     * Called when plugin is installed to a map.
     * Override in subclass to initialize plugin.
     *
     * @param {Object} map - The Osman instance
     */
    on_install(map) {
        this._map = map;
        this._installed = true;
    }

    /**
     * Called when plugin is uninstalled from a map.
     * Override in subclass to clean up resources.
     */
    on_uninstall() {
        this._map = null;
        this._installed = false;
    }

    /**
     * Check if plugin is currently installed.
     *
     * @returns {boolean} True if installed
     */
    is_installed() {
        return this._installed;
    }

    /**
     * Get the map this plugin is installed on.
     *
     * @returns {Object|null} The Osman instance or null
     */
    get_map() {
        return this._map;
    }
}
