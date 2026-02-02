/**
 * LatLng - Immutable geographic coordinate
 *
 * Represents a geographic point with latitude and longitude.
 * All operations return new instances (immutable pattern).
 *
 * @example
 * const p1 = new LatLng(40.7128, -74.0060);
 * const p2 = p1.offset(0.1, 0.1);  // Returns new LatLng
 * console.log(p1 === p2);          // false
 */

import { is_number, is_array, is_object, to_radians, wrap, clamp } from '../core/utils.js';

/**
 * Earth's radius in meters (WGS84 mean radius).
 * @constant {number}
 */
export const EARTH_RADIUS = 6371008.8;

/**
 * LatLng class representing an immutable geographic coordinate.
 */
export class LatLng {
    /**
     * Create a new LatLng.
     *
     * @param {number} lat - Latitude in degrees (-90 to 90)
     * @param {number} lng - Longitude in degrees (-180 to 180)
     * @param {number} [alt] - Altitude in meters (optional)
     * @throws {TypeError} If lat or lng is not a valid number
     */
    constructor(lat, lng, alt) {
        if (!is_number(lat) || !is_number(lng)) {
            throw new TypeError('Latitude and longitude must be valid numbers');
        }

        // Clamp latitude to valid range
        this._lat = clamp(lat, -90, 90);
        // Wrap longitude to valid range
        this._lng = wrap(lng, -180, 180);
        // Altitude is optional
        this._alt = is_number(alt) ? alt : undefined;

        // Make immutable
        Object.freeze(this);
    }

    /**
     * Get latitude.
     * @type {number}
     */
    get lat() {
        return this._lat;
    }

    /**
     * Get longitude.
     * @type {number}
     */
    get lng() {
        return this._lng;
    }

    /**
     * Get altitude (may be undefined).
     * @type {number|undefined}
     */
    get alt() {
        return this._alt;
    }

    /**
     * Create a new LatLng offset from this one.
     *
     * @param {number} lat_offset - Latitude offset in degrees
     * @param {number} lng_offset - Longitude offset in degrees
     * @returns {LatLng} New LatLng instance
     */
    offset(lat_offset, lng_offset) {
        return new LatLng(
            this._lat + lat_offset,
            this._lng + lng_offset,
            this._alt
        );
    }

    /**
     * Calculate distance to another LatLng using Haversine formula.
     *
     * @param {LatLng|Array<number>|Object} other - Other coordinate
     * @returns {number} Distance in meters
     */
    distance_to(other) {
        const point = LatLng.from(other);
        if (!point) {
            throw new TypeError('Invalid coordinate');
        }

        const lat1 = to_radians(this._lat);
        const lat2 = to_radians(point.lat);
        const delta_lat = to_radians(point.lat - this._lat);
        const delta_lng = to_radians(point.lng - this._lng);

        const a = Math.sin(delta_lat / 2) ** 2 +
                  Math.cos(lat1) * Math.cos(lat2) * Math.sin(delta_lng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS * c;
    }

    /**
     * Calculate bearing to another LatLng.
     *
     * @param {LatLng|Array<number>|Object} other - Other coordinate
     * @returns {number} Bearing in degrees (0-360, where 0 is north)
     */
    bearing_to(other) {
        const point = LatLng.from(other);
        if (!point) {
            throw new TypeError('Invalid coordinate');
        }

        const lat1 = to_radians(this._lat);
        const lat2 = to_radians(point.lat);
        const delta_lng = to_radians(point.lng - this._lng);

        const y = Math.sin(delta_lng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta_lng);

        const bearing = Math.atan2(y, x) * (180 / Math.PI);
        return (bearing + 360) % 360;
    }

    /**
     * Calculate a new point at a given distance and bearing.
     *
     * @param {number} distance - Distance in meters
     * @param {number} bearing - Bearing in degrees (0-360)
     * @returns {LatLng} New LatLng instance
     */
    destination(distance, bearing) {
        const lat1 = to_radians(this._lat);
        const lng1 = to_radians(this._lng);
        const bearing_rad = to_radians(bearing);
        const angular_dist = distance / EARTH_RADIUS;

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(angular_dist) +
            Math.cos(lat1) * Math.sin(angular_dist) * Math.cos(bearing_rad)
        );

        const lng2 = lng1 + Math.atan2(
            Math.sin(bearing_rad) * Math.sin(angular_dist) * Math.cos(lat1),
            Math.cos(angular_dist) - Math.sin(lat1) * Math.sin(lat2)
        );

        return new LatLng(
            lat2 * (180 / Math.PI),
            lng2 * (180 / Math.PI),
            this._alt
        );
    }

    /**
     * Check if this LatLng equals another.
     *
     * @param {LatLng|Array<number>|Object} other - Other coordinate
     * @param {number} [tolerance=0] - Tolerance in degrees
     * @returns {boolean} True if equal within tolerance
     */
    equals(other, tolerance = 0) {
        const point = LatLng.from(other);
        if (!point) return false;

        if (tolerance === 0) {
            return this._lat === point.lat && this._lng === point.lng;
        }

        return Math.abs(this._lat - point.lat) <= tolerance &&
               Math.abs(this._lng - point.lng) <= tolerance;
    }

