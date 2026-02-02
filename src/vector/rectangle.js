/**
 * Rectangle - Rectangle on the map
 *
 * Renders a rectangle defined by its bounds.
 *
 * @example
 * const rect = new Rectangle([
 *     [40.71, -74.01],
 *     [40.72, -74.00]
 * ], { fill: '#ff0000' });
 * rect.add_to(map);
 */

import { Polygon } from './polygon.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';

/**
 * Rectangle class for rectangular areas.
 */
export class Rectangle extends Polygon {
    /**
     * Create a new Rectangle.
     *
     * @param {Bounds|Array} bounds - Rectangle bounds
     * @param {Object} [options] - Rectangle options
     */
    constructor(bounds, options = {}) {
        // Initialize with empty polygon
        super([], options);

        this.set_bounds(bounds);
    }

    /**
     * Get rectangle bounds.
     *
     * @returns {Bounds} Rectangle bounds
     */
    get_bounds() {
        return this._bounds;
    }

    /**
     * Set rectangle bounds.
     *
     * @param {Bounds|Array} bounds - New bounds
     * @returns {this} Returns this for chaining
     */
    set_bounds(bounds) {
        const b = Bounds.from(bounds);
        if (!b) return this;

        this._bounds = b;

        // Convert bounds to polygon coordinates
        const coords = [
            [b.south, b.west],
            [b.north, b.west],
            [b.north, b.east],
            [b.south, b.east]
        ];

        // Set coordinates directly without recomputing bounds
        this._rings = [coords.map(ll => LatLng.from(ll))];
        this.redraw();

        return this;
    }

    /**
     * Get the center of the rectangle.
     *
     * @returns {LatLng} Center coordinate
     */
    get_center() {
        return this._bounds ? this._bounds.get_center() : null;
    }

    /**
     * Get the area in square meters.
     *
     * @returns {number} Area in square meters
     */
    get_area() {
        if (!this._bounds) return 0;

        // Use geodetic calculation
        const width = new LatLng(this._bounds.south, this._bounds.west)
            .distance_to(new LatLng(this._bounds.south, this._bounds.east));
        const height = new LatLng(this._bounds.south, this._bounds.west)
            .distance_to(new LatLng(this._bounds.north, this._bounds.west));

        return width * height;
    }

    /**
     * Convert to GeoJSON geometry.
     *
     * @returns {Object} GeoJSON Polygon geometry
     */
    to_geojson() {
        if (!this._bounds) {
            return { type: 'Polygon', coordinates: [[]] };
        }

        const b = this._bounds;
        return {
            type: 'Polygon',
            coordinates: [[
                [b.west, b.south],
                [b.east, b.south],
                [b.east, b.north],
                [b.west, b.north],
                [b.west, b.south]
            ]]
        };
    }

    /**
     * Create Rectangle from GeoJSON bbox.
     *
     * @param {Array<number>} bbox - GeoJSON bbox [west, south, east, north]
     * @param {Object} [options] - Rectangle options
     * @returns {Rectangle} New Rectangle instance
     */
    static from_bbox(bbox, options = {}) {
        return new Rectangle(Bounds.from_bbox(bbox), options);
    }
}
