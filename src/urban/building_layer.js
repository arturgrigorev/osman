/**
 * BuildingLayer - Building footprint visualization
 *
 * Renders building footprints with support for height-based styling,
 * 3D extrusion effects, and data-driven coloring.
 *
 * @example
 * const buildings = new BuildingLayer({
 *     height_property: 'building_height',
 *     style: {
 *         fill: '#cccccc',
 *         stroke: '#999999'
 *     }
 * });
 * buildings.add_data(geojson);
 * buildings.add_to(map);
 */

import { Layer } from '../layer/layer.js';
import { LatLng } from '../geo/lat_lng.js';
import { Polygon } from '../vector/polygon.js';
import { LayerGroup } from '../layer/layer_group.js';
import { deep_merge } from '../core/utils.js';

/**
 * Default building layer options.
 */
const DEFAULT_OPTIONS = {
    stroke: '#666666',
    stroke_width: 1,
    stroke_opacity: 1,
    fill: '#d4d4d4',
    fill_opacity: 0.8,
    height_property: null,  // Property name for building height
    height_scale: 1,        // Scale factor for height values
    min_height: 0,
    max_height: null,
    extrude: false,         // Enable 3D extrusion effect
    extrusion_color: '#888888',
    extrusion_opacity: 0.6,
    style_fn: null,         // (feature) => style object
    filter_fn: null,        // (feature) => boolean
    interactive: true,
    min_zoom: 0,
    max_zoom: 22
};

/**
 * BuildingLayer class for building footprint visualization.
 */
export class BuildingLayer extends Layer {
    /**
     * Create a new BuildingLayer.
     *
     * @param {Object} [options] - Layer options
     */
    constructor(options = {}) {
        super(options);

        this._options = deep_merge({}, DEFAULT_OPTIONS, options);
        this._features = [];
        this._building_layers = new LayerGroup();
        this._canvas = null;
        this._ctx = null;
        this._selected = null;
        this._hovered = null;
    }

    /**
     * Called when layer is added to map.
     *
     * @param {Osman} map - Map instance
     */
    on_add(map) {
        super.on_add(map);

        // Create canvas for extrusion effects
        if (this._options.extrude) {
            this._canvas = document.createElement('canvas');
            this._canvas.className = 'urban-building-layer';
            this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
            this._ctx = this._canvas.getContext('2d');
            map._vector_container.appendChild(this._canvas);

            this._on_resize = this._on_resize.bind(this);
            map.on('map:resize', this._on_resize);
            this._resize_canvas();
        }

        // Add building polygons to map
        this._building_layers.add_to(map);

        // Bind events
        this._on_viewchange = this._on_viewchange.bind(this);
        map.on('map:move', this._on_viewchange);
        map.on('map:zoom', this._on_viewchange);

        this._render();
    }

    /**
     * Called when layer is removed from map.
     */
    on_remove() {
        if (this._map) {
            if (this._options.extrude) {
                this._map.off('map:resize', this._on_resize);
            }
            this._map.off('map:move', this._on_viewchange);
            this._map.off('map:zoom', this._on_viewchange);
        }

        this._building_layers.remove();

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

        // Only handle polygon geometries
        const geometry = feature.geometry;
        if (!geometry) return;

        if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
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
        this._building_layers.clear_layers();
        this._selected = null;
        this._hovered = null;

        if (this._ctx) {
            const size = this._map?.get_size() || { width: 0, height: 0 };
            this._ctx.clearRect(0, 0, size.width, size.height);
        }

        return this;
    }

