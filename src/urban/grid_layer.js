/**
 * GridLayer - Grid visualization for spatial analysis
 *
 * Provides hexagonal and square grid overlays for urban analysis,
 * with support for data binding and choropleth visualization.
 *
 * @example
 * const grid = new GridLayer({
 *     type: 'hex',
 *     size: 500,  // meters
 *     style: { stroke: '#333', fill: '#3498db', fill_opacity: 0.3 }
 * });
 * grid.add_to(map);
 *
 * // Bind data to cells
 * grid.set_data(data, {
 *     value_fn: (d) => d.population,
 *     color_scale: ColorScale.sequential('viridis')
 * });
 */

import { Layer } from '../layer/layer.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { deep_merge } from '../core/utils.js';

/**
 * Grid type constants.
 */
export const GridType = {
    SQUARE: 'square',
    HEX: 'hex',
    HEX_FLAT: 'hex_flat'  // Flat-topped hexagons
};

/**
 * Default grid options.
 */
const DEFAULT_OPTIONS = {
    type: GridType.HEX,
    size: 1000,  // Cell size in meters
    stroke: '#666666',
    stroke_width: 1,
    stroke_opacity: 0.8,
    fill: '#3498db',
    fill_opacity: 0.2,
    interactive: true,
    show_labels: false,
    label_fn: null,  // (cell) => string
    min_zoom: 0,
    max_zoom: 22
};

/**
 * GridLayer class for grid-based spatial visualization.
 */
export class GridLayer extends Layer {
    /**
     * Create a new GridLayer.
     *
     * @param {Object} [options] - Grid options
     */
    constructor(options = {}) {
        super(options);

        this._options = deep_merge({}, DEFAULT_OPTIONS, options);
        this._cells = new Map();  // cell_id -> cell data
        this._data = null;
        this._color_scale = null;
        this._value_fn = null;
        this._canvas = null;
        this._ctx = null;
        this._needs_redraw = true;

        // Performance optimizations
        this._last_zoom = null;
        this._last_bounds_key = null;
        this._render_frame = null;
        this._pixel_cache = new Map();  // cell_id -> pixel points
        this._throttle_timeout = null;
        this._throttle_delay = 16;  // ~60fps

        // Precompute hex corner angles
        this._hex_angles_pointy = [];
        this._hex_angles_flat = [];
        for (let i = 0; i < 6; i++) {
            this._hex_angles_pointy.push((30 + i * 60) * Math.PI / 180);
            this._hex_angles_flat.push((i * 60) * Math.PI / 180);
        }
    }

    /**
     * Called when layer is added to map.
     *
     * @param {Osman} map - Map instance
     */
    on_add(map) {
        super.on_add(map);

        // Create canvas
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'urban-grid-layer';
        this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        this._ctx = this._canvas.getContext('2d');

        map._vector_container.appendChild(this._canvas);

        // Bind events
        this._on_resize = this._on_resize.bind(this);
        this._on_viewchange = this._on_viewchange.bind(this);

        map.on('map:resize', this._on_resize);
        map.on('map:move', this._on_viewchange);
        map.on('map:zoom', this._on_viewchange);

        if (this._options.interactive) {
            this._on_click = this._on_click.bind(this);
            map.on('map:click', this._on_click);
        }

        this._resize_canvas();
        this._generate_cells();
        this._render();
    }

    /**
     * Called when layer is removed from map.
     */
    on_remove() {
        // Cancel pending operations
        if (this._throttle_timeout) {
            clearTimeout(this._throttle_timeout);
            this._throttle_timeout = null;
        }
        if (this._render_frame) {
            cancelAnimationFrame(this._render_frame);
            this._render_frame = null;
        }

        if (this._map) {
            this._map.off('map:resize', this._on_resize);
            this._map.off('map:move', this._on_viewchange);
            this._map.off('map:zoom', this._on_viewchange);

            if (this._options.interactive) {
                this._map.off('map:click', this._on_click);
            }
        }

        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }

