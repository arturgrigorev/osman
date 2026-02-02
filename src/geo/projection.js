/**
 * Projection - Web Mercator (EPSG:3857) projection
 *
 * Handles conversion between geographic coordinates (lat/lng) and
 * projected coordinates (meters) using the Web Mercator projection.
 *
 * @example
 * const point = Projection.project(new LatLng(40.7128, -74.0060));
 * // { x: -8238310.24, y: 4970071.57 }
 *
 * const latlng = Projection.unproject(point);
 * // LatLng(40.7128, -74.0060)
 */

import { LatLng, EARTH_RADIUS } from './lat_lng.js';
import { is_number, is_object, clamp } from '../core/utils.js';

/**
 * Maximum latitude for Web Mercator projection.
 * Beyond this, the projection becomes infinite.
 * @constant {number}
 */
export const MAX_LATITUDE = 85.051128779806604;

/**
 * Semi-major axis of WGS84 ellipsoid in meters.
 * @constant {number}
 */
export const SEMI_MAJOR_AXIS = 6378137;

/**
 * Projection origin shift (half the Earth's circumference).
 * @constant {number}
 */
export const ORIGIN_SHIFT = Math.PI * SEMI_MAJOR_AXIS;

/**
 * Point - Represents a 2D point in projected coordinates.
 */
export class Point {
    /**
     * Create a new Point.
     *
     * @param {number} x - X coordinate (meters or pixels)
     * @param {number} y - Y coordinate (meters or pixels)
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        Object.freeze(this);
    }

    /**
     * Add another point.
     *
     * @param {Point} other - Point to add
     * @returns {Point} New Point
     */
    add(other) {
        return new Point(this.x + other.x, this.y + other.y);
    }

    /**
     * Subtract another point.
     *
     * @param {Point} other - Point to subtract
     * @returns {Point} New Point
     */
    subtract(other) {
        return new Point(this.x - other.x, this.y - other.y);
    }

    /**
     * Multiply by a scalar.
     *
     * @param {number} k - Scalar value
     * @returns {Point} New Point
     */
    multiply(k) {
        return new Point(this.x * k, this.y * k);
    }

    /**
     * Divide by a scalar.
     *
     * @param {number} k - Scalar value
     * @returns {Point} New Point
     */
    divide(k) {
        return new Point(this.x / k, this.y / k);
    }

