/**
 * Polyline - Line path on the map
 *
 * Renders a line through multiple geographic coordinates.
 *
 * @example
 * const line = new Polyline([
 *     [40.71, -74.00],
 *     [40.72, -73.99],
 *     [40.73, -73.98]
 * ], { stroke: '#ff0000', stroke_width: 3 });
 * line.add_to(map);
 */

import { Path } from './path.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { Renderer } from './renderer.js';

/**
 * Polyline class for line paths.
 */
export class Polyline extends Path {
    /**
     * Create a new Polyline.
     *
     * @param {Array<LatLng|Array>} latlngs - Array of coordinates
     * @param {Object} [options] - Polyline options
     */
    constructor(latlngs, options = {}) {
        super(options);

        this._latlngs = [];
        this._pixels = [];

        this.set_latlngs(latlngs);
    }

    // ==================== Coordinates ====================

    /**
     * Get all coordinates.
     *
     * @returns {Array<LatLng>} Array of LatLng
     */
    get_latlngs() {
        return [...this._latlngs];
    }

    /**
     * Set all coordinates.
     *
     * @param {Array<LatLng|Array>} latlngs - Array of coordinates
     * @returns {this} Returns this for chaining
     */
    set_latlngs(latlngs) {
        this._latlngs = latlngs.map(ll => LatLng.from(ll)).filter(ll => ll !== null);
        this._compute_bounds();
        this.redraw();
        return this;
    }

    /**
     * Add a coordinate to the end.
     *
     * @param {LatLng|Array} latlng - Coordinate to add
     * @returns {this} Returns this for chaining
     */
    add_latlng(latlng) {
        const ll = LatLng.from(latlng);
        if (ll) {
            this._latlngs.push(ll);
            this._compute_bounds();
            this.redraw();
        }
        return this;
    }

    /**
     * Get the center of the polyline.
     *
     * @returns {LatLng|null} Center coordinate
     */
    get_center() {
        return LatLng.center(this._latlngs);
    }

    /**
     * Get the total length in meters.
     *
     * @returns {number} Length in meters
     */
    get_length() {
        return LatLng.path_distance(this._latlngs);
    }

    // ==================== Bounds ====================

    /**
     * Compute bounds from coordinates.
     * @protected
     */
    _compute_bounds() {
        this._bounds = Bounds.from_points(this._latlngs);
    }

    // ==================== Rendering ====================

    /**
     * Update pixel coordinates.
     *
     * @param {Transform} transform - Current transform
     * @protected
     */
    _update_pixels(transform) {
        this._pixels = this._latlngs.map(ll => transform.latlng_to_pixel(ll));
    }

    /**
     * Render the polyline.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Transform} transform - Current transform
     */
    render(ctx, transform) {
        if (!this._visible || this._latlngs.length < 2) return;

        this._update_pixels(transform);

        const renderer = new Renderer(ctx, transform);
        renderer.draw_polyline(this._latlngs, this._get_render_style());
    }

    // ==================== Hit Testing ====================

    /**
     * Check if a pixel point is near the polyline.
     *
     * @param {Point} point - Pixel point
     * @param {number} [tolerance=5] - Hit tolerance in pixels
     * @returns {boolean} True if point is near the line
     */
    contains_point(point, tolerance = 5) {
        if (this._pixels.length < 2) return false;

        return Renderer.point_near_polyline(point, this._pixels, tolerance + this._options.stroke_width / 2);
    }

    // ==================== Utilities ====================

    /**
     * Get closest point on polyline to a given point.
     *
     * @param {LatLng|Array} latlng - Reference point
     * @returns {Object|null} { latlng, distance, index } or null
     */
    closest_point(latlng) {
        const ll = LatLng.from(latlng);
        if (!ll || this._latlngs.length < 2) return null;

        let min_dist = Infinity;
        let closest = null;
        let segment_index = 0;

        for (let i = 0; i < this._latlngs.length - 1; i++) {
            const a = this._latlngs[i];
            const b = this._latlngs[i + 1];

            // Simple nearest point on segment
            const dist_a = ll.distance_to(a);
            const dist_b = ll.distance_to(b);
            const dist = Math.min(dist_a, dist_b);

            if (dist < min_dist) {
                min_dist = dist;
                closest = dist_a < dist_b ? a : b;
                segment_index = i;
            }
        }

        return closest ? { latlng: closest, distance: min_dist, index: segment_index } : null;
    }

    /**
     * Simplify the polyline using Douglas-Peucker algorithm.
     *
     * @param {number} tolerance - Tolerance in meters
     * @returns {this} Returns this for chaining
     */
    simplify(tolerance) {
        if (this._latlngs.length <= 2) return this;

        // Convert to simple array for algorithm
        const simplified = this._douglas_peucker(this._latlngs, tolerance);
        this._latlngs = simplified;
        this._compute_bounds();
        this.redraw();

        return this;
    }

    /**
     * Douglas-Peucker simplification.
     * @private
     */
    _douglas_peucker(points, tolerance) {
        if (points.length <= 2) return points;

        let max_dist = 0;
        let max_index = 0;

        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this._perpendicular_distance(points[i], first, last);
            if (dist > max_dist) {
                max_dist = dist;
                max_index = i;
            }
        }

        if (max_dist > tolerance) {
            const left = this._douglas_peucker(points.slice(0, max_index + 1), tolerance);
            const right = this._douglas_peucker(points.slice(max_index), tolerance);

            return left.slice(0, -1).concat(right);
        }

        return [first, last];
    }

    /**
     * Calculate perpendicular distance from point to line.
     * @private
     */
    _perpendicular_distance(point, line_start, line_end) {
        // Simplified using lat/lng as planar coordinates (good enough for small distances)
        const dx = line_end.lng - line_start.lng;
        const dy = line_end.lat - line_start.lat;

        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return point.distance_to(line_start);

        const t = Math.max(0, Math.min(1,
            ((point.lng - line_start.lng) * dx + (point.lat - line_start.lat) * dy) / (len * len)
        ));

        const proj = new LatLng(
            line_start.lat + t * dy,
            line_start.lng + t * dx
        );

        return point.distance_to(proj);
    }

    /**
     * Convert to GeoJSON geometry.
     *
     * @returns {Object} GeoJSON LineString geometry
     */
    to_geojson() {
        return {
            type: 'LineString',
            coordinates: this._latlngs.map(ll => ll.to_geojson())
        };
    }

    /**
     * Create Polyline from GeoJSON.
     *
     * @param {Object} geojson - GeoJSON LineString geometry
     * @param {Object} [options] - Polyline options
     * @returns {Polyline} New Polyline instance
     */
    static from_geojson(geojson, options = {}) {
        if (geojson.type !== 'LineString') {
            throw new Error('Expected LineString geometry');
        }

        const latlngs = geojson.coordinates.map(coord => LatLng.from_geojson(coord));
        return new Polyline(latlngs, options);
    }
}