        this._canvas = null;
        this._ctx = null;
        this._pixel_cache.clear();

        super.on_remove();
    }

    /**
     * Set grid data for visualization.
     *
     * @param {Array} data - Array of data items
     * @param {Object} options - Data options
     * @param {Function} options.value_fn - Function to extract value from data item
     * @param {Function} [options.location_fn] - Function to get [lat, lng] from data item
     * @param {ColorScale} [options.color_scale] - Color scale for values
     * @returns {this} Returns this for chaining
     */
    set_data(data, options = {}) {
        this._data = data;
        this._value_fn = options.value_fn;
        this._color_scale = options.color_scale;
        this._location_fn = options.location_fn || (d => [d.lat, d.lng]);

        this._bind_data_to_cells();

        this._needs_redraw = true;
        this._schedule_render();

        return this;
    }

    /**
     * Clear all data.
     *
     * @returns {this} Returns this for chaining
     */
    clear_data() {
        this._data = null;

        for (const cell of this._cells.values()) {
            cell.value = 0;
            cell.items = [];
        }

        this._needs_redraw = true;
        this._render();

        return this;
    }

    /**
     * Get cell at a specific location.
     *
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Object|null} Cell data or null
     */
    get_cell_at(lat, lng) {
        const cell_id = this._get_cell_id(lat, lng);
        return this._cells.get(cell_id) || null;
    }

    /**
     * Get all cells.
     *
     * @returns {Array} Array of cell objects
     */
    get_cells() {
        return Array.from(this._cells.values());
    }

    /**
     * Set grid size.
     *
     * @param {number} size - Cell size in meters
     * @returns {this} Returns this for chaining
     */
    set_size(size) {
        this._options.size = size;
        this._generate_cells();
        this._render();
        return this;
    }

    /**
     * Set grid type.
     *
     * @param {string} type - Grid type ('hex', 'hex_flat', 'square')
     * @returns {this} Returns this for chaining
     */
    set_type(type) {
        this._options.type = type;
        this._generate_cells();
        this._render();
        return this;
    }

    /**
     * Resize canvas to match map.
     * @private
     */
    _resize_canvas() {
        if (!this._map || !this._canvas) return;

        const size = this._map.get_size();
        const ratio = window.devicePixelRatio || 1;

        this._canvas.width = size.width * ratio;
        this._canvas.height = size.height * ratio;
        this._canvas.style.width = size.width + 'px';
        this._canvas.style.height = size.height + 'px';

        this._ctx.scale(ratio, ratio);
        this._needs_redraw = true;
    }

    /**
     * Handle resize event.
     * @private
     */
    _on_resize() {
        this._resize_canvas();
        this._generate_cells();
        this._render();
    }

    /**
     * Handle view change with throttling and smart regeneration.
     * @private
     */
    _on_viewchange() {
        // Cancel pending render
        if (this._throttle_timeout) {
            clearTimeout(this._throttle_timeout);
        }

        // Throttle updates
        this._throttle_timeout = setTimeout(() => {
            this._throttle_timeout = null;

            const zoom = this._map.get_zoom();
            const bounds = this._map.get_bounds();

            // Create bounds key for comparison (rounded to reduce updates)
            const bounds_key = `${Math.round(bounds.south * 100)}_${Math.round(bounds.west * 100)}_${Math.round(bounds.north * 100)}_${Math.round(bounds.east * 100)}`;

            // Only regenerate cells if zoom changed or bounds changed significantly
            const zoom_changed = Math.abs(zoom - (this._last_zoom || zoom)) > 0.01;
            const bounds_changed = bounds_key !== this._last_bounds_key;

            if (zoom_changed || bounds_changed) {
                this._last_zoom = zoom;
                this._last_bounds_key = bounds_key;
                this._pixel_cache.clear();
                this._generate_cells();

                // Re-bind data if present
                if (this._data && this._value_fn) {
                    this._bind_data_to_cells();
                }
            }

            this._schedule_render();
        }, this._throttle_delay);
    }

    /**
     * Schedule a render on next animation frame.
     * @private
     */
    _schedule_render() {
        if (this._render_frame) return;

        this._render_frame = requestAnimationFrame(() => {
            this._render_frame = null;
            this._render();
        });
    }

    /**
     * Bind data to cells (extracted for reuse).
     * @private
     */
    _bind_data_to_cells() {
        const location_fn = this._location_fn || (d => [d.lat, d.lng]);

        // Clear cell values
        for (const cell of this._cells.values()) {
            cell.value = 0;
            cell.items = [];
        }

        // Aggregate data
        for (const item of this._data) {
            const [lat, lng] = location_fn(item);
            const cell_id = this._get_cell_id(lat, lng);
            const cell = this._cells.get(cell_id);

            if (cell) {
                const value = this._value_fn ? this._value_fn(item) : 1;
                cell.value += value;
                cell.items.push(item);
            }
        }
    }

    /**
     * Handle click event.
     * @private
     */
    _on_click(e) {
        const cell = this.get_cell_at(e.latlng.lat, e.latlng.lng);

        if (cell) {
            this.emit('cell:click', {
                cell,
                latlng: e.latlng,
                original_event: e.original_event
            });
        }
    }

    /**
     * Generate grid cells for current view.
     * @private
     */
    _generate_cells() {
        if (!this._map) return;

        const bounds = this._map.get_bounds();
        const zoom = this._map.get_zoom();

        // Check zoom constraints
        if (zoom < this._options.min_zoom || zoom > this._options.max_zoom) {
            this._cells.clear();
            return;
        }

        // Expand bounds slightly for cells at edges
        const expanded = bounds.pad(0.1);

        this._cells.clear();

        if (this._options.type === GridType.SQUARE) {
            this._generate_square_cells(expanded);
        } else {
            this._generate_hex_cells(expanded);
        }
    }

    /**
     * Generate square grid cells.
     * @private
     */
    _generate_square_cells(bounds) {
        const size = this._options.size;
        const center_lat = (bounds.north + bounds.south) / 2;

        // Calculate approximate degrees per meter at center
        const meters_per_deg_lat = 111320;
        const meters_per_deg_lng = 111320 * Math.cos(center_lat * Math.PI / 180);

        const lat_step = size / meters_per_deg_lat;
        const lng_step = size / meters_per_deg_lng;

        // Start from rounded position
        const start_lat = Math.floor(bounds.south / lat_step) * lat_step;
        const start_lng = Math.floor(bounds.west / lng_step) * lng_step;

        for (let lat = start_lat; lat <= bounds.north + lat_step; lat += lat_step) {
            for (let lng = start_lng; lng <= bounds.east + lng_step; lng += lng_step) {
                const cell_id = `${Math.round(lat / lat_step)}_${Math.round(lng / lng_step)}`;

                const corners = [
                    new LatLng(lat, lng),
                    new LatLng(lat, lng + lng_step),
                    new LatLng(lat + lat_step, lng + lng_step),
                    new LatLng(lat + lat_step, lng)
                ];

                this._cells.set(cell_id, {
                    id: cell_id,
                    center: new LatLng(lat + lat_step / 2, lng + lng_step / 2),
                    corners,
                    value: 0,
                    items: []
                });
            }
        }
    }

    /**
     * Generate hexagonal grid cells.
     * @private
     */
    _generate_hex_cells(bounds) {
        const size = this._options.size;
        const flat = this._options.type === GridType.HEX_FLAT;
        const center_lat = (bounds.north + bounds.south) / 2;

        // Calculate hex dimensions
        const meters_per_deg_lat = 111320;
        const meters_per_deg_lng = 111320 * Math.cos(center_lat * Math.PI / 180);

        let hex_width, hex_height, row_height, col_width;

        if (flat) {
            // Flat-topped hexagons
            hex_width = size * 2;
            hex_height = size * Math.sqrt(3);
            row_height = hex_height;
            col_width = hex_width * 0.75;
        } else {
            // Pointy-topped hexagons
            hex_width = size * Math.sqrt(3);
            hex_height = size * 2;
            row_height = hex_height * 0.75;
            col_width = hex_width;
        }

        const lat_step = row_height / meters_per_deg_lat;
        const lng_step = col_width / meters_per_deg_lng;

        // Start from rounded position
        const start_row = Math.floor(bounds.south / lat_step);
        const start_col = Math.floor(bounds.west / lng_step);

        for (let row = start_row; row <= Math.ceil(bounds.north / lat_step) + 1; row++) {
            for (let col = start_col; col <= Math.ceil(bounds.east / lng_step) + 1; col++) {
                const cell_id = `${row}_${col}`;

                let center_lat_deg, center_lng_deg;

                if (flat) {
                    // Flat-topped: columns offset vertically
                    center_lat_deg = row * lat_step + (col % 2 === 0 ? 0 : lat_step / 2);
                    center_lng_deg = col * lng_step;
                } else {
                    // Pointy-topped: rows offset horizontally
                    center_lat_deg = row * lat_step;
                    center_lng_deg = col * lng_step + (row % 2 === 0 ? 0 : lng_step / 2);
                }

                const corners = this._get_hex_corners(
                    center_lat_deg,
                    center_lng_deg,
                    size,
                    meters_per_deg_lat,
                    meters_per_deg_lng,
                    flat
                );

                this._cells.set(cell_id, {
                    id: cell_id,
                    row,
                    col,
                    center: new LatLng(center_lat_deg, center_lng_deg),
                    corners,
                    value: 0,
                    items: []
                });
            }
        }
    }

    /**
     * Get hexagon corner coordinates.
     * @private
     */
    _get_hex_corners(center_lat, center_lng, size, meters_per_deg_lat, meters_per_deg_lng, flat) {
        const corners = [];
        const start_angle = flat ? 0 : 30;

        for (let i = 0; i < 6; i++) {
            const angle = (start_angle + i * 60) * Math.PI / 180;
            const dx = size * Math.cos(angle);
            const dy = size * Math.sin(angle);

            corners.push(new LatLng(
                center_lat + dy / meters_per_deg_lat,
                center_lng + dx / meters_per_deg_lng
            ));
        }

        return corners;
    }

    /**
     * Get cell ID for a location.
     * @private
     */
    _get_cell_id(lat, lng) {
        // Find cell containing this point
        for (const [id, cell] of this._cells) {
            if (this._point_in_polygon(lat, lng, cell.corners)) {
                return id;
            }
        }
        return null;
    }

    /**
     * Check if point is in polygon.
     * @private
     */
    _point_in_polygon(lat, lng, corners) {
        let inside = false;
        const n = corners.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const yi = corners[i].lat;
            const xi = corners[i].lng;
            const yj = corners[j].lat;
            const xj = corners[j].lng;

            if (((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Render the grid.
     * @private
     */
    _render() {
        if (!this._ctx || !this._map) return;

        const ctx = this._ctx;
        const size = this._map.get_size();
        const padding = 50;  // Padding for cells partially visible

        // Clear canvas using fast reset
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const ratio = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, size.width * ratio, size.height * ratio);
        ctx.scale(ratio, ratio);

        if (!this._visible) return;

        // Get value range for coloring (only if color scale is set)
        if (this._color_scale) {
            let min_value = Infinity;
            let max_value = -Infinity;

            for (const cell of this._cells.values()) {
                if (cell.value > 0) {
                    if (cell.value < min_value) min_value = cell.value;
                    if (cell.value > max_value) max_value = cell.value;
                }
            }

            if (min_value === Infinity) {
                min_value = 0;
                max_value = 1;
            }

            this._color_scale.set_domain(min_value, max_value);
        }

        // Batch render: group by color for fewer state changes
        const default_cells = [];
        const colored_cells = new Map();  // color -> cells

        for (const cell of this._cells.values()) {
            // Get cached pixel points or compute
            let points = this._pixel_cache.get(cell.id);
            if (!points) {
                points = cell.corners.map(c => this._map.latlng_to_point(c));
                this._pixel_cache.set(cell.id, points);
            }

            // Viewport culling - skip cells entirely outside view
            let visible = false;
            for (const p of points) {
                if (p.x >= -padding && p.x <= size.width + padding &&
                    p.y >= -padding && p.y <= size.height + padding) {
                    visible = true;
                    break;
                }
            }
            if (!visible) continue;

            // Group by color
            if (this._color_scale && cell.value > 0) {
                const color = this._color_scale.get_color(cell.value);
                if (!colored_cells.has(color)) {
                    colored_cells.set(color, []);
                }
                colored_cells.get(color).push({ cell, points });
            } else {
                default_cells.push({ cell, points });
            }
        }

        // Draw default colored cells first (batched)
        if (default_cells.length > 0) {
            this._draw_cell_batch(ctx, default_cells, this._options.fill);
        }

        // Draw colored cells (batched by color)
        for (const [color, cells] of colored_cells) {
            this._draw_cell_batch(ctx, cells, color);
        }

        // Draw labels last (on top)
        if (this._options.show_labels) {
            ctx.globalAlpha = this._opacity;
            ctx.fillStyle = '#000';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (const { cell, points } of [...default_cells, ...Array.from(colored_cells.values()).flat()]) {
                const label = this._options.label_fn
                    ? this._options.label_fn(cell)
                    : (cell.value > 0 ? cell.value.toString() : '');

                if (label) {
                    // Calculate center from cached points
                    let cx = 0, cy = 0;
                    for (const p of points) {
                        cx += p.x;
                        cy += p.y;
                    }
                    cx /= points.length;
                    cy /= points.length;
                    ctx.fillText(label, cx, cy);
                }
            }
        }

        ctx.globalAlpha = 1;
        this._needs_redraw = false;
    }

    /**
     * Draw a batch of cells with the same fill color.
     * @private
     */
    _draw_cell_batch(ctx, cells, fill_color) {
        const fill_opacity = this._opacity * this._options.fill_opacity;
        const stroke_opacity = this._opacity * this._options.stroke_opacity;

        // Draw all fills first
        ctx.fillStyle = fill_color;
        ctx.globalAlpha = fill_opacity;
        ctx.beginPath();

        for (const { points } of cells) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
        }
        ctx.fill();

        // Draw all strokes
        ctx.strokeStyle = this._options.stroke;
        ctx.lineWidth = this._options.stroke_width;
        ctx.globalAlpha = stroke_opacity;
        ctx.beginPath();

        for (const { points } of cells) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
        }
        ctx.stroke();
    }

    /**
     * Draw a single cell (legacy method for compatibility).
     * @private
     */
    _draw_cell(ctx, cell) {
        let points = this._pixel_cache.get(cell.id);
        if (!points) {
            points = cell.corners.map(c => this._map.latlng_to_point(c));
            this._pixel_cache.set(cell.id, points);
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();

        let fill_color = this._options.fill;
        if (this._color_scale && cell.value > 0) {
            fill_color = this._color_scale.get_color(cell.value);
        }

        ctx.fillStyle = fill_color;
        ctx.globalAlpha = this._opacity * this._options.fill_opacity;
        ctx.fill();

        ctx.strokeStyle = this._options.stroke;
        ctx.lineWidth = this._options.stroke_width;
        ctx.globalAlpha = this._opacity * this._options.stroke_opacity;
        ctx.stroke();
    }

    /**
     * Redraw the layer.
     */
    redraw() {
        this._needs_redraw = true;
        this._render();
        return this;
    }
}
