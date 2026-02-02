/**
 * DrawTool - Interactive drawing tool
 *
 * Tool for drawing markers, polylines, polygons, circles, and rectangles
 * on the map with support for editing and deletion.
 *
 * @example
 * const draw = new DrawTool({
 *     mode: 'polygon',
 *     editable: true
 * });
 * draw.add_to(map);
 * draw.enable();
 *
 * draw.on('draw:complete', (e) => {
 *     console.log('Created:', e.layer);
 * });
 */

import { EventEmitter } from '../core/event_emitter.js';
import { LatLng } from '../geo/lat_lng.js';
import { Polyline } from '../vector/polyline.js';
import { Polygon } from '../vector/polygon.js';
import { Circle } from '../vector/circle.js';
import { Rectangle } from '../vector/rectangle.js';
import { Marker } from '../marker/marker.js';
import { LayerGroup } from '../layer/layer_group.js';
import { deep_merge } from '../core/utils.js';

/**
 * Draw mode constants.
 */
export const DrawMode = {
    MARKER: 'marker',
    POLYLINE: 'polyline',
    POLYGON: 'polygon',
    CIRCLE: 'circle',
    RECTANGLE: 'rectangle'
};

/**
 * Default draw tool options.
 */
const DEFAULT_OPTIONS = {
    mode: DrawMode.POLYGON,
    editable: true,
    deletable: true,
    show_guides: true,
    snap_to_grid: false,
    grid_size: 0.0001,   // Degrees for snapping
    marker_style: {
        draggable: true
    },
    polyline_style: {
        stroke: '#3498db',
        stroke_width: 3,
        stroke_opacity: 0.8
    },
    polygon_style: {
        stroke: '#3498db',
        stroke_width: 2,
        fill: '#3498db',
        fill_opacity: 0.3
    },
    circle_style: {
        stroke: '#3498db',
        stroke_width: 2,
        fill: '#3498db',
        fill_opacity: 0.3
    },
    rectangle_style: {
        stroke: '#3498db',
        stroke_width: 2,
        fill: '#3498db',
        fill_opacity: 0.3
    },
    vertex_style: {
        radius: 6,
        stroke: '#ffffff',
        stroke_width: 2,
        fill: '#3498db'
    },
    guide_style: {
        stroke: '#999999',
        stroke_width: 1,
        stroke_dasharray: [4, 4]
    }
};

/**
 * DrawTool class for interactive drawing.
 */
export class DrawTool extends EventEmitter {
    /**
     * Create a new DrawTool.
     *
     * @param {Object} [options] - Tool options
     */
    constructor(options = {}) {
        super();

        this._options = deep_merge({}, DEFAULT_OPTIONS, options);
        this._map = null;
        this._enabled = false;
        this._drawing = false;
        this._points = [];
        this._start_point = null;
        this._layer_group = new LayerGroup();
        this._drawn_layers = new LayerGroup();
        this._current_layer = null;
        this._preview_layer = null;
        this._vertices = [];
        this._guides = [];
    }

    /**
     * Add tool to map.
     *
     * @param {Osman} map - Map instance
     * @returns {this} Returns this for chaining
     */
    add_to(map) {
        this._map = map;
        this._layer_group.add_to(map);
        this._drawn_layers.add_to(map);
        return this;
    }

    /**
     * Remove tool from map.
     *
     * @returns {this} Returns this for chaining
     */
    remove() {
        this.disable();
        this._layer_group.remove();
        this._drawn_layers.remove();
        this._map = null;
        return this;
    }

    /**
     * Enable the tool.
     *
     * @returns {this} Returns this for chaining
     */
    enable() {
        if (!this._map || this._enabled) return this;

        this._enabled = true;
        this._bind_events();

        // Set cursor
        this._update_cursor();

        this.emit('draw:enable');
        return this;
    }

    /**
     * Disable the tool.
     *
     * @returns {this} Returns this for chaining
     */
    disable() {
        if (!this._enabled) return this;

        this._enabled = false;
        this._drawing = false;
        this._unbind_events();
        this._clear_current();

        // Reset cursor
        if (this._map) {
            this._map.get_container().style.cursor = '';
        }

        this.emit('draw:disable');
        return this;
    }

    /**
     * Check if tool is enabled.
     *
     * @returns {boolean} True if enabled
     */
    is_enabled() {
        return this._enabled;
    }

    /**
     * Set drawing mode.
     *
     * @param {string} mode - Drawing mode
     * @returns {this} Returns this for chaining
     */
    set_mode(mode) {
        this._options.mode = mode;
        this._clear_current();
        this._update_cursor();
        return this;
    }

