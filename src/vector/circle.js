/**
 * Circle - Circle on the map
 *
 * Renders a circle with a center point and radius in meters.
 *
 * @example
 * const circle = new Circle([40.7128, -74.0060], 1000, {
 *     fill: '#ff0000',
 *     fill_opacity: 0.3
 * });
 * circle.add_to(map);
 */

import { Path } from './path.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { Renderer } from './renderer.js';

/**
 * Default circle options.
 */
const DEFAULT_OPTIONS = {
    fill: '#3388ff'
};

/**
 * Circle class for circular areas.
 */
export class Circle extends Path {
    /**
     * Create a new Circle.
     *
     * @param {LatLng|Array} center - Center coordinate
     * @param {number} radius - Radius in meters
     * @param {Object} [options] - Circle options
     */
    constructor(center, radius, options = {}) {
        super({ ...DEFAULT_OPTIONS, ...options });

        this._center = null;
        this._radius = 0;
        this._center_px = null;
        this._radius_px = 0;

        this.set_center(center);
        this.set_radius(radius);
    }

    // ==================== Center ====================

    /**
     * Get circle center.
     *
     * @returns {LatLng} Center coordinate
     */
    get_center() {
        return this._center;
    }

    /**
     * Set circle center.
     *
     * @param {LatLng|Array} center - New center
     * @returns {this} Returns this for chaining
     */
    set_center(center) {
        const ll = LatLng.from(center);
        if (ll) {
            this._center = ll;
            this._compute_bounds();
            this.redraw();
        }
        return this;
    }

    /**
     * Alias for get_center.
     *
     * @returns {LatLng} Center coordinate
     */
    get_latlng() {
        return this._center;
    }

    /**
     * Alias for set_center.
     *
     * @param {LatLng|Array} latlng - New center
     * @returns {this} Returns this for chaining
     */
    set_latlng(latlng) {
        return this.set_center(latlng);
    }

    // ==================== Radius ====================

    /**
     * Get circle radius in meters.
     *
     * @returns {number} Radius in meters
     */
    get_radius() {
        return this._radius;
    }

    /**
     * Set circle radius in meters.
     *
     * @param {number} radius - New radius in meters
     * @returns {this} Returns this for chaining
     */
    set_radius(radius) {
        if (typeof radius === 'number' && radius >= 0) {
            this._radius = radius;
            this._compute_bounds();
            this.redraw();
        }
        return this;
    }

    // ==================== Bounds ====================

    /**
     * Compute bounds from center and radius.
     * @protected
     */
    _compute_bounds() {
        if (!this._center || this._radius <= 0) {
            this._bounds = null;
            return;
        }

        this._bounds = Bounds.from_center_radius(this._center, this._radius);
    }

    // ==================== Measurements ====================

    /**
     * Get the area in square meters.
     *
     * @returns {number} Area in square meters
     */
    get_area() {
        return Math.PI * this._radius * this._radius;
    }

    /**
     * Get the circumference in meters.
     *
     * @returns {number} Circumference in meters
     */
    get_circumference() {
        return 2 * Math.PI * this._radius;
    }

    // ==================== Rendering ====================

    /**
     * Update pixel coordinates.
     *
     * @param {Transform} transform - Current transform
     * @protected
     */
    _update_pixels(transform) {
        if (!this._center) return;

        this._center_px = transform.latlng_to_pixel(this._center);

        // Calculate pixel radius
        const edge = this._center.destination(this._radius, 0);
        const edge_px = transform.latlng_to_pixel(edge);
        this._radius_px = Math.abs(edge_px.y - this._center_px.y);
    }

    /**
     * Render the circle.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Transform} transform - Current transform
     */
    render(ctx, transform) {
        if (!this._visible || !this._center || this._radius <= 0) return;

        this._update_pixels(transform);

        const renderer = new Renderer(ctx, transform);
        renderer.draw_circle(this._center, this._radius, this._get_render_style());
    }

    // ==================== Hit Testing ====================

