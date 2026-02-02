/**
 * Viewport - Map view state management
 *
 * Manages the map's view state including center, zoom, and transforms.
 * Handles view animations and constraints.
 *
 * @example
 * const viewport = new Viewport(container, {
 *     center: [40.7128, -74.0060],
 *     zoom: 12
 * });
 * viewport.set_view([40.71, -74.00], 14);
 */

import { EventEmitter } from '../core/event_emitter.js';
import { clamp, is_number, request_frame, cancel_frame } from '../core/utils.js';
import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { Point } from '../geo/projection.js';
import { Transform, MIN_ZOOM, MAX_ZOOM } from '../geo/transform.js';
import { logger } from '../debug/logger.js';

/**
 * Default viewport options.
 */
const DEFAULT_OPTIONS = {
    center: [0, 0],
    zoom: 1,
    min_zoom: MIN_ZOOM,
    max_zoom: MAX_ZOOM,
    zoom_snap: 0,
    zoom_delta: 1,
    max_bounds: null,
    max_bounds_viscosity: 1.0
};

/**
 * Animation easing functions.
 */
const Easing = {
    linear: t => t,
    ease_in: t => t * t,
    ease_out: t => t * (2 - t),
    ease_in_out: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
};

/**
 * Viewport class for managing map view state.
 */
export class Viewport extends EventEmitter {
    /**
     * Create a new Viewport.
     *
     * @param {HTMLElement} container - Container element
     * @param {Object} [options] - Viewport options
     */
    constructor(container, options = {}) {
        super();

        this._container = container;
        this._options = { ...DEFAULT_OPTIONS, ...options };

        // Initialize transform
        const rect = container.getBoundingClientRect();
        this._transform = new Transform({
            center: this._options.center,
            zoom: this._options.zoom,
            width: rect.width || 100,
            height: rect.height || 100,
            min_zoom: this._options.min_zoom,
            max_zoom: this._options.max_zoom
        });

        // Animation state
        this._animation = null;
        this._animation_frame = null;

        // Max bounds constraint
        this._max_bounds = this._options.max_bounds
            ? Bounds.from(this._options.max_bounds)
            : null;
    }

    // ==================== Getters ====================

    /**
     * Get current center.
     *
     * @returns {LatLng} Center coordinate
     */
    get_center() {
        return this._transform.get_center();
    }

    /**
     * Get current zoom level.
     *
     * @returns {number} Zoom level
     */
    get_zoom() {
        return this._transform.get_zoom();
    }

    /**
     * Get visible geographic bounds.
     *
     * @returns {Bounds} Visible bounds
     */
    get_bounds() {
        return this._transform.get_bounds();
    }

    /**
     * Get container size.
     *
     * @returns {Object} Size { width, height }
     */
    get_size() {
        return {
            width: this._transform.get_width(),
            height: this._transform.get_height()
        };
    }

    /**
     * Get minimum zoom level.
     *
     * @returns {number} Minimum zoom
     */
    get_min_zoom() {
        return this._transform.get_min_zoom();
    }

    /**
     * Get maximum zoom level.
     *
     * @returns {number} Maximum zoom
     */
    get_max_zoom() {
        return this._transform.get_max_zoom();
    }

    /**
     * Get the transform object.
     *
     * @returns {Transform} Transform instance
     */
    get_transform() {
        return this._transform;
    }

    /**
     * Get meters per pixel at current view.
     *
     * @returns {number} Meters per pixel
     */
    get_resolution() {
        return this._transform.get_resolution();
    }

    /**
     * Get max bounds constraint.
     *
     * @returns {Bounds|null} Max bounds or null
     */
    get_max_bounds() {
        return this._max_bounds;
    }

    // ==================== Setters ====================

    /**
     * Set map center.
     *
     * @param {LatLng|Array<number>} center - New center
     * @param {Object} [options] - Options
     * @param {boolean} [options.animate=false] - Animate the change
     * @param {number} [options.duration=250] - Animation duration in ms
     * @returns {this} Returns this for chaining
     * @fires view:move
     */
    set_center(center, options = {}) {
        const ll = LatLng.from(center);
        if (!ll) return this;

        if (options.animate) {
            this._animate_to(ll, this.get_zoom(), options);
        } else {
            this._transform.set_center(this._constrain_center(ll));
            this._fire_move();
        }

        return this;
    }