    /**
     * Get current mode.
     *
     * @returns {string} Current mode
     */
    get_mode() {
        return this._options.mode;
    }

    /**
     * Get all drawn layers.
     *
     * @returns {Array} Array of drawn layers
     */
    get_layers() {
        return this._drawn_layers.get_layers();
    }

    /**
     * Clear all drawn layers.
     *
     * @returns {this} Returns this for chaining
     */
    clear_all() {
        this._drawn_layers.clear_layers();
        this.emit('draw:clear');
        return this;
    }

    /**
     * Delete a specific layer.
     *
     * @param {Layer} layer - Layer to delete
     * @returns {this} Returns this for chaining
     */
    delete_layer(layer) {
        this._drawn_layers.remove_layer(layer);
        this.emit('draw:delete', { layer });
        return this;
    }

    /**
     * Import GeoJSON as drawn layers.
     *
     * @param {Object} geojson - GeoJSON data
     * @returns {this} Returns this for chaining
     */
    import_geojson(geojson) {
        // Convert GeoJSON to layers
        const features = geojson.type === 'FeatureCollection'
            ? geojson.features
            : [geojson];

        for (const feature of features) {
            const layer = this._feature_to_layer(feature);
            if (layer) {
                this._add_drawn_layer(layer);
            }
        }

        return this;
    }