    /**
     * Check if a pixel point is inside the circle.
     *
     * @param {Point} point - Pixel point
     * @param {number} [tolerance=0] - Hit tolerance in pixels
     * @returns {boolean} True if point is inside
     */
    contains_point(point, tolerance = 0) {
        if (!this._center_px) return false;

        const dx = point.x - this._center_px.x;
        const dy = point.y - this._center_px.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return dist <= this._radius_px + tolerance;
    }

    /**
     * Check if a geographic point is inside the circle.
     *
     * @param {LatLng|Array} latlng - Geographic point
     * @returns {boolean} True if point is inside
     */
    contains_latlng(latlng) {
        const ll = LatLng.from(latlng);
        if (!ll || !this._center) return false;

        return this._center.distance_to(ll) <= this._radius;
    }

    // ==================== Utilities ====================

    /**
     * Convert to approximate GeoJSON polygon.
     *
     * @param {number} [segments=64] - Number of segments
     * @returns {Object} GeoJSON Polygon geometry
     */
    to_geojson(segments = 64) {
        const coords = [];

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 360;
            const point = this._center.destination(this._radius, angle);
            coords.push(point.to_geojson());
        }

        return {
            type: 'Polygon',
            coordinates: [coords]
        };
    }

    /**
     * Create a polygon approximation of this circle.
     *
     * @param {number} [segments=64] - Number of segments
     * @returns {Array<LatLng>} Polygon coordinates
     */
    to_polygon_coords(segments = 64) {
        const coords = [];

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 360;
            coords.push(this._center.destination(this._radius, angle));
        }

        return coords;
    }
}

/**
 * CircleMarker - Circle with fixed pixel radius
 *
 * Unlike Circle, CircleMarker has a radius in pixels that doesn't
 * change with zoom.
 */
export class CircleMarker extends Path {
    /**
     * Create a new CircleMarker.
     *
     * @param {LatLng|Array} latlng - Center coordinate
     * @param {Object} [options] - CircleMarker options
     * @param {number} [options.radius=10] - Radius in pixels
     */
    constructor(latlng, options = {}) {
        const { radius = 10, ...rest } = options;
        super({ fill: '#3388ff', ...rest });

        this._latlng = null;
        this._radius = radius;
        this._center_px = null;

        this.set_latlng(latlng);
    }

    /**
     * Get center coordinate.
     *
     * @returns {LatLng} Center coordinate
     */
    get_latlng() {
        return this._latlng;
    }

    /**
     * Set center coordinate.
     *
     * @param {LatLng|Array} latlng - New center
     * @returns {this} Returns this for chaining
     */
    set_latlng(latlng) {
        const ll = LatLng.from(latlng);
        if (ll) {
            this._latlng = ll;
            this.redraw();
        }
        return this;
    }

    /**
     * Get radius in pixels.
     *
     * @returns {number} Radius in pixels
     */
    get_radius() {
        return this._radius;
    }

    /**
     * Set radius in pixels.
     *
     * @param {number} radius - New radius in pixels
     * @returns {this} Returns this for chaining
     */
    set_radius(radius) {
        this._radius = radius;
        this.redraw();
        return this;
    }

    /**
     * Get bounds.
     *
     * @returns {Bounds|null} Bounds
     */
    get_bounds() {
        if (!this._latlng) return null;

        // Approximate bounds based on pixel radius at current zoom
        // This is a simplified approximation
        return Bounds.from_points([this._latlng]);
    }

    /**
     * Update pixel coordinates.
     * @protected
     */
    _update_pixels(transform) {
        if (!this._latlng) return;
        this._center_px = transform.latlng_to_pixel(this._latlng);
    }

    /**
     * Render the circle marker.
     */
    render(ctx, transform) {
        if (!this._visible || !this._latlng) return;

        this._update_pixels(transform);

        const renderer = new Renderer(ctx, transform);
        renderer.draw_circle_px(this._latlng, this._radius, this._get_render_style());
    }

    /**
     * Check if point is inside.
     */
    contains_point(point, tolerance = 0) {
        if (!this._center_px) return false;

        const dx = point.x - this._center_px.x;
        const dy = point.y - this._center_px.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return dist <= this._radius + tolerance;
    }
}
