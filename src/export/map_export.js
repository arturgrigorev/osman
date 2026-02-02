/**
 * MapExport - Export map to image formats
 *
 * Provides functionality to export the entire map or a selection
 * to various image formats (PNG, JPEG, WebP).
 *
 * @example
 * const exporter = new MapExport(map);
 *
 * // Export full map
 * exporter.export_map().then(blob => {
 *     download(blob, 'map.png');
 * });
 *
 * // Export region
 * const bounds = new Bounds([40.7, -74.1], [40.8, -73.9]);
 * exporter.export_region(bounds).then(blob => {
 *     download(blob, 'region.png');
 * });
 */

import { Bounds } from '../geo/bounds.js';

/**
 * Export format options.
 */
export const ExportFormat = {
    PNG: 'image/png',
    JPEG: 'image/jpeg',
    WEBP: 'image/webp'
};

/**
 * Default export options.
 */
const DEFAULT_OPTIONS = {
    format: ExportFormat.PNG,
    quality: 0.92,
    background_color: '#ffffff',
    include_tiles: true,
    include_overlays: true,
    include_markers: true,
    scale: 1,
    width: null,
    height: null
};

/**
 * MapExport class for exporting map imagery.
 */
export class MapExport {
    /**
     * Create a new MapExport instance.
     *
     * @param {Osman} map - Map instance to export from
     */
    constructor(map) {
        this._map = map;
    }

    /**
     * Export the entire visible map.
     *
     * @param {Object} [options] - Export options
     * @param {string} [options.format='image/png'] - Image format
     * @param {number} [options.quality=0.92] - Quality (0-1, for JPEG/WebP)
     * @param {string} [options.background_color='#ffffff'] - Background color
     * @param {number} [options.scale=1] - Scale multiplier
     * @returns {Promise<Blob>} Resolves with image blob
     */
    async export_map(options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const size = this._map.get_size();

        return this._render_to_blob({
            ...opts,
            width: opts.width || size.width,
            height: opts.height || size.height,
            bounds: this._map.get_bounds()
        });
    }

    /**
     * Export a specific geographic region.
     *
     * @param {Bounds|Array} bounds - Region bounds to export
     * @param {Object} [options] - Export options
     * @returns {Promise<Blob>} Resolves with image blob
     */
    async export_region(bounds, options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const b = Bounds.from(bounds);

        if (!b) {
            throw new Error('Invalid bounds');
        }

        // Calculate pixel dimensions from bounds
        const nw = this._map.latlng_to_pixel(b.northwest);
        const se = this._map.latlng_to_pixel(b.southeast);

        const width = Math.abs(se.x - nw.x);
        const height = Math.abs(se.y - nw.y);

        return this._render_region_to_blob({
            ...opts,
            bounds: b,
            x: Math.min(nw.x, se.x),
            y: Math.min(nw.y, se.y),
            width: opts.width || width,
            height: opts.height || height,
            source_width: width,
            source_height: height
        });
    }

    /**
     * Export map as data URL.
     *
     * @param {Object} [options] - Export options
     * @returns {Promise<string>} Resolves with data URL
     */
    async export_map_as_data_url(options = {}) {
        const blob = await this.export_map(options);
        return this._blob_to_data_url(blob);
    }

    /**
     * Export region as data URL.
     *
     * @param {Bounds|Array} bounds - Region bounds
     * @param {Object} [options] - Export options
     * @returns {Promise<string>} Resolves with data URL
     */
    async export_region_as_data_url(bounds, options = {}) {
        const blob = await this.export_region(bounds, options);
        return this._blob_to_data_url(blob);
    }

    /**
     * Download map as image file.
     *
     * @param {string} [filename='map.png'] - Download filename
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async download_map(filename = 'map.png', options = {}) {
        const blob = await this.export_map(options);
        this._download_blob(blob, filename);
    }

    /**
     * Download region as image file.
     *
     * @param {Bounds|Array} bounds - Region bounds
     * @param {string} [filename='region.png'] - Download filename
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async download_region(bounds, filename = 'region.png', options = {}) {
        const blob = await this.export_region(bounds, options);
        this._download_blob(blob, filename);
    }

    /**
     * Copy map image to clipboard.
     *
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async copy_map_to_clipboard(options = {}) {
        const blob = await this.export_map({ ...options, format: ExportFormat.PNG });
        await this._copy_to_clipboard(blob);
    }

    /**
     * Copy region image to clipboard.
     *
     * @param {Bounds|Array} bounds - Region bounds
     * @param {Object} [options] - Export options
     * @returns {Promise<void>}
     */
    async copy_region_to_clipboard(bounds, options = {}) {
        const blob = await this.export_region(bounds, { ...options, format: ExportFormat.PNG });
        await this._copy_to_clipboard(blob);
    }

