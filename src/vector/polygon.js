/**
 * Polygon - Filled polygon on the map
 *
 * Renders a filled polygon with optional holes.
 *
 * @example
 * const polygon = new Polygon([
 *     [40.71, -74.00],
 *     [40.72, -73.99],
 *     [40.71, -73.98]
 * ], { fill: '#ff0000', fill_opacity: 0.5 });
 * polygon.add_to(map);
 */

import { Path } from './path.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { Renderer } from './renderer.js';

/**
 * Default polygon options.
 */
const DEFAULT_OPTIONS = {
    fill: '#3388ff'
};

/**
 * Polygon class for filled areas.
 */
export class Polygon extends Path {
    /**
     * Create a new Polygon.
     *
     * @param {Array} latlngs - Coordinates (single ring or array of rings)
     * @param {Object} [options] - Polygon options
     */
    constructor(latlngs, options = {}) {
        super({ ...DEFAULT_OPTIONS, ...options });

        this._rings = [];
        this._pixel_rings = [];

        this.set_latlngs(latlngs);
    }

    // ==================== Coordinates ====================

    /**
     * Get all coordinates.
     *
     * @returns {Array<Array<LatLng>>} Array of rings
     */
    get_latlngs() {
        return this._rings.map(ring => [...ring]);
    }

    /**
     * Set all coordinates.
     *
     * @param {Array} latlngs - Coordinates (single ring or array of rings)
     * @returns {this} Returns this for chaining
     */
    set_latlngs(latlngs) {
        // Normalize to array of rings
        if (latlngs.length > 0 && !Array.isArray(latlngs[0][0])) {
            // Single ring
            this._rings = [latlngs.map(ll => LatLng.from(ll)).filter(ll => ll !== null)];
        } else {
            // Multiple rings
            this._rings = latlngs.map(ring =>
                ring.map(ll => LatLng.from(ll)).filter(ll => ll !== null)
            );
        }

        this._compute_bounds();
        this.redraw();
        return this;
    }

    /**
     * Add a hole to the polygon.
     *
     * @param {Array<LatLng|Array>} hole - Hole coordinates
     * @returns {this} Returns this for chaining
     */
    add_hole(hole) {
        const ring = hole.map(ll => LatLng.from(ll)).filter(ll => ll !== null);
        if (ring.length >= 3) {
            this._rings.push(ring);
            this.redraw();
        }
        return this;
    }

    /**
     * Get the center of the polygon.
     *
     * @returns {LatLng|null} Center coordinate
     */
    get_center() {
        if (this._rings.length === 0) return null;
        return LatLng.center(this._rings[0]);
    }

    /**
     * Get the area in square meters.
     *
     * @returns {number} Area in square meters
     */
    get_area() {
        if (this._rings.length === 0 || this._rings[0].length < 3) return 0;

        // Use spherical excess formula for geodetic area
        return Math.abs(this._geodetic_area(this._rings[0]));
    }

    /**
     * Get the perimeter in meters.
     *
     * @returns {number} Perimeter in meters
     */
    get_perimeter() {
        if (this._rings.length === 0) return 0;

        let total = LatLng.path_distance(this._rings[0]);

        // Close the ring
        if (this._rings[0].length >= 2) {
            total += this._rings[0][this._rings[0].length - 1].distance_to(this._rings[0][0]);
        }

        return total;
    }

    /**
     * Calculate geodetic area using spherical excess.
     * @private
     */
    _geodetic_area(ring) {
        const EARTH_RADIUS = 6371008.8;
        const n = ring.length;
        if (n < 3) return 0;

        let sum = 0;

        for (let i = 0; i < n; i++) {
            const p1 = ring[i];
            const p2 = ring[(i + 1) % n];

            const lat1 = p1.lat * Math.PI / 180;
            const lat2 = p2.lat * Math.PI / 180;
            const dlon = (p2.lng - p1.lng) * Math.PI / 180;

            sum += dlon * (2 + Math.sin(lat1) + Math.sin(lat2));
        }

        return Math.abs(sum * EARTH_RADIUS * EARTH_RADIUS / 2);
    }

    // ==================== Bounds ====================

    /**
     * Compute bounds from coordinates.
     * @protected
     */
    _compute_bounds() {
        if (this._rings.length === 0) {
            this._bounds = null;
            return;
        }

        this._bounds = Bounds.from_points(this._rings[0]);
    }

    // ==================== Rendering ====================

    /**
     * Update pixel coordinates.
     *
     * @param {Transform} transform - Current transform
     * @protected
     */
    _update_pixels(transform) {
        this._pixel_rings = this._rings.map(ring =>
            ring.map(ll => transform.latlng_to_pixel(ll))
        );
    }

    /**
     * Render the polygon.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Transform} transform - Current transform
     */
    render(ctx, transform) {
        if (!this._visible || this._rings.length === 0 || this._rings[0].length < 3) return;

        this._update_pixels(transform);

        const renderer = new Renderer(ctx, transform);

        if (this._rings.length === 1) {
            renderer.draw_polygon(this._rings[0], this._get_render_style());
        } else {
            renderer.draw_polygon_with_holes(this._rings, this._get_render_style());
        }
    }

    // ==================== Hit Testing ====================

    /**
     * Check if a pixel point is inside the polygon.
     *
     * @param {Point} point - Pixel point
     * @param {number} [tolerance=0] - Not used for polygons
     * @returns {boolean} True if point is inside
     */
    contains_point(point, tolerance = 0) {
        if (this._pixel_rings.length === 0 || this._pixel_rings[0].length < 3) {
            return false;
        }

        // Check if in outer ring
        if (!Renderer.point_in_polygon(point, this._pixel_rings[0])) {
            return false;
        }

        // Check if in any hole
        for (let i = 1; i < this._pixel_rings.length; i++) {
            if (Renderer.point_in_polygon(point, this._pixel_rings[i])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a geographic point is inside the polygon.
     *
     * @param {LatLng|Array} latlng - Geographic point
     * @returns {boolean} True if point is inside
     */
    contains_latlng(latlng) {
        const ll = LatLng.from(latlng);
        if (!ll || this._rings.length === 0) return false;

        // Check outer ring
        if (!this._point_in_ring(ll, this._rings[0])) {
            return false;
        }

        // Check holes
        for (let i = 1; i < this._rings.length; i++) {
            if (this._point_in_ring(ll, this._rings[i])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if point is in ring using ray casting.
     * @private
     */
    _point_in_ring(point, ring) {
        let inside = false;
        const n = ring.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const yi = ring[i].lat;
            const xi = ring[i].lng;
            const yj = ring[j].lat;
            const xj = ring[j].lng;

            if (((yi > point.lat) !== (yj > point.lat)) &&
                (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    // ==================== Utilities ====================

    /**
     * Convert to GeoJSON geometry.
     *
     * @returns {Object} GeoJSON Polygon geometry
     */
    to_geojson() {
        return {
            type: 'Polygon',
            coordinates: this._rings.map(ring =>
                ring.map(ll => ll.to_geojson())
            )
        };
    }

    /**
     * Create Polygon from GeoJSON.
     *
     * @param {Object} geojson - GeoJSON Polygon geometry
     * @param {Object} [options] - Polygon options
     * @returns {Polygon} New Polygon instance
     */
    static from_geojson(geojson, options = {}) {
        if (geojson.type !== 'Polygon') {
            throw new Error('Expected Polygon geometry');
        }

        const rings = geojson.coordinates.map(ring =>
            ring.map(coord => LatLng.from_geojson(coord))
        );

        return new Polygon(rings, options);
    }
}
