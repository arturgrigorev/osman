/**
 * ZoneLayer - Zoning overlay visualization
 *
 * Renders zoning districts with categorical coloring,
 * pattern fills, and interactive zone information.
 *
 * @example
 * const zones = new ZoneLayer({
 *     zone_property: 'zone_type',
 *     colors: {
 *         'residential': '#ffff00',
 *         'commercial': '#ff0000',
 *         'industrial': '#9900ff'
 *     }
 * });
 * zones.add_data(geojson);
 * zones.add_to(map);
 */

import { Layer } from '../layer/layer.js';
import { LatLng } from '../geo/lat_lng.js';
import { Polygon } from '../vector/polygon.js';
import { LayerGroup } from '../layer/layer_group.js';
import { CategoricalScale } from '../data/color_scale.js';
import { deep_merge } from '../core/utils.js';

/**
 * Default zone colors.
 */
export const ZONE_COLORS = {
    // Residential
    R1: '#ffffcc',
    R2: '#ffff99',
    R3: '#ffff66',
    R4: '#ffff33',
    R5: '#ffff00',
    residential: '#ffff66',
    single_family: '#ffffcc',
    multi_family: '#ffff00',

    // Commercial
    C1: '#ffcccc',
    C2: '#ff9999',
    C3: '#ff6666',
    C4: '#ff3333',
    commercial: '#ff6666',
    retail: '#ff9999',
    office: '#ffcccc',

    // Industrial
    M1: '#ccccff',
    M2: '#9999ff',
    M3: '#6666ff',
    industrial: '#9999ff',
    light_industrial: '#ccccff',
    heavy_industrial: '#6666ff',

    // Mixed use
    MX: '#ff99ff',
    mixed_use: '#ff99ff',

    // Parks & Open Space
    P: '#99ff99',
    park: '#66ff66',
    open_space: '#99ff99',
    recreation: '#ccffcc',

    // Special
    historic: '#cc9966',
    waterfront: '#66ccff',
    transit: '#ff9933',
    planned: '#cccccc',

    // Default
    default: '#dddddd'
};

/**
 * Default zone layer options.
 */
const DEFAULT_OPTIONS = {
    zone_property: 'zone',
    name_property: 'name',
    colors: ZONE_COLORS,
    stroke: '#666666',
    stroke_width: 1.5,
    stroke_opacity: 0.8,
    fill_opacity: 0.5,
    pattern: null,          // Pattern type: 'stripes', 'dots', 'crosshatch'
    pattern_color: null,
    style_fn: null,         // (feature, zone_type) => style
    filter_fn: null,        // (feature) => boolean
    interactive: true,
    show_labels: false,
    label_min_zoom: 14,
    min_zoom: 0,
    max_zoom: 22
};

/**
 * ZoneLayer class for zoning overlay visualization.
 */
export class ZoneLayer extends Layer {
    /**
     * Create a new ZoneLayer.
     *
     * @param {Object} [options] - Layer options
     */
    constructor(options = {}) {
        super(options);

        this._options = deep_merge({}, DEFAULT_OPTIONS, options);
        this._features = [];
        this._zone_group = new LayerGroup();
        this._color_scale = new CategoricalScale(Object.values(this._options.colors));
        this._canvas = null;
        this._ctx = null;
        this._patterns = {};
        this._selected = null;
        this._hovered = null;

        // Pre-populate color scale mapping
        for (const [zone, color] of Object.entries(this._options.colors)) {
            this._color_scale.set_color(zone, color);
        }
    }

