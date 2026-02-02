/**
 * RoadLayer - Road network visualization
 *
 * Renders road networks with hierarchical styling based on road type,
 * supports one-way indicators, labels, and traffic visualization.
 *
 * @example
 * const roads = new RoadLayer({
 *     type_property: 'highway',
 *     name_property: 'name'
 * });
 * roads.add_data(geojson);
 * roads.add_to(map);
 */

import { Layer } from '../layer/layer.js';
import { LatLng } from '../geo/lat_lng.js';
import { Polyline } from '../vector/polyline.js';
import { LayerGroup } from '../layer/layer_group.js';
import { deep_merge } from '../core/utils.js';

/**
 * Road type hierarchy with default styles.
 */
export const ROAD_TYPES = {
    motorway: {
        stroke: '#e892a2',
        stroke_width: 6,
        casing: '#dc2a67',
        casing_width: 8,
        z_index: 100
    },
    trunk: {
        stroke: '#f9b29c',
        stroke_width: 5,
        casing: '#c84e2f',
        casing_width: 7,
        z_index: 90
    },
    primary: {
        stroke: '#fcd6a4',
        stroke_width: 4,
        casing: '#a06b00',
        casing_width: 6,
        z_index: 80
    },
    secondary: {
        stroke: '#f7fabf',
        stroke_width: 4,
        casing: '#707d05',
        casing_width: 5,
        z_index: 70
    },
    tertiary: {
        stroke: '#ffffff',
        stroke_width: 3,
        casing: '#8f8f8f',
        casing_width: 4,
        z_index: 60
    },
    residential: {
        stroke: '#ffffff',
        stroke_width: 2,
        casing: '#bfbfbf',
        casing_width: 3,
        z_index: 50
    },
    service: {
        stroke: '#ffffff',
        stroke_width: 1.5,
        casing: '#bfbfbf',
        casing_width: 2,
        z_index: 40
    },
    path: {
        stroke: '#999999',
        stroke_width: 1,
        stroke_dasharray: [4, 2],
        z_index: 30
    },
    cycleway: {
        stroke: '#0000ff',
        stroke_width: 1.5,
        stroke_dasharray: [3, 3],
        z_index: 35
    },
    footway: {
        stroke: '#fa8072',
        stroke_width: 1,
        stroke_dasharray: [2, 2],
        z_index: 25
    },
    default: {
        stroke: '#cccccc',
        stroke_width: 2,
        casing: '#999999',
        casing_width: 3,
        z_index: 20
    }
};

/**
 * Default road layer options.
 */
const DEFAULT_OPTIONS = {
    type_property: 'highway',
    name_property: 'name',
    oneway_property: 'oneway',
    road_types: ROAD_TYPES,
    show_casing: true,
    show_labels: false,
    show_oneway: false,
    style_fn: null,        // (feature, type) => style
    filter_fn: null,       // (feature) => boolean
    interactive: false,
    min_zoom: 0,
    max_zoom: 22,
    label_min_zoom: 15
};

/**
 * RoadLayer class for road network visualization.
 */
export class RoadLayer extends Layer {
    /**
     * Create a new RoadLayer.
     *
     * @param {Object} [options] - Layer options
     */
    constructor(options = {}) {
        super(options);

        this._options = deep_merge({}, DEFAULT_OPTIONS, options);
        this._features = [];
        this._casing_group = new LayerGroup();
        this._road_group = new LayerGroup();
        this._label_group = new LayerGroup();
        this._canvas = null;
        this._ctx = null;
    }

    /**
     * Called when layer is added to map.
     *
     * @param {Osman} map - Map instance
     */
    on_add(map) {
        super.on_add(map);

        // Create canvas for labels and arrows
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'urban-road-layer';
        this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        this._ctx = this._canvas.getContext('2d');
        map._vector_container.appendChild(this._canvas);

        // Add layer groups (casing first, then roads)
        this._casing_group.add_to(map);
        this._road_group.add_to(map);

        // Bind events
        this._on_resize = this._on_resize.bind(this);
        this._on_viewchange = this._on_viewchange.bind(this);

        map.on('map:resize', this._on_resize);
        map.on('map:move', this._on_viewchange);
        map.on('map:zoom', this._on_viewchange);

        this._resize_canvas();
        this._render();
    }