    /**
     * Export drawn layers as GeoJSON.
     *
     * @returns {Object} GeoJSON FeatureCollection
     */
    export_geojson() {
        const features = [];

        for (const layer of this._drawn_layers.get_layers()) {
            const feature = this._layer_to_feature(layer);
            if (feature) {
                features.push(feature);
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }

    /**
     * Update cursor based on mode.
     * @private
     */
    _update_cursor() {
        if (!this._map) return;

        const cursors = {
            [DrawMode.MARKER]: 'crosshair',
            [DrawMode.POLYLINE]: 'crosshair',
            [DrawMode.POLYGON]: 'crosshair',
            [DrawMode.CIRCLE]: 'crosshair',
            [DrawMode.RECTANGLE]: 'crosshair'
        };

        this._map.get_container().style.cursor = cursors[this._options.mode] || 'crosshair';
    }

    /**
     * Bind map events.
     * @private
     */
    _bind_events() {
        this._on_click = this._on_click.bind(this);
        this._on_mousemove = this._on_mousemove.bind(this);
        this._on_mousedown = this._on_mousedown.bind(this);
        this._on_mouseup = this._on_mouseup.bind(this);
        this._on_dblclick = this._on_dblclick.bind(this);
        this._on_keydown = this._on_keydown.bind(this);

        this._map.on('map:click', this._on_click);
        this._map.on('map:mousemove', this._on_mousemove);
        this._map.on('map:mousedown', this._on_mousedown);
        this._map.on('map:mouseup', this._on_mouseup);
        this._map.on('map:dblclick', this._on_dblclick);

        document.addEventListener('keydown', this._on_keydown);
    }

    /**
     * Unbind map events.
     * @private
     */
    _unbind_events() {
        if (this._map) {
            this._map.off('map:click', this._on_click);
            this._map.off('map:mousemove', this._on_mousemove);
            this._map.off('map:mousedown', this._on_mousedown);
            this._map.off('map:mouseup', this._on_mouseup);
            this._map.off('map:dblclick', this._on_dblclick);
        }

        document.removeEventListener('keydown', this._on_keydown);
    }

    /**
     * Handle click event.
     * @private
     */
    _on_click(e) {
        const latlng = this._snap_point(e.latlng);

        switch (this._options.mode) {
            case DrawMode.MARKER:
                this._create_marker(latlng);
                break;

            case DrawMode.POLYLINE:
            case DrawMode.POLYGON:
                this._add_vertex(latlng);
                break;

            case DrawMode.CIRCLE:
            case DrawMode.RECTANGLE:
                // Handled by mousedown/mouseup
                break;
        }
    }

    /**
     * Handle mouse move.
     * @private
     */
    _on_mousemove(e) {
        const latlng = this._snap_point(e.latlng);

        if (this._drawing) {
            this._update_preview(latlng);
        } else if (this._points.length > 0) {
            this._update_line_preview(latlng);
        }
    }

    /**
     * Handle mouse down.
     * @private
     */
    _on_mousedown(e) {
        const mode = this._options.mode;

        if (mode === DrawMode.CIRCLE || mode === DrawMode.RECTANGLE) {
            this._start_point = this._snap_point(e.latlng);
            this._drawing = true;
        }
    }

    /**
     * Handle mouse up.
     * @private
     */
    _on_mouseup(e) {
        if (!this._drawing) return;

        const latlng = this._snap_point(e.latlng);

        switch (this._options.mode) {
            case DrawMode.CIRCLE:
                this._complete_circle(latlng);
                break;

            case DrawMode.RECTANGLE:
                this._complete_rectangle(latlng);
                break;
        }

        this._drawing = false;
        this._start_point = null;
    }

    /**
     * Handle double click.
     * @private
     */
    _on_dblclick(e) {
        e.original_event?.preventDefault();

        if (this._options.mode === DrawMode.POLYLINE ||
            this._options.mode === DrawMode.POLYGON) {
            this._complete_shape();
        }
    }

    /**
     * Handle keydown.
     * @private
     */
    _on_keydown(e) {
        if (e.key === 'Escape') {
            this._clear_current();
        } else if (e.key === 'Enter') {
            this._complete_shape();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            this._remove_last_vertex();
        }
    }

    /**
     * Snap point to grid if enabled.
     * @private
     */
    _snap_point(latlng) {
        if (!this._options.snap_to_grid) {
            return latlng;
        }

        const grid = this._options.grid_size;
        return new LatLng(
            Math.round(latlng.lat / grid) * grid,
            Math.round(latlng.lng / grid) * grid
        );
    }

    /**
     * Create a marker.
     * @private
     */
    _create_marker(latlng) {
        const marker = new Marker(latlng, this._options.marker_style);
        this._add_drawn_layer(marker);

        this.emit('draw:complete', {
            type: DrawMode.MARKER,
            layer: marker,
            latlng
        });
    }

    /**
     * Add a vertex to polyline/polygon.
     * @private
     */
    _add_vertex(latlng) {
        this._points.push(latlng);

        // Create vertex marker
        const vertex = new Circle(latlng, this._options.vertex_style.radius, {
            ...this._options.vertex_style,
            radius_in_pixels: true
        });
        this._vertices.push(vertex);
        this._layer_group.add_layer(vertex);

        // Update current layer
        this._update_current_layer();

        this.emit('draw:vertex', {
            point: latlng,
            points: [...this._points]
        });
    }

    /**
     * Remove last vertex.
     * @private
     */
    _remove_last_vertex() {
        if (this._points.length === 0) return;

        this._points.pop();

        const vertex = this._vertices.pop();
        if (vertex) {
            this._layer_group.remove_layer(vertex);
        }

        this._update_current_layer();
    }

    /**
     * Update current layer during drawing.
     * @private
     */
    _update_current_layer() {
        if (this._current_layer) {
            this._layer_group.remove_layer(this._current_layer);
            this._current_layer = null;
        }

        if (this._points.length < 2) return;

        if (this._options.mode === DrawMode.POLYLINE) {
            this._current_layer = new Polyline(this._points, this._options.polyline_style);
        } else if (this._options.mode === DrawMode.POLYGON && this._points.length >= 3) {
            this._current_layer = new Polygon([this._points], this._options.polygon_style);
        } else {
            this._current_layer = new Polyline(this._points, this._options.polyline_style);
        }

        this._layer_group.add_layer(this._current_layer);
    }

    /**
     * Update line preview to cursor.
     * @private
     */
    _update_line_preview(cursor) {
        if (this._preview_layer) {
            this._layer_group.remove_layer(this._preview_layer);
        }

        if (this._points.length === 0) return;

        const last_point = this._points[this._points.length - 1];
        this._preview_layer = new Polyline([last_point, cursor], {
            ...this._options.guide_style
        });

        this._layer_group.add_layer(this._preview_layer);
    }

    /**
     * Update preview during circle/rectangle drawing.
     * @private
     */
    _update_preview(cursor) {
        if (this._preview_layer) {
            this._layer_group.remove_layer(this._preview_layer);
        }

        if (!this._start_point) return;

        if (this._options.mode === DrawMode.CIRCLE) {
            const radius = this._start_point.distance_to(cursor);
            this._preview_layer = new Circle(this._start_point, radius, {
                ...this._options.circle_style,
                fill_opacity: this._options.circle_style.fill_opacity * 0.5
            });
        } else if (this._options.mode === DrawMode.RECTANGLE) {
            this._preview_layer = new Rectangle(this._start_point, cursor, {
                ...this._options.rectangle_style,
                fill_opacity: this._options.rectangle_style.fill_opacity * 0.5
            });
        }

        if (this._preview_layer) {
            this._layer_group.add_layer(this._preview_layer);
        }
    }

    /**
     * Complete polyline/polygon drawing.
     * @private
     */
    _complete_shape() {
        if (this._options.mode === DrawMode.POLYLINE && this._points.length >= 2) {
            const layer = new Polyline([...this._points], this._options.polyline_style);
            this._add_drawn_layer(layer);

            this.emit('draw:complete', {
                type: DrawMode.POLYLINE,
                layer,
                points: [...this._points]
            });

        } else if (this._options.mode === DrawMode.POLYGON && this._points.length >= 3) {
            const layer = new Polygon([[...this._points]], this._options.polygon_style);
            this._add_drawn_layer(layer);

            this.emit('draw:complete', {
                type: DrawMode.POLYGON,
                layer,
                points: [...this._points]
            });
        }

        this._clear_current();
    }

    /**
     * Complete circle drawing.
     * @private
     */
    _complete_circle(end_point) {
        if (!this._start_point) return;

        const radius = this._start_point.distance_to(end_point);
        if (radius < 1) return; // Minimum radius

        const layer = new Circle(this._start_point, radius, this._options.circle_style);
        this._add_drawn_layer(layer);

        this.emit('draw:complete', {
            type: DrawMode.CIRCLE,
            layer,
            center: this._start_point,
            radius
        });

        this._clear_current();
    }

    /**
     * Complete rectangle drawing.
     * @private
     */
    _complete_rectangle(end_point) {
        if (!this._start_point) return;

        const layer = new Rectangle(this._start_point, end_point, this._options.rectangle_style);
        this._add_drawn_layer(layer);

        this.emit('draw:complete', {
            type: DrawMode.RECTANGLE,
            layer,
            bounds: layer.get_bounds()
        });

        this._clear_current();
    }

    /**
     * Clear current drawing state.
     * @private
     */
    _clear_current() {
        this._points = [];
        this._layer_group.clear_layers();
        this._current_layer = null;
        this._preview_layer = null;
        this._vertices = [];
        this._start_point = null;
        this._drawing = false;
    }

    /**
     * Add a layer to drawn layers.
     * @private
     */
    _add_drawn_layer(layer) {
        if (this._options.deletable) {
            layer.on('click', () => {
                this.emit('draw:select', { layer });
            });

            layer.on('contextmenu', (e) => {
                e.original_event?.preventDefault();
                this.delete_layer(layer);
            });
        }

        this._drawn_layers.add_layer(layer);
    }

    /**
     * Convert GeoJSON feature to layer.
     * @private
     */
    _feature_to_layer(feature) {
        const geometry = feature.geometry;
        if (!geometry) return null;

        switch (geometry.type) {
            case 'Point':
                return new Marker(
                    new LatLng(geometry.coordinates[1], geometry.coordinates[0]),
                    this._options.marker_style
                );

            case 'LineString':
                return new Polyline(
                    geometry.coordinates.map(c => new LatLng(c[1], c[0])),
                    this._options.polyline_style
                );

            case 'Polygon':
                return new Polygon(
                    geometry.coordinates.map(ring =>
                        ring.map(c => new LatLng(c[1], c[0]))
                    ),
                    this._options.polygon_style
                );

            default:
                return null;
        }
    }

    /**
     * Convert layer to GeoJSON feature.
     * @private
     */
    _layer_to_feature(layer) {
        if (layer instanceof Marker) {
            const latlng = layer.get_latlng();
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [latlng.lng, latlng.lat]
                },
                properties: {}
            };
        }

        if (layer instanceof Circle) {
            // Approximate circle as polygon
            const center = layer._latlng;
            const radius = layer._radius;
            const points = [];
            const segments = 32;

            for (let i = 0; i < segments; i++) {
                const angle = (360 * i / segments);
                points.push(center.destination(radius, angle));
            }
            points.push(points[0]); // Close ring

            return {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [points.map(p => [p.lng, p.lat])]
                },
                properties: {
                    _type: 'circle',
                    center: [center.lng, center.lat],
                    radius: radius
                }
            };
        }

        if (layer instanceof Rectangle || layer instanceof Polygon) {
            const rings = layer._latlngs.map(ring =>
                ring.map(p => [p.lng, p.lat])
            );
            // Close rings
            for (const ring of rings) {
                if (ring[0][0] !== ring[ring.length - 1][0] ||
                    ring[0][1] !== ring[ring.length - 1][1]) {
                    ring.push([...ring[0]]);
                }
            }

            return {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: rings
                },
                properties: {}
            };
        }

        if (layer instanceof Polyline) {
            const coords = layer._latlngs.map(p => [p.lng, p.lat]);

            return {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coords
                },
                properties: {}
            };
        }

        return null;
    }
}