    /**
     * Called when layer is added to map.
     *
     * @param {Osman} map - Map instance
     */
    on_add(map) {
        super.on_add(map);

        // Create canvas for patterns and labels
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'urban-zone-layer';
        this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
        this._ctx = this._canvas.getContext('2d');
        map._vector_container.appendChild(this._canvas);

        // Create patterns
        this._create_patterns();

        // Add zone polygons
        this._zone_group.add_to(map);

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

        this._zone_group.remove();

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
        this._zone_group.clear_layers();
        this._selected = null;
        this._hovered = null;

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
     * Set zone color.
     *
     * @param {string} zone_type - Zone type
     * @param {string} color - Color value
     * @returns {this} Returns this for chaining
     */
    set_zone_color(zone_type, color) {
        this._options.colors[zone_type] = color;
        this._color_scale.set_color(zone_type, color);
        this._render();
        return this;
    }

    /**
     * Get zone at a location.
     *
     * @param {LatLng|Array} latlng - Location to query
     * @returns {Object|null} Feature at location or null
     */
    get_zone_at(latlng) {
        const point = latlng instanceof LatLng ? latlng : new LatLng(latlng[0], latlng[1]);

        for (const feature of this._features) {
            if (this._point_in_feature(point, feature)) {
                return feature;
            }
        }

        return null;
    }

    /**
     * Get zone type for a feature.
     * @private
     */
    _get_zone_type(feature) {
        const props = feature.properties || {};
        return props[this._options.zone_property] || 'default';
    }

    /**
     * Get color for a zone type.
     * @private
     */
    _get_zone_color(zone_type) {
        return this._options.colors[zone_type] || this._color_scale.get_color(zone_type);
    }

    /**
     * Select a zone.
     *
     * @param {Object} feature - Feature to select
     * @returns {this} Returns this for chaining
     */
    select(feature) {
        this._selected = feature;
        this._render();

        this.emit('zone:select', { feature });
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
     * Get selected zone.
     *
     * @returns {Object|null} Selected feature or null
     */
    get_selected() {
        return this._selected;
    }

    /**
     * Get zone statistics.
     *
     * @returns {Object} Statistics by zone type
     */
    get_statistics() {
        const stats = {};

        for (const feature of this._features) {
            const zone_type = this._get_zone_type(feature);

            if (!stats[zone_type]) {
                stats[zone_type] = {
                    count: 0,
                    color: this._get_zone_color(zone_type),
                    features: []
                };
            }

            stats[zone_type].count++;
            stats[zone_type].features.push(feature);
        }

        return stats;
    }

    /**
     * Create fill patterns.
     * @private
     */
    _create_patterns() {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');

        // Stripes pattern
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 10);
        ctx.stroke();
        this._patterns.stripes = ctx.createPattern(canvas, 'repeat');

        // Dots pattern
        ctx.clearRect(0, 0, 10, 10);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(5, 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        this._patterns.dots = ctx.createPattern(canvas, 'repeat');

        // Crosshatch pattern
        ctx.clearRect(0, 0, 10, 10);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 10);
        ctx.moveTo(10, 0);
        ctx.lineTo(0, 10);
        ctx.stroke();
        this._patterns.crosshatch = ctx.createPattern(canvas, 'repeat');
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
        const zone_type = this._get_zone_type(feature);
        const fill_color = this._get_zone_color(zone_type);

        let style = {
            stroke: this._options.stroke,
            stroke_width: this._options.stroke_width,
            stroke_opacity: this._options.stroke_opacity,
            fill: fill_color,
            fill_opacity: this._options.fill_opacity
        };

        // Apply custom style function
        if (this._options.style_fn) {
            const custom = this._options.style_fn(feature, zone_type);
            style = { ...style, ...custom };
        }

        // Highlight selected
        if (feature === this._selected) {
            style.stroke = '#000000';
            style.stroke_width = 3;
        }

        // Highlight hovered
        if (feature === this._hovered) {
            style.fill_opacity = Math.min(1, style.fill_opacity + 0.2);
        }

        return style;
    }

    /**
     * Render zones.
     * @private
     */
    _render() {
        if (!this._map || !this._visible) return;

        const zoom = this._map.get_zoom();

        if (zoom < this._options.min_zoom || zoom > this._options.max_zoom) {
            this._zone_group.clear_layers();
            return;
        }

        // Clear existing
        this._zone_group.clear_layers();

        // Create polygon layers
        for (const feature of this._features) {
            const polygons = this._create_polygons(feature);

            for (const polygon of polygons) {
                polygon._feature = feature;

                if (this._options.interactive) {
                    polygon.on('click', () => {
                        this.select(feature);
                        this.emit('zone:click', {
                            feature,
                            zone_type: this._get_zone_type(feature)
                        });
                    });

                    polygon.on('mouseover', () => {
                        this._hovered = feature;
                        this.emit('zone:hover', {
                            feature,
                            zone_type: this._get_zone_type(feature)
                        });
                    });

                    polygon.on('mouseout', () => {
                        this._hovered = null;
                    });
                }

                this._zone_group.add_layer(polygon);
            }
        }

        this._render_labels();
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
     * Render zone labels.
     * @private
     */
    _render_labels() {
        if (!this._ctx || !this._map) return;

        const ctx = this._ctx;
        const size = this._map.get_size();
        const zoom = this._map.get_zoom();

        ctx.clearRect(0, 0, size.width, size.height);

        if (!this._visible || !this._options.show_labels) return;
        if (zoom < this._options.label_min_zoom) return;

        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const feature of this._features) {
            const props = feature.properties || {};
            const zone_type = this._get_zone_type(feature);
            const name = props[this._options.name_property] || zone_type;

            // Get centroid
            const centroid = this._get_centroid(feature);
            if (!centroid) continue;

            const point = this._map.latlng_to_point(centroid);

            // Check if on screen
            if (point.x < 0 || point.x > size.width ||
                point.y < 0 || point.y > size.height) {
                continue;
            }

            // Draw background
            const metrics = ctx.measureText(name);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(
                point.x - metrics.width / 2 - 4,
                point.y - 8,
                metrics.width + 8,
                16
            );

            // Draw text
            ctx.fillStyle = '#333';
            ctx.fillText(name, point.x, point.y);
        }
    }

    /**
     * Get centroid of a feature.
     * @private
     */
    _get_centroid(feature) {
        const geometry = feature.geometry;

        const get_ring_centroid = (ring) => {
            let sum_lat = 0;
            let sum_lng = 0;
            const n = ring.length - 1; // Exclude closing point

            for (let i = 0; i < n; i++) {
                sum_lng += ring[i][0];
                sum_lat += ring[i][1];
            }

            return new LatLng(sum_lat / n, sum_lng / n);
        };

        if (geometry.type === 'Polygon') {
            return get_ring_centroid(geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
            // Return centroid of first polygon
            return get_ring_centroid(geometry.coordinates[0][0]);
        }

        return null;
    }

    /**
     * Redraw the layer.
     */
    redraw() {
        this._render();
        return this;
    }
}