    /**
     * Render map to blob.
     * @private
     */
    async _render_to_blob(opts) {
        const { width, height, scale, format, quality, background_color } = opts;

        // Create export canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = width * scale;
        canvas.height = height * scale;

        // Scale context
        if (scale !== 1) {
            ctx.scale(scale, scale);
        }

        // Fill background
        ctx.fillStyle = background_color;
        ctx.fillRect(0, 0, width, height);

        // Draw tile layer if present
        if (opts.include_tiles) {
            await this._draw_tiles(ctx, opts);
        }

        // Draw overlay canvas (vector layers, grids, etc.)
        if (opts.include_overlays) {
            this._draw_overlays(ctx, opts);
        }

        // Draw markers
        if (opts.include_markers) {
            await this._draw_markers(ctx, opts);
        }

        return this._canvas_to_blob(canvas, format, quality);
    }

    /**
     * Render region to blob.
     * @private
     */
    async _render_region_to_blob(opts) {
        const { x, y, width, height, source_width, source_height, scale, format, quality, background_color } = opts;

        // Create export canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = width * scale;
        canvas.height = height * scale;

        // Fill background
        ctx.fillStyle = background_color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale for output size
        const scale_x = width / source_width * scale;
        const scale_y = height / source_height * scale;
        ctx.scale(scale_x, scale_y);
        ctx.translate(-x, -y);

        // Draw tile layer if present
        if (opts.include_tiles) {
            await this._draw_tiles(ctx, opts);
        }

        // Draw overlay canvas
        if (opts.include_overlays) {
            this._draw_overlays_full(ctx);
        }

        // Draw markers
        if (opts.include_markers) {
            await this._draw_markers_full(ctx);
        }

        return this._canvas_to_blob(canvas, format, quality);
    }

    /**
     * Draw tile layer to canvas.
     * @private
     */
    async _draw_tiles(ctx, opts) {
        const tile_pane = this._map.get_pane('tile');
        if (!tile_pane) return;

        // Find tile images
        const tiles = tile_pane.querySelectorAll('img');
        const loaded_promises = [];

        for (const tile of tiles) {
            if (tile.complete && tile.naturalWidth > 0) {
                this._draw_tile(ctx, tile);
            } else {
                loaded_promises.push(this._wait_for_tile(tile).then(() => {
                    this._draw_tile(ctx, tile);
                }));
            }
        }

        await Promise.all(loaded_promises);
    }

    /**
     * Draw single tile to canvas.
     * @private
     */
    _draw_tile(ctx, tile) {
        const rect = tile.getBoundingClientRect();
        const container_rect = this._map.get_container().getBoundingClientRect();

        const x = rect.left - container_rect.left;
        const y = rect.top - container_rect.top;

        try {
            ctx.drawImage(tile, x, y, rect.width, rect.height);
        } catch (e) {
            // CORS or other error - skip tile
        }
    }

    /**
     * Wait for tile to load.
     * @private
     */
    _wait_for_tile(tile) {
        return new Promise((resolve) => {
            if (tile.complete) {
                resolve();
                return;
            }
            tile.addEventListener('load', resolve, { once: true });
            tile.addEventListener('error', resolve, { once: true });
        });
    }

    /**
     * Draw overlay layers to canvas.
     * @private
     */
    _draw_overlays(ctx, opts) {
        // Draw main canvas content
        const map_canvas = this._map.get_canvas();
        if (map_canvas) {
            ctx.drawImage(map_canvas, 0, 0, opts.width, opts.height);
        }

        // Draw any additional canvas elements in overlay pane
        const overlay_pane = this._map.get_pane('overlay');
        if (overlay_pane) {
            const canvases = overlay_pane.querySelectorAll('canvas');
            for (const canvas of canvases) {
                if (canvas !== map_canvas) {
                    ctx.drawImage(canvas, 0, 0);
                }
            }
        }
    }

