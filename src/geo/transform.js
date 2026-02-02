/**
 * Transform - Coordinate transformation utilities
 *
 * Provides transformation between different coordinate systems:
 * - Geographic (lat/lng)
 * - Projected (meters)
 * - Pixel (screen coordinates)
 * - Container (relative to map container)
 *
 * @example
 * const transform = new Transform(center, zoom, container_size);
 * const pixel = transform.latlng_to_pixel(latlng);
 * const latlng = transform.pixel_to_latlng(pixel);
 */

import { LatLng } from './lat_lng.js';
import { Bounds } from './bounds.js';
import { Point, SphericalMercator, MAX_LATITUDE } from './projection.js';
import { clamp, is_number } from '../core/utils.js';

/**
 * Default minimum zoom level.
 * @constant {number}
 */
export const MIN_ZOOM = 0;

/**
 * Default maximum zoom level.
 * @constant {number}
 */
export const MAX_ZOOM = 22;

/**
 * Standard tile size in pixels.
 * @constant {number}
 */
export const TILE_SIZE = 256;

/**
 * Transform class for coordinate transformations.
 */
export class Transform {
    /**
     * Create a new Transform.
     *
     * @param {Object} options - Transform options
     * @param {LatLng|Array<number>} options.center - Map center
     * @param {number} options.zoom - Zoom level
     * @param {number} options.width - Container width in pixels
     * @param {number} options.height - Container height in pixels
     * @param {number} [options.min_zoom=0] - Minimum zoom level
     * @param {number} [options.max_zoom=22] - Maximum zoom level
     * @param {number} [options.tile_size=256] - Tile size in pixels
     */
    constructor(options) {
        const {
            center,
            zoom,
            width,
            height,
            min_zoom = MIN_ZOOM,
            max_zoom = MAX_ZOOM,
            tile_size = TILE_SIZE
        } = options;

        this._center = LatLng.from(center) || new LatLng(0, 0);
        this._zoom = clamp(zoom, min_zoom, max_zoom);
        this._width = width;
        this._height = height;
        this._min_zoom = min_zoom;
        this._max_zoom = max_zoom;
        this._tile_size = tile_size;

        this._update_cache();
    }

    /**
     * Update internal cached values.
     * @private
     */
    _update_cache() {
        this._scale = Math.pow(2, this._zoom);
        this._world_size = this._scale * this._tile_size;

        // Center in world pixel coordinates
        this._center_pixel = SphericalMercator.latlng_to_pixel(this._center, this._zoom);

        // Top-left corner in world pixel coordinates
        this._origin = new Point(
            this._center_pixel.x - this._width / 2,
            this._center_pixel.y - this._height / 2
        );
    }

    // ==================== Getters ====================

    /**
     * Get current center.
     * @returns {LatLng} Center coordinate
     */
    get_center() {
        return this._center;
    }

    /**
     * Get current zoom level.
     * @returns {number} Zoom level
     */
    get_zoom() {
        return this._zoom;
    }

    /**
     * Get container width.
     * @returns {number} Width in pixels
     */
    get_width() {
        return this._width;
    }

    /**
     * Get container height.
     * @returns {number} Height in pixels
     */
    get_height() {
        return this._height;
    }

    /**
     * Get minimum zoom level.
     * @returns {number} Minimum zoom
     */
    get_min_zoom() {
        return this._min_zoom;
    }

    /**
     * Get maximum zoom level.
     * @returns {number} Maximum zoom
     */
    get_max_zoom() {
        return this._max_zoom;
    }

    /**
     * Get current scale (2^zoom).
     * @returns {number} Scale factor
     */
    get_scale() {
        return this._scale;
    }

    /**
     * Get world size in pixels at current zoom.
     * @returns {number} World size in pixels
     */
    get_world_size() {
        return this._world_size;
    }

    /**
     * Get visible bounds.
     * @returns {Bounds} Visible geographic bounds
     */
    get_bounds() {
        const sw = this.pixel_to_latlng(new Point(0, this._height));
        const ne = this.pixel_to_latlng(new Point(this._width, 0));
        return new Bounds(sw, ne);
    }

    // ==================== Setters ====================