    /**
     * Set building style.
     *
     * @param {Object} style - Style options
     * @returns {this} Returns this for chaining
     */
    set_style(style) {
        Object.assign(this._options, style);
        this._render();
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
     * Get building at a location.
     *
     * @param {LatLng|Array} latlng - Location to query
     * @returns {Object|null} Feature at location or null
     */
    get_building_at(latlng) {
        const point = latlng instanceof LatLng ? latlng : new LatLng(latlng[0], latlng[1]);

        for (const feature of this._features) {
            if (this._point_in_feature(point, feature)) {
                return feature;
            }
        }

        return null;
    }

    /**
     * Select a building.
     *
     * @param {Object} feature - Feature to select
     * @returns {this} Returns this for chaining
     */
    select(feature) {
        this._selected = feature;
        this._render();

        this.emit('building:select', { feature });
        return this;
    }

    /**
     * Clear selection.
     *
     * @returns {this} Returns this for chaining
     */
    clear_selection() {
        this._selected = null;
        this._render();
        return this;
    }

    /**
     * Get selected building.
     *
     * @returns {Object|null} Selected feature or null
     */
    get_selected() {
        return this._selected;
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
        this._render();
    }

    /**
     * Check if point is in feature.
     * @private
     */
    _point_in_feature(point, feature) {
        const geometry = feature.geometry;

        if (geometry.type === 'Polygon') {
            return this._point_in_polygon(point, geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
            for (const poly of geometry.coordinates) {
                if (this._point_in_polygon(point, poly[0])) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if point is in polygon ring.
     * @private
     */
    _point_in_polygon(point, ring) {
        let inside = false;
        const n = ring.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const yi = ring[i][1];
            const xi = ring[i][0];
            const yj = ring[j][1];
            const xj = ring[j][0];

            if (((yi > point.lat) !== (yj > point.lat)) &&
                (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Get style for a feature.
     * @private
     */
    _get_style(feature) {
        const base_style = {
            stroke: this._options.stroke,
            stroke_width: this._options.stroke_width,
            stroke_opacity: this._options.stroke_opacity,
            fill: this._options.fill,
            fill_opacity: this._options.fill_opacity
        };

        // Apply style function
        if (this._options.style_fn) {
            const custom = this._options.style_fn(feature);
            Object.assign(base_style, custom);
        }

        // Highlight selected
        if (feature === this._selected) {
            base_style.stroke = '#ff0000';
            base_style.stroke_width = 3;
        }

        // Highlight hovered
        if (feature === this._hovered) {
            base_style.fill_opacity = Math.min(1, base_style.fill_opacity + 0.2);
        }

        return base_style;
    }

    /**
     * Get building height.
     * @private
     */
    _get_height(feature) {
        if (!this._options.height_property) return 0;

        const props = feature.properties || {};
        let height = props[this._options.height_property] || 0;

        height *= this._options.height_scale;

        if (this._options.min_height !== null) {
            height = Math.max(this._options.min_height, height);
        }

        if (this._options.max_height !== null) {
            height = Math.min(this._options.max_height, height);
        }

        return height;
    }

    /**
     * Render buildings.
     * @private
     */
    _render() {
        if (!this._map || !this._visible) return;

        const zoom = this._map.get_zoom();

        if (zoom < this._options.min_zoom || zoom > this._options.max_zoom) {
            this._building_layers.clear_layers();
            return;
        }

        // Clear existing
        this._building_layers.clear_layers();

        // Sort by height for proper rendering order (extrusion)
        const sorted_features = [...this._features];
        if (this._options.extrude && this._options.height_property) {
            sorted_features.sort((a, b) => this._get_height(a) - this._get_height(b));
        }

        // Create polygon layers
        for (const feature of sorted_features) {
            const polygons = this._create_polygons(feature);
            for (const polygon of polygons) {
                polygon._feature = feature;

                if (this._options.interactive) {
                    polygon.on('click', () => {
                        this.select(feature);
                        this.emit('building:click', { feature });
                    });

                    polygon.on('mouseover', () => {
                        this._hovered = feature;
                        this.emit('building:hover', { feature });
                    });

                    polygon.on('mouseout', () => {
                        this._hovered = null;
                    });
                }

                this._building_layers.add_layer(polygon);
            }
        }

        // Render extrusion on canvas if enabled
        if (this._options.extrude && this._ctx) {
            this._render_extrusion();
        }
    }

    /**
     * Create polygon layers for a feature.
     * @private
     */
    _create_polygons(feature) {
        const geometry = feature.geometry;
        const style = this._get_style(feature);
        const polygons = [];

        if (geometry.type === 'Polygon') {
            const coords = geometry.coordinates.map(ring =>
                ring.map(c => new LatLng(c[1], c[0]))
            );
            polygons.push(new Polygon(coords, style));

        } else if (geometry.type === 'MultiPolygon') {
            for (const poly of geometry.coordinates) {
                const coords = poly.map(ring =>
                    ring.map(c => new LatLng(c[1], c[0]))
                );
                polygons.push(new Polygon(coords, style));
            }
        }

        return polygons;
    }

    /**
     * Render extrusion effect on canvas.
     * @private
     */
    _render_extrusion() {
        if (!this._ctx || !this._map) return;

        const ctx = this._ctx;
        const size = this._map.get_size();

        ctx.clearRect(0, 0, size.width, size.height);

        // Get light direction (from northwest)
        const light_angle = -Math.PI / 4;

        // Sort features by height (render tall buildings last)
        const sorted = [...this._features].sort((a, b) =>
            this._get_height(a) - this._get_height(b)
        );

        for (const feature of sorted) {
            const height = this._get_height(feature);
            if (height <= 0) continue;

            // Calculate offset based on height and zoom
            const zoom = this._map.get_zoom();
            const scale = Math.pow(2, zoom - 16);
            const offset_x = Math.cos(light_angle) * height * scale * 0.1;
            const offset_y = Math.sin(light_angle) * height * scale * 0.1;

            this._draw_extrusion(ctx, feature, offset_x, offset_y);
        }
    }

    /**
     * Draw extrusion for a feature.
     * @private
     */
    _draw_extrusion(ctx, feature, offset_x, offset_y) {
        const geometry = feature.geometry;
        const coords = geometry.type === 'Polygon'
            ? [geometry.coordinates]
            : geometry.coordinates;

        ctx.fillStyle = this._options.extrusion_color;
        ctx.globalAlpha = this._options.extrusion_opacity * this._opacity;

        for (const poly of coords) {
            const ring = poly[0];
            const points = ring.map(c => this._map.latlng_to_point(new LatLng(c[1], c[0])));

            // Draw sides
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p2.x + offset_x, p2.y + offset_y);
                ctx.lineTo(p1.x + offset_x, p1.y + offset_y);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Redraw the layer.
     */
    redraw() {
        this._render();
        return this;
    }
}