    /**
     * Draw overlay layers at full resolution.
     * @private
     */
    _draw_overlays_full(ctx) {
        // Draw main canvas
        const map_canvas = this._map.get_canvas();
        if (map_canvas) {
            ctx.drawImage(map_canvas, 0, 0);
        }

        // Draw additional canvases
        const overlay_pane = this._map.get_pane('overlay');
        if (overlay_pane) {
            const canvases = overlay_pane.querySelectorAll('canvas');
            for (const canvas of canvases) {
                if (canvas !== map_canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const container_rect = this._map.get_container().getBoundingClientRect();
                    const x = rect.left - container_rect.left;
                    const y = rect.top - container_rect.top;
                    ctx.drawImage(canvas, x, y);
                }
            }
        }
    }

    /**
     * Draw markers to canvas.
     * @private
     */
    async _draw_markers(ctx, opts) {
        const marker_pane = this._map.get_pane('marker');
        if (!marker_pane) return;

        // Use html2canvas-like approach for markers
        const markers = marker_pane.querySelectorAll('.um-marker');
        const container_rect = this._map.get_container().getBoundingClientRect();

        for (const marker of markers) {
            await this._draw_marker_element(ctx, marker, container_rect);
        }
    }

    /**
     * Draw markers at full resolution.
     * @private
     */
    async _draw_markers_full(ctx) {
        const marker_pane = this._map.get_pane('marker');
        if (!marker_pane) return;

        const markers = marker_pane.querySelectorAll('.um-marker');
        const container_rect = this._map.get_container().getBoundingClientRect();

        for (const marker of markers) {
            await this._draw_marker_element(ctx, marker, container_rect);
        }
    }