    /**
     * Set center.
     *
     * @param {LatLng|Array<number>} center - New center
     * @returns {this} Returns this for chaining
     */
    set_center(center) {
        const ll = LatLng.from(center);
        if (ll) {
            this._center = ll;
            this._update_cache();
        }
        return this;
    }

    /**
     * Set zoom level.
     *
     * @param {number} zoom - New zoom level
     * @returns {this} Returns this for chaining
     */
    set_zoom(zoom) {
        if (is_number(zoom)) {
            this._zoom = clamp(zoom, this._min_zoom, this._max_zoom);
            this._update_cache();
        }
        return this;
    }

    /**
     * Set center and zoom.
     *
     * @param {LatLng|Array<number>} center - New center
     * @param {number} zoom - New zoom level
     * @returns {this} Returns this for chaining
     */
    set_view(center, zoom) {
        const ll = LatLng.from(center);
        if (ll) {
            this._center = ll;
        }
        if (is_number(zoom)) {
            this._zoom = clamp(zoom, this._min_zoom, this._max_zoom);
        }
        this._update_cache();
        return this;
    }

    /**
     * Set container size.
     *
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     * @returns {this} Returns this for chaining
     */
    set_size(width, height) {
        this._width = width;
        this._height = height;
        this._update_cache();
        return this;
    }

    /**
     * Set zoom constraints.
     *
     * @param {number} min_zoom - Minimum zoom
     * @param {number} max_zoom - Maximum zoom
     * @returns {this} Returns this for chaining
     */
    set_zoom_limits(min_zoom, max_zoom) {
        this._min_zoom = min_zoom;
        this._max_zoom = max_zoom;
        this._zoom = clamp(this._zoom, min_zoom, max_zoom);
        this._update_cache();
        return this;
    }

    // ==================== Transformations ====================

    /**
     * Convert geographic coordinate to container pixel coordinate.
     *
     * @param {LatLng|Array<number>} latlng - Geographic coordinate
     * @returns {Point} Container pixel coordinate
     */
    latlng_to_pixel(latlng) {
        const ll = LatLng.from(latlng);
        if (!ll) {
            throw new TypeError('Invalid coordinate');
        }

        const world_pixel = SphericalMercator.latlng_to_pixel(ll, this._zoom);

        return new Point(
            world_pixel.x - this._origin.x,
            world_pixel.y - this._origin.y
        );
    }

    /**
     * Convert container pixel coordinate to geographic coordinate.
     *
     * @param {Point|Array<number>} pixel - Container pixel coordinate
     * @returns {LatLng} Geographic coordinate
     */
    pixel_to_latlng(pixel) {
        const p = Point.from(pixel);
        if (!p) {
            throw new TypeError('Invalid pixel coordinate');
        }

        const world_pixel = new Point(
            p.x + this._origin.x,
            p.y + this._origin.y
        );

        return SphericalMercator.pixel_to_latlng(world_pixel, this._zoom);
    }

    /**
     * Convert geographic coordinate to world pixel coordinate.
     *
     * @param {LatLng|Array<number>} latlng - Geographic coordinate
     * @returns {Point} World pixel coordinate
     */
    latlng_to_world(latlng) {
        return SphericalMercator.latlng_to_pixel(LatLng.from(latlng), this._zoom);
    }

    /**
     * Convert world pixel coordinate to geographic coordinate.
     *
     * @param {Point|Array<number>} pixel - World pixel coordinate
     * @returns {LatLng} Geographic coordinate
     */
    world_to_latlng(pixel) {
        return SphericalMercator.pixel_to_latlng(Point.from(pixel), this._zoom);
    }

    /**
     * Convert container pixel to world pixel.
     *
     * @param {Point|Array<number>} pixel - Container pixel coordinate
     * @returns {Point} World pixel coordinate
     */
    pixel_to_world(pixel) {
        const p = Point.from(pixel);
        return new Point(p.x + this._origin.x, p.y + this._origin.y);
    }

    /**
     * Convert world pixel to container pixel.
     *
     * @param {Point|Array<number>} world - World pixel coordinate
     * @returns {Point} Container pixel coordinate
     */
    world_to_pixel(world) {
        const w = Point.from(world);
        return new Point(w.x - this._origin.x, w.y - this._origin.y);
    }

    // ==================== Zoom Operations ====================