    /**
     * Set zoom level.
     *
     * @param {number} zoom - New zoom level
     * @param {Object} [options] - Options
     * @param {boolean} [options.animate=false] - Animate the change
     * @param {number} [options.duration=250] - Animation duration in ms
     * @returns {this} Returns this for chaining
     * @fires view:zoom
     */
    set_zoom(zoom, options = {}) {
        if (!is_number(zoom)) return this;

        const snapped = this._snap_zoom(zoom);

        if (options.animate) {
            this._animate_to(this.get_center(), snapped, options);
        } else {
            this._transform.set_zoom(snapped);
            this._constrain_view();
            this._fire_zoom();
        }

        return this;
    }

    /**
     * Set center and zoom.
     *
     * @param {LatLng|Array<number>} center - New center
     * @param {number} zoom - New zoom level
     * @param {Object} [options] - Options
     * @param {boolean} [options.animate=false] - Animate the change
     * @param {number} [options.duration=250] - Animation duration in ms
     * @returns {this} Returns this for chaining
     * @fires view:move
     * @fires view:zoom
     */
    set_view(center, zoom, options = {}) {
        const ll = LatLng.from(center);
        const z = is_number(zoom) ? this._snap_zoom(zoom) : this.get_zoom();

        if (!ll) return this;

        if (options.animate) {
            this._animate_to(ll, z, options);
        } else {
            this._transform.set_view(this._constrain_center(ll), z);
            this._constrain_view();
            this._fire_move();
            this._fire_zoom();
        }

        return this;
    }

    /**
     * Set zoom constraints.
     *
     * @param {number} min - Minimum zoom
     * @param {number} max - Maximum zoom
     * @returns {this} Returns this for chaining
     */
    set_zoom_limits(min, max) {
        this._transform.set_zoom_limits(min, max);
        return this;
    }

    /**
     * Set max bounds constraint.
     *
     * @param {Bounds|Array|null} bounds - Max bounds or null to remove
     * @returns {this} Returns this for chaining
     */
    set_max_bounds(bounds) {
        this._max_bounds = bounds ? Bounds.from(bounds) : null;
        this._constrain_view();
        return this;
    }

    // ==================== View Operations ====================

    /**
     * Zoom in by delta.
     *
     * @param {number} [delta=1] - Zoom delta
     * @param {Object} [options] - Options
     * @returns {this} Returns this for chaining
     */
    zoom_in(delta = this._options.zoom_delta, options = {}) {
        return this.set_zoom(this.get_zoom() + delta, options);
    }

    /**
     * Zoom out by delta.
     *
     * @param {number} [delta=1] - Zoom delta
     * @param {Object} [options] - Options
     * @returns {this} Returns this for chaining
     */
    zoom_out(delta = this._options.zoom_delta, options = {}) {
        return this.set_zoom(this.get_zoom() - delta, options);
    }

    /**
     * Zoom around a specific point.
     *
     * @param {Point|Array<number>} point - Pixel point to zoom around
     * @param {number} delta - Zoom delta
     * @returns {this} Returns this for chaining
     */
    zoom_around(point, delta) {
        this._transform.zoom_around(delta, point);
        this._constrain_view();
        this._fire_move();
        this._fire_zoom();
        return this;
    }

    /**
     * Pan by pixel offset.
     *
     * @param {number} dx - X offset in pixels
     * @param {number} dy - Y offset in pixels
     * @param {Object} [options] - Options
     * @returns {this} Returns this for chaining
     */
    pan_by(dx, dy, options = {}) {
        if (options.animate) {
            const center = this.get_center();
            const target = this._transform.pixel_to_latlng(
                new Point(this._transform.get_width() / 2 - dx, this._transform.get_height() / 2 - dy)
            );
            this._animate_to(target, this.get_zoom(), options);
        } else {
            this._transform.pan_by(dx, dy);
            this._constrain_view();
            this._fire_move();
        }
        return this;
    }