    /**
     * Convert to array format [lat, lng] or [lat, lng, alt].
     *
     * @returns {Array<number>} Coordinate array
     */
    to_array() {
        if (this._alt !== undefined) {
            return [this._lat, this._lng, this._alt];
        }
        return [this._lat, this._lng];
    }

    /**
     * Convert to object format { lat, lng } or { lat, lng, alt }.
     *
     * @returns {Object} Coordinate object
     */
    to_object() {
        const obj = { lat: this._lat, lng: this._lng };
        if (this._alt !== undefined) {
            obj.alt = this._alt;
        }
        return obj;
    }

    /**
     * Convert to GeoJSON coordinate [lng, lat] or [lng, lat, alt].
     *
     * @returns {Array<number>} GeoJSON coordinate (note: lng before lat)
     */
    to_geojson() {
        if (this._alt !== undefined) {
            return [this._lng, this._lat, this._alt];
        }
        return [this._lng, this._lat];
    }

    /**
     * Convert to string representation.
     *
     * @param {number} [precision=6] - Decimal places
     * @returns {string} String representation
     */
    to_string(precision = 6) {
        const lat = this._lat.toFixed(precision);
        const lng = this._lng.toFixed(precision);
        if (this._alt !== undefined) {
            return `LatLng(${lat}, ${lng}, ${this._alt.toFixed(2)})`;
        }
        return `LatLng(${lat}, ${lng})`;
    }

    /**
     * Wrap latitude to stay within -90 to 90 (clamp).
     *
     * @returns {LatLng} This instance (already clamped)
     */
    wrap_lat() {
        return this; // Already clamped in constructor
    }

    /**
     * Wrap longitude to stay within -180 to 180.
     *
     * @returns {LatLng} This instance (already wrapped)
     */
    wrap_lng() {
        return this; // Already wrapped in constructor
    }

    // ==================== Static Factory Methods ====================

    /**
     * Create LatLng from various input formats.
     *
     * @param {LatLng|Array<number>|Object|number} input - Input coordinate
     * @param {number} [lng] - Longitude if input is latitude number
     * @param {number} [alt] - Altitude if input is latitude number
     * @returns {LatLng|null} LatLng instance or null if invalid
     */
    static from(input, lng, alt) {
        if (input instanceof LatLng) {
            return input;
        }

        // Two/three number arguments: (lat, lng, alt?)
        if (is_number(input) && is_number(lng)) {
            return new LatLng(input, lng, alt);
        }

        // Array format: [lat, lng] or [lat, lng, alt]
        if (is_array(input) && input.length >= 2) {
            return new LatLng(input[0], input[1], input[2]);
        }

        // Object format: { lat, lng } or { latitude, longitude }
        if (is_object(input)) {
            const lat = input.lat ?? input.latitude;
            const lng_val = input.lng ?? input.lon ?? input.longitude;
            const alt_val = input.alt ?? input.altitude;
            if (is_number(lat) && is_number(lng_val)) {
                return new LatLng(lat, lng_val, alt_val);
            }
        }

        return null;
    }

    /**
     * Create LatLng from GeoJSON coordinate [lng, lat] or [lng, lat, alt].
     *
     * @param {Array<number>} coord - GeoJSON coordinate
     * @returns {LatLng} LatLng instance
     */
    static from_geojson(coord) {
        if (!is_array(coord) || coord.length < 2) {
            throw new TypeError('Invalid GeoJSON coordinate');
        }
        return new LatLng(coord[1], coord[0], coord[2]);
    }

    /**
     * Calculate the center point of multiple LatLngs.
     *
     * @param {Array<LatLng|Array<number>|Object>} points - Array of coordinates
     * @returns {LatLng|null} Center point or null if empty
     */
    static center(points) {
        if (!is_array(points) || points.length === 0) {
            return null;
        }

        let sum_lat = 0;
        let sum_lng = 0;
        let count = 0;

        for (const point of points) {
            const latlng = LatLng.from(point);
            if (latlng) {
                sum_lat += latlng.lat;
                sum_lng += latlng.lng;
                count++;
            }
        }

        if (count === 0) return null;

        return new LatLng(sum_lat / count, sum_lng / count);
    }

    /**
     * Calculate total distance along a path of points.
     *
     * @param {Array<LatLng|Array<number>|Object>} points - Array of coordinates
     * @returns {number} Total distance in meters
     */
    static path_distance(points) {
        if (!is_array(points) || points.length < 2) {
            return 0;
        }

        let total = 0;
        let prev = null;

        for (const point of points) {
            const latlng = LatLng.from(point);
            if (latlng) {
                if (prev) {
                    total += prev.distance_to(latlng);
                }
                prev = latlng;
            }
        }

        return total;
    }
}