    /**
     * Draw a single marker element.
     * @private
     */
    async _draw_marker_element(ctx, marker, container_rect) {
        const rect = marker.getBoundingClientRect();
        const x = rect.left - container_rect.left;
        const y = rect.top - container_rect.top;

        // Check for SVG content
        const svg = marker.querySelector('svg');
        if (svg) {
            await this._draw_svg(ctx, svg, x, y, rect.width, rect.height);
            return;
        }

        // Check for image
        const img = marker.querySelector('img');
        if (img && img.complete) {
            ctx.drawImage(img, x, y, rect.width, rect.height);
            return;
        }

        // Fallback: draw as colored circle
        const style = window.getComputedStyle(marker);
        const bg_color = style.backgroundColor || '#3498db';

        ctx.fillStyle = bg_color;
        ctx.beginPath();
        ctx.arc(x + rect.width / 2, y + rect.height / 2, Math.min(rect.width, rect.height) / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draw SVG element to canvas.
     * @private
     */
    async _draw_svg(ctx, svg, x, y, width, height) {
        const serializer = new XMLSerializer();
        const svg_string = serializer.serializeToString(svg);
        const blob = new Blob([svg_string], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        try {
            const img = await this._load_image(url);
            ctx.drawImage(img, x, y, width, height);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Load image from URL.
     * @private
     */
    _load_image(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    /**
     * Convert canvas to blob.
     * @private
     */
    _canvas_to_blob(canvas, format, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                format,
                quality
            );
        });
    }

    /**
     * Convert blob to data URL.
     * @private
     */
    _blob_to_data_url(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Download blob as file.
     * @private
     */
    _download_blob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Copy blob to clipboard.
     * @private
     */
    async _copy_to_clipboard(blob) {
        if (!navigator.clipboard || !navigator.clipboard.write) {
            throw new Error('Clipboard API not supported');
        }

        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
    }
}

/**
 * Selection export helper for interactive region selection.
 */
export class SelectionExport {
    /**
     * Create a selection export helper.
     *
     * @param {Osman} map - Map instance
     */
    constructor(map) {
        this._map = map;
        this._exporter = new MapExport(map);
        this._selection_box = null;
        this._start_point = null;
        this._enabled = false;
        this._callback = null;

        this._on_mouse_down = this._on_mouse_down.bind(this);
        this._on_mouse_move = this._on_mouse_move.bind(this);
        this._on_mouse_up = this._on_mouse_up.bind(this);
    }

    /**
     * Enable selection mode.
     *
     * @param {Function} callback - Called with bounds when selection is made
     * @returns {this}
     */
    enable(callback) {
        if (this._enabled) return this;

        this._enabled = true;
        this._callback = callback;

        const container = this._map.get_container();
        container.addEventListener('mousedown', this._on_mouse_down);
        container.style.cursor = 'crosshair';

        return this;
    }

    /**
     * Disable selection mode.
     *
     * @returns {this}
     */
    disable() {
        if (!this._enabled) return this;

        this._enabled = false;
        this._callback = null;

        const container = this._map.get_container();
        container.removeEventListener('mousedown', this._on_mouse_down);
        container.style.cursor = '';

        this._remove_selection_box();

        return this;
    }

    /**
     * Check if selection mode is enabled.
     *
     * @returns {boolean}
     */
    is_enabled() {
        return this._enabled;
    }

    /**
     * Export selection interactively.
     *
     * @param {Object} [options] - Export options
     * @returns {Promise<Blob>} Resolves with image blob when selection is made
     */
    select_and_export(options = {}) {
        return new Promise((resolve, reject) => {
            this.enable(async (bounds) => {
                this.disable();
                try {
                    const blob = await this._exporter.export_region(bounds, options);
                    resolve(blob);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    /**
     * Handle mouse down.
     * @private
     */
    _on_mouse_down(e) {
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = this._map.get_container().getBoundingClientRect();
        this._start_point = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        this._create_selection_box();

        document.addEventListener('mousemove', this._on_mouse_move);
        document.addEventListener('mouseup', this._on_mouse_up);
    }

    /**
     * Handle mouse move.
     * @private
     */
    _on_mouse_move(e) {
        if (!this._start_point) return;

        const rect = this._map.get_container().getBoundingClientRect();
        const current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const x = Math.min(this._start_point.x, current.x);
        const y = Math.min(this._start_point.y, current.y);
        const width = Math.abs(current.x - this._start_point.x);
        const height = Math.abs(current.y - this._start_point.y);

        this._selection_box.style.left = x + 'px';
        this._selection_box.style.top = y + 'px';
        this._selection_box.style.width = width + 'px';
        this._selection_box.style.height = height + 'px';
    }

    /**
     * Handle mouse up.
     * @private
     */
    _on_mouse_up(e) {
        document.removeEventListener('mousemove', this._on_mouse_move);
        document.removeEventListener('mouseup', this._on_mouse_up);

        if (!this._start_point) return;

        const rect = this._map.get_container().getBoundingClientRect();
        const end_point = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Calculate bounds
        const min_x = Math.min(this._start_point.x, end_point.x);
        const min_y = Math.min(this._start_point.y, end_point.y);
        const max_x = Math.max(this._start_point.x, end_point.x);
        const max_y = Math.max(this._start_point.y, end_point.y);

        // Require minimum selection size
        if (max_x - min_x < 10 || max_y - min_y < 10) {
            this._remove_selection_box();
            this._start_point = null;
            return;
        }

        // Convert to geographic bounds
        const sw = this._map.pixel_to_latlng({ x: min_x, y: max_y });
        const ne = this._map.pixel_to_latlng({ x: max_x, y: min_y });
        const bounds = new Bounds(sw, ne);

        this._remove_selection_box();
        this._start_point = null;

        if (this._callback) {
            this._callback(bounds);
        }
    }

    /**
     * Create selection box element.
     * @private
     */
    _create_selection_box() {
        this._selection_box = document.createElement('div');
        this._selection_box.className = 'um-selection-box';
        this._selection_box.style.cssText = `
            position: absolute;
            border: 2px dashed #3498db;
            background: rgba(52, 152, 219, 0.2);
            pointer-events: none;
            z-index: 10000;
        `;
        this._map.get_container().appendChild(this._selection_box);
    }

    /**
     * Remove selection box element.
     * @private
     */
    _remove_selection_box() {
        if (this._selection_box && this._selection_box.parentNode) {
            this._selection_box.parentNode.removeChild(this._selection_box);
        }
        this._selection_box = null;
    }
}