    /**
     * Fit bounds in view.
     *
     * @param {Bounds|Array} bounds - Bounds to fit
     * @param {Object} [options] - Options
     * @param {number} [options.padding=0] - Padding in pixels
     * @param {number} [options.max_zoom] - Maximum zoom level
     * @param {boolean} [options.animate=false] - Animate the change
     * @returns {this} Returns this for chaining
     */
    fit_bounds(bounds, options = {}) {
        const b = Bounds.from(bounds);
        if (!b) return this;

        const { padding = 0, max_zoom, animate = false } = options;

        const size = this.get_size();
        const width = size.width - padding * 2;
        const height = size.height - padding * 2;

        if (width <= 0 || height <= 0) return this;

        // Calculate zoom to fit bounds
        const ne_pixel = this._transform.latlng_to_world(b.northeast);
        const sw_pixel = this._transform.latlng_to_world(b.southwest);
        const current_zoom = this.get_zoom();

        const bounds_width = Math.abs(ne_pixel.x - sw_pixel.x);
        const bounds_height = Math.abs(ne_pixel.y - sw_pixel.y);

        const zoom_x = current_zoom + Math.log2(width / bounds_width);
        const zoom_y = current_zoom + Math.log2(height / bounds_height);

        let zoom = Math.min(zoom_x, zoom_y);
        zoom = this._snap_zoom(zoom);

        if (max_zoom !== undefined) {
            zoom = Math.min(zoom, max_zoom);
        }

        const center = b.get_center();
        return this.set_view(center, zoom, { animate, duration: options.duration });
    }

    /**
     * Animated fly to a location.
     *
     * @param {LatLng|Array<number>} center - Target center
     * @param {number} [zoom] - Target zoom
     * @param {Object} [options] - Options
     * @param {number} [options.duration=1000] - Animation duration in ms
     * @returns {Promise<void>} Resolves when animation completes
     */
    fly_to(center, zoom, options = {}) {
        const ll = LatLng.from(center);
        const z = is_number(zoom) ? this._snap_zoom(zoom) : this.get_zoom();

        if (!ll) return Promise.resolve();

        return this._animate_to(ll, z, {
            duration: options.duration || 1000,
            easing: 'ease_in_out'
        });
    }

    // ==================== Coordinate Conversion ====================

    /**
     * Convert geographic coordinate to pixel coordinate.
     *
     * @param {LatLng|Array<number>} latlng - Geographic coordinate
     * @returns {Point} Container pixel coordinate
     */
    latlng_to_pixel(latlng) {
        return this._transform.latlng_to_pixel(latlng);
    }

    /**
     * Convert pixel coordinate to geographic coordinate.
     *
     * @param {Point|Array<number>} pixel - Container pixel coordinate
     * @returns {LatLng} Geographic coordinate
     */
    pixel_to_latlng(pixel) {
        return this._transform.pixel_to_latlng(pixel);
    }

    // ==================== Container ====================

    /**
     * Update container size.
     *
     * @returns {this} Returns this for chaining
     * @fires view:resize
     */
    invalidate_size() {
        const rect = this._container.getBoundingClientRect();
        this._transform.set_size(rect.width, rect.height);
        this._constrain_view();
        this.emit('view:resize', { width: rect.width, height: rect.height });
        return this;
    }

    // ==================== Animation ====================

    /**
     * Check if view is currently animating.
     *
     * @returns {boolean} True if animating
     */
    is_animating() {
        return this._animation !== null;
    }

    /**
     * Stop any current animation.
     *
     * @returns {this} Returns this for chaining
     */
    stop_animation() {
        if (this._animation_frame) {
            cancel_frame(this._animation_frame);
            this._animation_frame = null;
        }
        if (this._animation) {
            if (this._animation.reject) {
                this._animation.reject(new Error('Animation cancelled'));
            }
            this._animation = null;
            this.emit('view:animation_end');
        }
        return this;
    }

    /**
     * Animate to a target view.
     *
     * @param {LatLng} center - Target center
     * @param {number} zoom - Target zoom
     * @param {Object} options - Animation options
     * @returns {Promise<void>} Resolves when animation completes
     * @private
     */
    _animate_to(center, zoom, options) {
        this.stop_animation();

        const {
            duration = 250,
            easing = 'ease_out'
        } = options;

        const start_center = this.get_center();
        const start_zoom = this.get_zoom();
        const target_center = this._constrain_center(center);
        const target_zoom = clamp(zoom, this._transform.get_min_zoom(), this._transform.get_max_zoom());

        const ease_fn = Easing[easing] || Easing.ease_out;

        return new Promise((resolve, reject) => {
            const start_time = performance.now();

            this._animation = { resolve, reject };
            this.emit('view:animation_start');

            const step = (time) => {
                const elapsed = time - start_time;
                const t = Math.min(elapsed / duration, 1);
                const eased = ease_fn(t);

                // Interpolate center
                const lat = start_center.lat + (target_center.lat - start_center.lat) * eased;
                const lng = start_center.lng + (target_center.lng - start_center.lng) * eased;

                // Interpolate zoom
                const z = start_zoom + (target_zoom - start_zoom) * eased;

                this._transform.set_view(new LatLng(lat, lng), z);
                this._fire_move();

                if (t < 1) {
                    this._animation_frame = request_frame(step);
                } else {
                    this._animation = null;
                    this._animation_frame = null;
                    this.emit('view:animation_end');
                    resolve();
                }
            };

            this._animation_frame = request_frame(step);
        });
    }

