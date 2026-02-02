/**
 * Bounds - Immutable geographic bounding box
 *
 * Represents a rectangular geographic area defined by southwest and northeast corners.
 * All operations return new instances (immutable pattern).
 *
 * @example
 * const bounds = new Bounds(
 *     new LatLng(40.7, -74.1),  // southwest
 *     new LatLng(40.8, -73.9)   // northeast
 * );
 * const extended = bounds.extend([40.9, -73.8]);
 */

import { LatLng } from './lat_lng.js';
import { is_array, is_object } from '../core/utils.js';

/**
 * Bounds class representing an immutable geographic bounding box.
 */
export class Bounds {
    /**
     * Create a new Bounds.
     *
     * @param {LatLng|Array<number>|Object} southwest - Southwest corner
     * @param {LatLng|Array<number>|Object} northeast - Northeast corner
     */
    constructor(southwest, northeast) {
        const sw = LatLng.from(southwest);
        const ne = LatLng.from(northeast);

        if (!sw || !ne) {
            throw new TypeError('Invalid coordinates for bounds');
        }

        this._sw = sw;
        this._ne = ne;

        // Make immutable
        Object.freeze(this);
    }

    /**
     * Get southwest corner.
     * @type {LatLng}
     */
    get southwest() {
        return this._sw;
    }

    /**
     * Get northeast corner.
     * @type {LatLng}
     */
    get northeast() {
        return this._ne;
    }

    /**
     * Get northwest corner.
     * @type {LatLng}
     */
    get northwest() {
        return new LatLng(this._ne.lat, this._sw.lng);
    }

    /**
     * Get southeast corner.
     * @type {LatLng}
     */
    get southeast() {
        return new LatLng(this._sw.lat, this._ne.lng);
    }

    /**
     * Get south latitude.
     * @type {number}
     */
    get south() {
        return this._sw.lat;
    }

    /**
     * Get north latitude.
     * @type {number}
     */
    get north() {
        return this._ne.lat;
    }

    /**
     * Get west longitude.
     * @type {number}
     */
    get west() {
        return this._sw.lng;
    }

    /**
     * Get east longitude.
     * @type {number}
     */
    get east() {
        return this._ne.lng;
    }

    /**
     * Get the center point of the bounds.
     *
     * @returns {LatLng} Center coordinate
     */
    get_center() {
        return new LatLng(
            (this._sw.lat + this._ne.lat) / 2,
            (this._sw.lng + this._ne.lng) / 2
        );
    }

    /**
     * Get the width of the bounds in degrees.
     *
     * @returns {number} Width in degrees
     */
    get_width() {
        return this._ne.lng - this._sw.lng;
    }

    /**
     * Get the height of the bounds in degrees.
     *
     * @returns {number} Height in degrees
     */
    get_height() {
        return this._ne.lat - this._sw.lat;
    }

    /**
     * Check if bounds contain a point.
     *
     * @param {LatLng|Array<number>|Object} point - Point to check
     * @returns {boolean} True if point is within bounds
     */
    contains(point) {
        const p = LatLng.from(point);
        if (!p) return false;

        return p.lat >= this._sw.lat &&
               p.lat <= this._ne.lat &&
               p.lng >= this._sw.lng &&
               p.lng <= this._ne.lng;
    }

    /**
     * Check if bounds contain another bounds entirely.
     *
     * @param {Bounds} other - Bounds to check
     * @returns {boolean} True if other bounds are entirely within this bounds
     */
    contains_bounds(other) {
        if (!(other instanceof Bounds)) return false;

        return this.contains(other.southwest) && this.contains(other.northeast);
    }

    /**
     * Check if bounds intersect with another bounds.
     *
     * @param {Bounds} other - Bounds to check
     * @returns {boolean} True if bounds intersect
     */
    intersects(other) {
        if (!(other instanceof Bounds)) return false;

        return !(other.west > this.east ||
                 other.east < this.west ||
                 other.south > this.north ||
                 other.north < this.south);
    }