    /**
     * Calculate distance to another point.
     *
     * @param {Point} other - Other point
     * @returns {number} Distance
     */
    distance_to(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Check if equal to another point.
     *
     * @param {Point} other - Other point
     * @param {number} [tolerance=0] - Tolerance
     * @returns {boolean} True if equal
     */
    equals(other, tolerance = 0) {
        if (!(other instanceof Point)) return false;
        if (tolerance === 0) {
            return this.x === other.x && this.y === other.y;
        }
        return Math.abs(this.x - other.x) <= tolerance &&
               Math.abs(this.y - other.y) <= tolerance;
    }

    /**
     * Round coordinates to integers.
     *
     * @returns {Point} New Point with rounded coordinates
     */
    round() {
        return new Point(Math.round(this.x), Math.round(this.y));
    }

    /**
     * Floor coordinates to integers.
     *
     * @returns {Point} New Point with floored coordinates
     */
    floor() {
        return new Point(Math.floor(this.x), Math.floor(this.y));
    }

    /**
     * Ceil coordinates to integers.
     *
     * @returns {Point} New Point with ceiled coordinates
     */
    ceil() {
        return new Point(Math.ceil(this.x), Math.ceil(this.y));
    }

    /**
     * Convert to array format [x, y].
     *
     * @returns {Array<number>} Point array
     */
    to_array() {
        return [this.x, this.y];
    }

    /**
     * Convert to string representation.
     *
     * @returns {string} String representation
     */
    to_string() {
        return `Point(${this.x}, ${this.y})`;
    }

    /**
     * Create Point from various formats.
     *
     * @param {Point|Array<number>|Object} input - Input
     * @returns {Point|null} Point or null
     */
    static from(input) {
        if (input instanceof Point) return input;

        if (Array.isArray(input) && input.length >= 2) {
            return new Point(input[0], input[1]);
        }

        if (is_object(input) && is_number(input.x) && is_number(input.y)) {
            return new Point(input.x, input.y);
        }

        return null;
    }
}

/**
 * Projection utilities for Web Mercator (EPSG:3857).
 */
export const Projection = {
    /**
     * Project LatLng to meters (EPSG:3857).
     *
     * @param {LatLng|Array<number>|Object} latlng - Geographic coordinate
     * @returns {Point} Projected point in meters
     */
    project(latlng) {
        const ll = LatLng.from(latlng);
        if (!ll) {
            throw new TypeError('Invalid coordinate');
        }

        // Clamp latitude to prevent infinity
        const lat = clamp(ll.lat, -MAX_LATITUDE, MAX_LATITUDE);
        const lng = ll.lng;

        const x = lng * ORIGIN_SHIFT / 180;
        const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * ORIGIN_SHIFT / Math.PI;

        return new Point(x, y);
    },

    /**
     * Unproject meters to LatLng.
     *
     * @param {Point|Array<number>|Object} point - Projected point in meters
     * @returns {LatLng} Geographic coordinate
     */
    unproject(point) {
        const p = Point.from(point);
        if (!p) {
            throw new TypeError('Invalid point');
        }

        const lng = p.x * 180 / ORIGIN_SHIFT;
        const lat = (Math.atan(Math.exp(p.y * Math.PI / ORIGIN_SHIFT)) * 360 / Math.PI) - 90;

        return new LatLng(lat, lng);
    },

    /**
     * Get the scale factor at a given latitude.
     * Web Mercator scale increases towards poles.
     *
     * @param {number} lat - Latitude in degrees
     * @returns {number} Scale factor (1.0 at equator)
     */
    scale_at(lat) {
        return 1 / Math.cos(lat * Math.PI / 180);
    },

    /**
     * Calculate ground resolution (meters per pixel) at a given latitude and zoom.
     *
     * @param {number} lat - Latitude in degrees
     * @param {number} zoom - Zoom level
     * @returns {number} Meters per pixel
     */
    resolution_at(lat, zoom) {
        const tiles = Math.pow(2, zoom);
        const circumference = 2 * Math.PI * SEMI_MAJOR_AXIS;
        const tile_size = 256;
        return (circumference * Math.cos(lat * Math.PI / 180)) / (tiles * tile_size);
    },

    /**
     * Calculate map scale denominator at a given latitude, zoom, and DPI.
     *
     * @param {number} lat - Latitude in degrees
     * @param {number} zoom - Zoom level
     * @param {number} [dpi=96] - Display DPI
     * @returns {number} Scale denominator (e.g., 50000 for 1:50000)
     */
    scale_denominator_at(lat, zoom, dpi = 96) {
        const meters_per_pixel = this.resolution_at(lat, zoom);
        const inches_per_meter = 39.3701;
        return meters_per_pixel * dpi * inches_per_meter;
    },

    /**
     * Get the bounds of the projection (world bounds in meters).
     *
     * @returns {Object} Bounds { min: Point, max: Point }
     */
    get_bounds() {
        return {
            min: new Point(-ORIGIN_SHIFT, -ORIGIN_SHIFT),
            max: new Point(ORIGIN_SHIFT, ORIGIN_SHIFT)
        };
    },

    /**
     * Check if a latitude is within the valid range for Web Mercator.
     *
     * @param {number} lat - Latitude in degrees
     * @returns {boolean} True if valid
     */
    is_valid_latitude(lat) {
        return lat >= -MAX_LATITUDE && lat <= MAX_LATITUDE;
    }
};

/**
 * SphericalMercator utilities for tile-based operations.
 */
export const SphericalMercator = {
    /**
     * Convert LatLng to tile coordinates at a given zoom.
     *
     * @param {LatLng|Array<number>|Object} latlng - Geographic coordinate
     * @param {number} zoom - Zoom level
     * @returns {Object} Tile coordinates { x, y, z }
     */
    latlng_to_tile(latlng, zoom) {
        const ll = LatLng.from(latlng);
        if (!ll) {
            throw new TypeError('Invalid coordinate');
        }

        const lat = clamp(ll.lat, -MAX_LATITUDE, MAX_LATITUDE);
        const n = Math.pow(2, zoom);

        const x = Math.floor((ll.lng + 180) / 360 * n);
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
                  1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);

        return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1), z: zoom };
    },

    /**
     * Convert tile coordinates to LatLng (northwest corner of tile).
     *
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {number} z - Zoom level
     * @returns {LatLng} Northwest corner of tile
     */
    tile_to_latlng(x, y, z) {
        const n = Math.pow(2, z);
        const lng = x / n * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;

        return new LatLng(lat, lng);
    },

    /**
     * Get the bounds of a tile.
     *
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {number} z - Zoom level
     * @returns {Object} Bounds { nw: LatLng, se: LatLng }
     */
    tile_bounds(x, y, z) {
        const nw = this.tile_to_latlng(x, y, z);
        const se = this.tile_to_latlng(x + 1, y + 1, z);

        return { nw, se };
    },

    /**
     * Convert LatLng to pixel coordinates within world at a given zoom.
     *
     * @param {LatLng|Array<number>|Object} latlng - Geographic coordinate
     * @param {number} zoom - Zoom level
     * @returns {Point} Pixel coordinates
     */
    latlng_to_pixel(latlng, zoom) {
        const ll = LatLng.from(latlng);
        if (!ll) {
            throw new TypeError('Invalid coordinate');
        }

        const lat = clamp(ll.lat, -MAX_LATITUDE, MAX_LATITUDE);
        const scale = Math.pow(2, zoom) * 256;

        const x = (ll.lng + 180) / 360 * scale;
        const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) +
                  1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale;

        return new Point(x, y);
    },

    /**
     * Convert pixel coordinates to LatLng at a given zoom.
     *
     * @param {Point|Array<number>|Object} pixel - Pixel coordinates
     * @param {number} zoom - Zoom level
     * @returns {LatLng} Geographic coordinate
     */
    pixel_to_latlng(pixel, zoom) {
        const p = Point.from(pixel);
        if (!p) {
            throw new TypeError('Invalid pixel coordinates');
        }

        const scale = Math.pow(2, zoom) * 256;
        const lng = p.x / scale * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * p.y / scale))) * 180 / Math.PI;

        return new LatLng(lat, lng);
    },

    /**
     * Get the number of tiles at a zoom level.
     *
     * @param {number} zoom - Zoom level
     * @returns {number} Number of tiles per axis
     */
    tiles_at_zoom(zoom) {
        return Math.pow(2, zoom);
    },

    /**
     * Get world size in pixels at a zoom level.
     *
     * @param {number} zoom - Zoom level
     * @returns {number} World size in pixels
     */
    world_size_at_zoom(zoom) {
        return Math.pow(2, zoom) * 256;
    }
};