    // ==================== Private ====================

    /**
     * Snap zoom to configured increment.
     *
     * @param {number} zoom - Zoom level
     * @returns {number} Snapped zoom
     * @private
     */
    _snap_zoom(zoom) {
        const snap = this._options.zoom_snap;
        if (snap > 0) {
            return Math.round(zoom / snap) * snap;
        }
        return zoom;
    }

    /**
     * Constrain center to max bounds.
     *
     * @param {LatLng} center - Center to constrain
     * @returns {LatLng} Constrained center
     * @private
     */
    _constrain_center(center) {
        if (!this._max_bounds) return center;

        const viscosity = this._options.max_bounds_viscosity;
        const bounds = this._max_bounds;

        let lat = center.lat;
        let lng = center.lng;

        if (lat < bounds.south) {
            lat = bounds.south + (lat - bounds.south) * (1 - viscosity);
        } else if (lat > bounds.north) {
            lat = bounds.north + (lat - bounds.north) * (1 - viscosity);
        }

        if (lng < bounds.west) {
            lng = bounds.west + (lng - bounds.west) * (1 - viscosity);
        } else if (lng > bounds.east) {
            lng = bounds.east + (lng - bounds.east) * (1 - viscosity);
        }

        return new LatLng(lat, lng);
    }

    /**
     * Apply view constraints.
     * @private
     */
    _constrain_view() {
        if (!this._max_bounds) return;

        const center = this._constrain_center(this.get_center());
        if (!center.equals(this.get_center())) {
            this._transform.set_center(center);
        }
    }

    /**
     * Fire move event.
     * @private
     */
    _fire_move() {
        const bounds = this.get_bounds();
        const center = this.get_center();

        this._trace_bounds('move', bounds, center);

        this.emit('view:move', {
            center: center,
            bounds: bounds
        });
    }

    /**
     * Fire zoom event.
     * @private
     */
    _fire_zoom() {
        const bounds = this.get_bounds();
        const center = this.get_center();
        const zoom = this.get_zoom();

        this._trace_bounds('zoom', bounds, center, zoom);

        this.emit('view:zoom', {
            zoom: zoom,
            center: center,
            bounds: bounds
        });
    }

    /**
     * Trace visible bounds for debugging.
     *
     * @param {string} event - Event type (move, zoom)
     * @param {Bounds} bounds - Visible bounds
     * @param {LatLng} center - View center
     * @param {number} [zoom] - Zoom level
     * @private
     */
    _trace_bounds(event, bounds, center, zoom) {
        if (bounds) {
            logger.debug(`[Viewport:${event}] Visible bounds:`, {
                north: bounds.north?.toFixed(4),
                south: bounds.south?.toFixed(4),
                east: bounds.east?.toFixed(4),
                west: bounds.west?.toFixed(4),
                center: center ? `${center.lat?.toFixed(4)}, ${center.lng?.toFixed(4)}` : 'N/A',
                zoom: zoom?.toFixed(2) ?? this.get_zoom()?.toFixed(2)
            });
        }
    }

    /**
     * Get visible bounds with tracing.
     * Logs the current visible bounds to console.
     *
     * @returns {Bounds} Visible bounds
     */
    trace_bounds() {
        const bounds = this.get_bounds();
        const center = this.get_center();
        const zoom = this.get_zoom();

        console.log('[Viewport] Current visible bounds:');
        console.log('  North:', bounds?.north?.toFixed(6));
        console.log('  South:', bounds?.south?.toFixed(6));
        console.log('  East:', bounds?.east?.toFixed(6));
        console.log('  West:', bounds?.west?.toFixed(6));
        console.log('  Center:', center?.lat?.toFixed(6), ',', center?.lng?.toFixed(6));
        console.log('  Zoom:', zoom?.toFixed(2));

        return bounds;
    }
}
