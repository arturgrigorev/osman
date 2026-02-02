/**
 * TileLayer - Basemap tile layer
 *
 * Renders raster tiles from a tile server (OSM, Mapbox, etc.).
 * Supports standard XYZ tile URL templates.
 *
 * @example
 * const osm = new TileLayer('osm');
 * osm.add_to(map);
 *
 * // Custom tile server
 * const custom = new TileLayer('https://tiles.example.com/{z}/{x}/{y}.png', {
 *     attribution: '&copy; Example'
 * });
 */

import { Layer } from './layer.js';
import { merge_options } from '../core/options.js';

/**
 * Built-in tile providers.
 */
const TILE_PROVIDERS = {
    osm: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        max_zoom: 19
    },
    osm_hot: {
        url: 'https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
        max_zoom: 19
    },
    carto_light: {
        url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        max_zoom: 19
    },
    carto_dark: {
        url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        max_zoom: 19
    },
    stamen_toner: {
        url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
        attribution: '&copy; Stadia Maps &copy; Stamen Design &copy; OpenMapTiles &copy; OpenStreetMap',
        max_zoom: 18
    },
    stamen_terrain: {
        url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
        attribution: '&copy; Stadia Maps &copy; Stamen Design &copy; OpenMapTiles &copy; OpenStreetMap',
        max_zoom: 18
    }
};

/**
 * Default tile layer options.
 */
const DEFAULT_OPTIONS = {
    min_zoom: 0,
    max_zoom: 18,
    tile_size: 256,
    subdomains: 'abc',
    error_tile_url: null,
    cross_origin: 'anonymous',
    update_when_idle: false,
    update_when_zooming: true,
    keep_buffer: 2
};

/**
 * TileLayer class for raster basemaps.
 */
export class TileLayer extends Layer {
    /**
     * Create a new TileLayer.
     *
     * @param {string} url_or_provider - URL template or provider name
     * @param {Object} [options] - Tile layer options
     */
    constructor(url_or_provider, options = {}) {
        // Check if it's a built-in provider
        const provider = TILE_PROVIDERS[url_or_provider];
        if (provider) {
            options = merge_options(provider, options);
            url_or_provider = provider.url;
        }

        super(merge_options(DEFAULT_OPTIONS, options));

        this._url = url_or_provider;
        this._tiles = new Map();
        this._loading = new Set();
        this._container = null;
        this._subdomain_index = 0;
    }

    // ==================== Lifecycle ====================

    /**
     * Called when layer is added to a map.
     *
     * @param {Osman} map - The map instance
     */
    on_add(map) {
        super.on_add(map);

        // Create tile container
        this._container = document.createElement('div');
        this._container.className = 'um-tile-container';
        this._container.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden;';

        const tile_pane = map.get_pane('tile');
        if (tile_pane) {
            tile_pane.appendChild(this._container);
        }

        this._update_tiles();
    }

    /**
     * Called when layer is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        // Clear tiles
        this._clear_tiles();

        // Remove container
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._container = null;

        super.on_remove(map);
    }

    // ==================== Tile Management ====================

    /**
     * Update visible tiles.
     *
     * @param {Transform} [transform] - Current transform
     */
    update(transform) {
        if (!this._map || !this._container) return;

        this._update_tiles();
    }

    /**
     * Update tiles based on current view.
     * @private
     */
    _update_tiles() {
        const transform = this._map._viewport.get_transform();
        const zoom = Math.round(transform.get_zoom());

        // Clamp to min/max zoom
        const tile_zoom = Math.max(
            this._options.min_zoom,
            Math.min(this._options.max_zoom, zoom)
        );

        // Get visible tiles
        const visible_tiles = transform.get_visible_tiles();
        const visible_set = new Set();

        // Create/update visible tiles
        for (const { x, y, z } of visible_tiles) {
            // Adjust for zoom level difference
            const adjusted_z = tile_zoom;
            const scale = Math.pow(2, z - adjusted_z);
            const adjusted_x = Math.floor(x / scale);
            const adjusted_y = Math.floor(y / scale);

            const key = `${adjusted_z}/${adjusted_x}/${adjusted_y}`;
            visible_set.add(key);

            if (!this._tiles.has(key)) {
                this._load_tile(adjusted_x, adjusted_y, adjusted_z);
            }
        }

        // Remove tiles outside buffer
        const buffer = this._options.keep_buffer;
        for (const [key, tile] of this._tiles) {
            if (!visible_set.has(key) && tile.loaded) {
                // Check if within buffer
                const [z, x, y] = key.split('/').map(Number);
                let keep = false;

                for (const vis_key of visible_set) {
                    const [vz, vx, vy] = vis_key.split('/').map(Number);
                    if (z === vz &&
                        Math.abs(x - vx) <= buffer &&
                        Math.abs(y - vy) <= buffer) {
                        keep = true;
                        break;
                    }
                }

                if (!keep) {
                    this._remove_tile(key);
                }
            }
        }

        // Position tiles
        this._position_tiles(transform);
    }