    /**
     * Zoom in by a delta, keeping a point fixed.
     *
     * @param {number} delta - Zoom delta (positive = zoom in)
     * @param {Point|Array<number>} [point] - Fixed point (default: center)
     * @returns {this} Returns this for chaining
     */
    zoom_around(delta, point) {
        const new_zoom = clamp(this._zoom + delta, this._min_zoom, this._max_zoom);
        if (new_zoom === this._zoom) return this;

        if (point) {
            // Zoom around specific point
            const p = Point.from(point);
            const latlng = this.pixel_to_latlng(p);

            this._zoom = new_zoom;
            this._update_cache();

            // Adjust center so the point stays at the same screen position
            const new_pixel = this.latlng_to_pixel(latlng);
            const dx = p.x - new_pixel.x;
            const dy = p.y - new_pixel.y;

            const center_pixel = new Point(
                this._width / 2 - dx,
                this._height / 2 - dy
            );
            this._center = this.pixel_to_latlng(center_pixel);
            this._update_cache();
        } else {
            // Zoom around center
            this._zoom = new_zoom;
            this._update_cache();
        }

        return this;
    }

    /**
     * Pan by pixel offset.
     *
     * @param {number} dx - X offset in pixels
     * @param {number} dy - Y offset in pixels
     * @returns {this} Returns this for chaining
     */
    pan_by(dx, dy) {
        const new_center_pixel = new Point(
            this._width / 2 - dx,
            this._height / 2 - dy
        );
        this._center = this.pixel_to_latlng(new_center_pixel);
        this._update_cache();
        return this;
    }

    // ==================== Utilities ====================

    /**
     * Get meters per pixel at current center and zoom.
     *
     * @returns {number} Meters per pixel
     */
    get_resolution() {
        return SphericalMercator.resolution_at
            ? (Math.cos(this._center.lat * Math.PI / 180) * 2 * Math.PI * 6378137) /
              this._world_size
            : 156543.03392804097 * Math.cos(this._center.lat * Math.PI / 180) /
              this._scale;
    }

    /**
     * Get scale denominator (e.g., 50000 for 1:50000).
     *
     * @param {number} [dpi=96] - Display DPI
     * @returns {number} Scale denominator
     */
    get_scale_denominator(dpi = 96) {
        const meters_per_pixel = this.get_resolution();
        return meters_per_pixel * dpi * 39.3701;
    }

    /**
     * Get visible tile coordinates.
     *
     * @returns {Array<Object>} Array of { x, y, z } tile coordinates
     */
    get_visible_tiles() {
        const tiles = [];
        const z = Math.floor(this._zoom);

        // Get bounds in tile coordinates
        const nw = SphericalMercator.latlng_to_tile(
            this.pixel_to_latlng(new Point(0, 0)),
            z
        );
        const se = SphericalMercator.latlng_to_tile(
            this.pixel_to_latlng(new Point(this._width, this._height)),
            z
        );

        const max_tile = Math.pow(2, z) - 1;

        for (let y = Math.max(0, nw.y - 1); y <= Math.min(max_tile, se.y + 1); y++) {
            for (let x = Math.max(0, nw.x - 1); x <= Math.min(max_tile, se.x + 1); x++) {
                tiles.push({ x, y, z });
            }
        }

        return tiles;
    }

    /**
     * Check if a point is within the visible bounds.
     *
     * @param {Point|Array<number>} pixel - Container pixel coordinate
     * @returns {boolean} True if visible
     */
    is_point_visible(pixel) {
        const p = Point.from(pixel);
        return p.x >= 0 && p.x <= this._width && p.y >= 0 && p.y <= this._height;
    }

    /**
     * Check if bounds intersect with visible area.
     *
     * @param {Bounds} bounds - Geographic bounds
     * @returns {boolean} True if any part is visible
     */
    is_bounds_visible(bounds) {
        const visible = this.get_bounds();
        return visible.intersects(bounds);
    }

    /**
     * Create a copy of this transform.
     *
     * @returns {Transform} New Transform with same state
     */
    clone() {
        return new Transform({
            center: this._center,
            zoom: this._zoom,
            width: this._width,
            height: this._height,
            min_zoom: this._min_zoom,
            max_zoom: this._max_zoom,
            tile_size: this._tile_size
        });
    }
}