    /**
     * Called when layer is removed from map.
     */
    on_remove() {
        if (this._map) {
            this._map.off('map:resize', this._on_resize);
            this._map.off('map:move', this._on_viewchange);
            this._map.off('map:zoom', this._on_viewchange);
        }

        this._casing_group.remove();
        this._road_group.remove();

        if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }

        this._canvas = null;
        this._ctx = null;

        super.on_remove();
    }

    /**
     * Add GeoJSON data.
     *
     * @param {Object} geojson - GeoJSON FeatureCollection or Feature
     * @returns {this} Returns this for chaining
     */
    add_data(geojson) {
        if (geojson.type === 'FeatureCollection') {
            for (const feature of geojson.features) {
                this._add_feature(feature);
            }
        } else if (geojson.type === 'Feature') {
            this._add_feature(geojson);
        }

        this._render();
        return this;
    }

    /**
     * Add a single feature.
     * @private
     */
    _add_feature(feature) {
        // Check filter
        if (this._options.filter_fn && !this._options.filter_fn(feature)) {
            return;
        }

        // Only handle line geometries
        const geometry = feature.geometry;
        if (!geometry) return;

        if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
            return;
        }

        this._features.push(feature);
    }

    /**
     * Clear all data.
     *
     * @returns {this} Returns this for chaining
     */
    clear_data() {
        this._features = [];
        this._casing_group.clear_layers();
        this._road_group.clear_layers();

        if (this._ctx) {
            const size = this._map?.get_size() || { width: 0, height: 0 };
            this._ctx.clearRect(0, 0, size.width, size.height);
        }

        return this;
    }

    /**
     * Get all features.
     *
     * @returns {Array} Array of GeoJSON features
     */
    get_features() {
        return [...this._features];
    }

    /**
     * Set road type styles.
     *
     * @param {string} type - Road type name
     * @param {Object} style - Style options
     * @returns {this} Returns this for chaining
     */
    set_road_style(type, style) {
        this._options.road_types[type] = { ...this._options.road_types[type], ...style };
        this._render();
        return this;
    }

    /**
     * Get road type for a feature.
     * @private
     */
    _get_road_type(feature) {
        const props = feature.properties || {};
        const type = props[this._options.type_property];

        return this._options.road_types[type] || this._options.road_types.default;
    }

    /**
     * Get style for a feature.
     * @private
     */
    _get_style(feature, is_casing = false) {
        const road_type = this._get_road_type(feature);
        const props = feature.properties || {};
        const type_name = props[this._options.type_property];

        let style = {
            stroke: is_casing ? road_type.casing : road_type.stroke,
            stroke_width: is_casing ? road_type.casing_width : road_type.stroke_width,
            stroke_opacity: 1
        };

        if (road_type.stroke_dasharray && !is_casing) {
            style.stroke_dasharray = road_type.stroke_dasharray;
        }

        // Apply custom style function
        if (this._options.style_fn) {
            const custom = this._options.style_fn(feature, type_name);
            style = { ...style, ...custom };
        }

        return style;
    }

    /**
     * Resize canvas.
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
    }

    /**
     * Handle resize.
     * @private
     */
    _on_resize() {
        this._resize_canvas();
        this._render();
    }

    /**
     * Handle view change.
     * @private
     */
    _on_viewchange() {
        this._render_labels();
    }

    /**
     * Render roads.
     * @private
     */
    _render() {
        if (!this._map || !this._visible) return;

        const zoom = this._map.get_zoom();

        if (zoom < this._options.min_zoom || zoom > this._options.max_zoom) {
            this._casing_group.clear_layers();
            this._road_group.clear_layers();
            return;
        }

        // Clear existing
        this._casing_group.clear_layers();
        this._road_group.clear_layers();

        // Sort by z_index
        const sorted = [...this._features].sort((a, b) => {
            const ta = this._get_road_type(a);
            const tb = this._get_road_type(b);
            return (ta.z_index || 0) - (tb.z_index || 0);
        });

        // Create polylines
        for (const feature of sorted) {
            const lines = this._create_lines(feature);

            for (const { casing, road } of lines) {
                if (casing && this._options.show_casing) {
                    this._casing_group.add_layer(casing);
                }
                this._road_group.add_layer(road);
            }
        }

        this._render_labels();
    }

    /**
     * Create polyline layers for a feature.
     * @private
     */
    _create_lines(feature) {
        const geometry = feature.geometry;
        const road_style = this._get_style(feature, false);
        const casing_style = this._get_style(feature, true);
        const road_type = this._get_road_type(feature);
        const lines = [];

        const create_line = (coords) => {
            const latlngs = coords.map(c => new LatLng(c[1], c[0]));

            const road = new Polyline(latlngs, road_style);
            road._feature = feature;

            let casing = null;
            if (road_type.casing) {
                casing = new Polyline(latlngs, casing_style);
                casing._feature = feature;
            }

            return { casing, road };
        };

        if (geometry.type === 'LineString') {
            lines.push(create_line(geometry.coordinates));
        } else if (geometry.type === 'MultiLineString') {
            for (const coords of geometry.coordinates) {
                lines.push(create_line(coords));
            }
        }

        return lines;
    }

    /**
     * Render labels and one-way arrows.
     * @private
     */
    _render_labels() {
        if (!this._ctx || !this._map) return;

        const ctx = this._ctx;
        const size = this._map.get_size();
        const zoom = this._map.get_zoom();

        ctx.clearRect(0, 0, size.width, size.height);

        if (!this._visible) return;

        // Draw labels
        if (this._options.show_labels && zoom >= this._options.label_min_zoom) {
            this._draw_labels(ctx);
        }

        // Draw one-way arrows
        if (this._options.show_oneway) {
            this._draw_oneway_arrows(ctx);
        }
    }

    /**
     * Draw road labels.
     * @private
     */
    _draw_labels(ctx) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const drawn_labels = new Set();

        for (const feature of this._features) {
            const props = feature.properties || {};
            const name = props[this._options.name_property];

            if (!name || drawn_labels.has(name)) continue;

            const geometry = feature.geometry;
            const coords = geometry.type === 'LineString'
                ? geometry.coordinates
                : geometry.coordinates[0];

            // Get midpoint
            const mid_idx = Math.floor(coords.length / 2);
            const mid_coord = coords[mid_idx];
            const point = this._map.latlng_to_point(new LatLng(mid_coord[1], mid_coord[0]));

            // Calculate angle from nearby points
            let angle = 0;
            if (coords.length > 1) {
                const prev = coords[Math.max(0, mid_idx - 1)];
                const next = coords[Math.min(coords.length - 1, mid_idx + 1)];
                const p1 = this._map.latlng_to_point(new LatLng(prev[1], prev[0]));
                const p2 = this._map.latlng_to_point(new LatLng(next[1], next[0]));
                angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                // Flip if upside down
                if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                    angle += Math.PI;
                }
            }

            // Draw label
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(angle);

            // Background
            const metrics = ctx.measureText(name);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(-metrics.width / 2 - 2, -8, metrics.width + 4, 16);

            // Text
            ctx.fillStyle = '#333';
            ctx.fillText(name, 0, 0);
            ctx.restore();

            drawn_labels.add(name);
        }
    }

    /**
     * Draw one-way arrows.
     * @private
     */
    _draw_oneway_arrows(ctx) {
        ctx.fillStyle = '#666';

        for (const feature of this._features) {
            const props = feature.properties || {};
            const oneway = props[this._options.oneway_property];

            if (!oneway || oneway === 'no') continue;

            const geometry = feature.geometry;
            const coords = geometry.type === 'LineString'
                ? geometry.coordinates
                : geometry.coordinates[0];

            // Draw arrow at midpoint
            const mid_idx = Math.floor(coords.length / 2);
            const mid_coord = coords[mid_idx];
            const point = this._map.latlng_to_point(new LatLng(mid_coord[1], mid_coord[0]));

            // Calculate angle
            let angle = 0;
            if (mid_idx < coords.length - 1) {
                const next = coords[mid_idx + 1];
                const p2 = this._map.latlng_to_point(new LatLng(next[1], next[0]));
                angle = Math.atan2(p2.y - point.y, p2.x - point.x);
            }

            // Reverse if oneway=-1
            if (oneway === '-1') {
                angle += Math.PI;
            }

            // Draw arrow
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(angle);

            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-3, -4);
            ctx.lineTo(-3, 4);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Redraw the layer.
     */
    redraw() {
        this._render();
        return this;
    }
}