    /**
     * Get intersection with another bounds.
     *
     * @param {Bounds} other - Bounds to intersect with
     * @returns {Bounds|null} Intersection bounds or null if no intersection
     */
    intersection(other) {
        if (!this.intersects(other)) return null;

        return new Bounds(
            new LatLng(
                Math.max(this.south, other.south),
                Math.max(this.west, other.west)
            ),
            new LatLng(
                Math.min(this.north, other.north),
                Math.min(this.east, other.east)
            )
        );
    }

    /**
     * Create new bounds extended to include a point.
     *
     * @param {LatLng|Array<number>|Object} point - Point to include
     * @returns {Bounds} New extended bounds
     */
    extend(point) {
        const p = LatLng.from(point);
        if (!p) return this;

        const sw_lat = Math.min(this._sw.lat, p.lat);
        const sw_lng = Math.min(this._sw.lng, p.lng);
        const ne_lat = Math.max(this._ne.lat, p.lat);
        const ne_lng = Math.max(this._ne.lng, p.lng);

        return new Bounds(
            new LatLng(sw_lat, sw_lng),
            new LatLng(ne_lat, ne_lng)
        );
    }

    /**
     * Create new bounds extended to include another bounds.
     *
     * @param {Bounds} other - Bounds to include
     * @returns {Bounds} New extended bounds
     */
    extend_bounds(other) {
        if (!(other instanceof Bounds)) return this;

        return this.extend(other.southwest).extend(other.northeast);
    }

    /**
     * Create new bounds padded by a ratio.
     *
     * @param {number} ratio - Padding ratio (0.1 = 10% on each side)
     * @returns {Bounds} New padded bounds
     */
    pad(ratio) {
        const height = this.get_height();
        const width = this.get_width();

        const lat_pad = height * ratio;
        const lng_pad = width * ratio;

        return new Bounds(
            new LatLng(this._sw.lat - lat_pad, this._sw.lng - lng_pad),
            new LatLng(this._ne.lat + lat_pad, this._ne.lng + lng_pad)
        );
    }

    /**
     * Check if bounds are valid (non-zero area).
     *
     * @returns {boolean} True if bounds are valid
     */
    is_valid() {
        return this._ne.lat > this._sw.lat && this._ne.lng > this._sw.lng;
    }

    /**
     * Check if bounds equal another bounds.
     *
     * @param {Bounds} other - Bounds to compare
     * @param {number} [tolerance=0] - Tolerance in degrees
     * @returns {boolean} True if equal within tolerance
     */
    equals(other, tolerance = 0) {
        if (!(other instanceof Bounds)) return false;

        return this._sw.equals(other.southwest, tolerance) &&
               this._ne.equals(other.northeast, tolerance);
    }

    /**
     * Convert to array format [[sw_lat, sw_lng], [ne_lat, ne_lng]].
     *
     * @returns {Array<Array<number>>} Bounds array
     */
    to_array() {
        return [this._sw.to_array(), this._ne.to_array()];
    }

    /**
     * Convert to object format { south, west, north, east }.
     *
     * @returns {Object} Bounds object
     */
    to_object() {
        return {
            south: this._sw.lat,
            west: this._sw.lng,
            north: this._ne.lat,
            east: this._ne.lng
        };
    }

    /**
     * Convert to GeoJSON bbox format [west, south, east, north].
     *
     * @returns {Array<number>} GeoJSON bbox
     */
    to_bbox() {
        return [this._sw.lng, this._sw.lat, this._ne.lng, this._ne.lat];
    }

    /**
     * Convert to string representation.
     *
     * @param {number} [precision=6] - Decimal places
     * @returns {string} String representation
     */
    to_string(precision = 6) {
        return `Bounds(${this._sw.to_string(precision)}, ${this._ne.to_string(precision)})`;
    }