    /**
     * Load a tile.
     * @private
     */
    _load_tile(x, y, z) {
        const key = `${z}/${x}/${y}`;
        if (this._tiles.has(key) || this._loading.has(key)) return;

        this._loading.add(key);

        const img = document.createElement('img');
        img.className = 'um-tile';
        img.style.cssText = 'position: absolute; opacity: 0; transition: opacity 0.2s;';
        img.crossOrigin = this._options.cross_origin;

        const tile = {
            element: img,
            x, y, z,
            loaded: false
        };

        img.onload = () => {
            this._loading.delete(key);
            tile.loaded = true;
            img.style.opacity = this._opacity;
            this.emit('layer:tile_load', { x, y, z });
        };

        img.onerror = () => {
            this._loading.delete(key);
            tile.loaded = true;

            if (this._options.error_tile_url) {
                img.src = this._options.error_tile_url;
            } else {
                img.style.display = 'none';
            }

            this.emit('layer:tile_error', { x, y, z });
        };

        img.src = this._get_tile_url(x, y, z);

        this._tiles.set(key, tile);
        this._container.appendChild(img);
    }

    /**
     * Remove a tile.
     * @private
     */
    _remove_tile(key) {
        const tile = this._tiles.get(key);
        if (tile) {
            if (tile.element.parentNode) {
                tile.element.parentNode.removeChild(tile.element);
            }
            this._tiles.delete(key);
        }
    }

    /**
     * Clear all tiles.
     * @private
     */
    _clear_tiles() {
        for (const key of this._tiles.keys()) {
            this._remove_tile(key);
        }
        this._tiles.clear();
        this._loading.clear();
    }

    /**
     * Position all tiles based on current transform.
     * @private
     */
    _position_tiles(transform) {
        const tile_size = this._options.tile_size;
        const zoom = transform.get_zoom();

        for (const [key, tile] of this._tiles) {
            const scale = Math.pow(2, zoom - tile.z);
            const size = tile_size * scale;

            // Calculate world position
            const world_x = tile.x * tile_size * scale;
            const world_y = tile.y * tile_size * scale;

            // Convert to container position
            const origin = transform._origin;
            const left = world_x - origin.x;
            const top = world_y - origin.y;

            tile.element.style.left = `${left}px`;
            tile.element.style.top = `${top}px`;
            tile.element.style.width = `${size}px`;
            tile.element.style.height = `${size}px`;
        }
    }

    /**
     * Get tile URL.
     * @private
     */
    _get_tile_url(x, y, z) {
        let url = this._url;

        // Replace placeholders
        url = url.replace('{z}', z);
        url = url.replace('{x}', x);
        url = url.replace('{y}', y);

        // Handle subdomains
        if (url.includes('{s}')) {
            const subdomains = this._options.subdomains;
            const subdomain = subdomains[this._subdomain_index % subdomains.length];
            this._subdomain_index++;
            url = url.replace('{s}', subdomain);
        }

        return url;
    }

    // ==================== Visibility ====================

    /**
     * Show the layer.
     *
     * @returns {this} Returns this for chaining
     */
    show() {
        super.show();
        if (this._container) {
            this._container.style.display = '';
        }
        return this;
    }

    /**
     * Hide the layer.
     *
     * @returns {this} Returns this for chaining
     */
    hide() {
        super.hide();
        if (this._container) {
            this._container.style.display = 'none';
        }
        return this;
    }

    // ==================== Opacity ====================

    /**
     * Set layer opacity.
     *
     * @param {number} opacity - Opacity (0-1)
     * @returns {this} Returns this for chaining
     */
    set_opacity(opacity) {
        super.set_opacity(opacity);

        for (const tile of this._tiles.values()) {
            if (tile.loaded) {
                tile.element.style.opacity = this._opacity;
            }
        }

        return this;
    }

    // ==================== URL ====================

    /**
     * Set tile URL template.
     *
     * @param {string} url - URL template
     * @returns {this} Returns this for chaining
     */
    set_url(url) {
        this._url = url;
        this._clear_tiles();
        this._update_tiles();
        return this;
    }

    /**
     * Get tile URL template.
     *
     * @returns {string} URL template
     */
    get_url() {
        return this._url;
    }

    // ==================== TileLayer doesn't render to canvas ====================

    /**
     * TileLayer uses DOM tiles, not canvas rendering.
     */
    render(ctx, transform) {
        // No-op: tiles are DOM elements
    }

    // ==================== Static Methods ====================

    /**
     * Get available built-in providers.
     *
     * @returns {Array<string>} Provider names
     */
    static get_providers() {
        return Object.keys(TILE_PROVIDERS);
    }

    /**
     * Get provider info.
     *
     * @param {string} name - Provider name
     * @returns {Object|null} Provider info or null
     */
    static get_provider(name) {
        return TILE_PROVIDERS[name] || null;
    }
}