    // ==================== Static Factory Methods ====================

    /**
     * Create Bounds from various input formats.
     *
     * @param {Bounds|Array|Object} input - Input bounds
     * @returns {Bounds|null} Bounds instance or null if invalid
     */
    static from(input) {
        if (input instanceof Bounds) {
            return input;
        }

        // Array of two points: [[sw_lat, sw_lng], [ne_lat, ne_lng]]
        if (is_array(input) && input.length === 2) {
            const sw = LatLng.from(input[0]);
            const ne = LatLng.from(input[1]);
            if (sw && ne) {
                return new Bounds(sw, ne);
            }
        }

        // Object format: { south, west, north, east }
        if (is_object(input) && 'south' in input) {
            return new Bounds(
                new LatLng(input.south, input.west),
                new LatLng(input.north, input.east)
            );
        }

        // Object format: { southwest, northeast }
        if (is_object(input) && 'southwest' in input) {
            const sw = LatLng.from(input.southwest);
            const ne = LatLng.from(input.northeast);
            if (sw && ne) {
                return new Bounds(sw, ne);
            }
        }

        return null;
    }

    /**
     * Create Bounds from an array of points.
     *
     * @param {Array<LatLng|Array<number>|Object>} points - Array of coordinates
     * @returns {Bounds|null} Bounds containing all points or null if empty
     */
    static from_points(points) {
        if (!is_array(points) || points.length === 0) {
            return null;
        }

        let min_lat = Infinity;
        let max_lat = -Infinity;
        let min_lng = Infinity;
        let max_lng = -Infinity;
        let count = 0;

        for (const point of points) {
            const latlng = LatLng.from(point);
            if (latlng) {
                min_lat = Math.min(min_lat, latlng.lat);
                max_lat = Math.max(max_lat, latlng.lat);
                min_lng = Math.min(min_lng, latlng.lng);
                max_lng = Math.max(max_lng, latlng.lng);
                count++;
            }
        }

        if (count === 0) return null;

        return new Bounds(
            new LatLng(min_lat, min_lng),
            new LatLng(max_lat, max_lng)
        );
    }

    /**
     * Create Bounds from center point and radius.
     *
     * @param {LatLng|Array<number>|Object} center - Center coordinate
     * @param {number} radius - Radius in meters
     * @returns {Bounds} Bounds containing the circle
     */
    static from_center_radius(center, radius) {
        const c = LatLng.from(center);
        if (!c) {
            throw new TypeError('Invalid center coordinate');
        }

        // Calculate corners using destination
        const north = c.destination(radius, 0);
        const south = c.destination(radius, 180);
        const east = c.destination(radius, 90);
        const west = c.destination(radius, 270);

        return new Bounds(
            new LatLng(south.lat, west.lng),
            new LatLng(north.lat, east.lng)
        );
    }

    /**
     * Create Bounds from GeoJSON bbox [west, south, east, north].
     *
     * @param {Array<number>} bbox - GeoJSON bbox
     * @returns {Bounds} Bounds instance
     */
    static from_bbox(bbox) {
        if (!is_array(bbox) || bbox.length < 4) {
            throw new TypeError('Invalid bbox array');
        }
        return new Bounds(
            new LatLng(bbox[1], bbox[0]),  // south, west
            new LatLng(bbox[3], bbox[2])   // north, east
        );
    }

    /**
     * Get the union of multiple bounds.
     *
     * @param {Array<Bounds>} bounds_array - Array of Bounds
     * @returns {Bounds|null} Union of all bounds or null if empty
     */
    static union(bounds_array) {
        if (!is_array(bounds_array) || bounds_array.length === 0) {
            return null;
        }

        let result = bounds_array[0];
        for (let i = 1; i < bounds_array.length; i++) {
            if (bounds_array[i] instanceof Bounds) {
                result = result.extend_bounds(bounds_array[i]);
            }
        }

        return result;
    }
}
