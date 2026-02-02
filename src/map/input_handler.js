/**
 * InputHandler - Mouse/keyboard/touch input handling
 *
 * Handles all user input for the map including:
 * - Mouse: click, double-click, drag, wheel
 * - Touch: tap, double-tap, pinch, drag
 * - Keyboard: arrow keys, +/- for zoom
 *
 * @example
 * const handler = new InputHandler(container, viewport);
 * handler.on('input:click', (e) => console.log('Clicked at', e.latlng));
 */

import { EventEmitter } from '../core/event_emitter.js';
import { Point } from '../geo/projection.js';

/**
 * Default input handler options.
 */
const DEFAULT_OPTIONS = {
    drag_enabled: true,
    scroll_zoom_enabled: true,
    double_click_zoom_enabled: true,
    keyboard_enabled: true,
    touch_enabled: true,
    inertia_enabled: true,
    inertia_deceleration: 3000,
    inertia_max_speed: 1500,
    wheel_debounce_time: 40,
    wheel_px_per_zoom_level: 60,
    tap_tolerance: 15,
    double_tap_delay: 300
};

/**
 * InputHandler class for processing user input.
 */
export class InputHandler extends EventEmitter {
    /**
     * Create a new InputHandler.
     *
     * @param {HTMLElement} container - Container element
     * @param {Viewport} viewport - Viewport instance
     * @param {Object} [options] - Handler options
     */
    constructor(container, viewport, options = {}) {
        super();

        this._container = container;
        this._viewport = viewport;
        this._options = { ...DEFAULT_OPTIONS, ...options };

        // State
        this._enabled = true;
        this._dragging = false;
        this._drag_start = null;
        this._last_move = null;
        this._inertia_positions = [];

        // Touch state
        this._touches = new Map();
        this._pinch_start_distance = null;
        this._pinch_start_zoom = null;
        this._last_tap = null;

        // Wheel state
        this._wheel_delta = 0;
        this._wheel_timer = null;

        // Bind event handlers
        this._on_mouse_down = this._on_mouse_down.bind(this);
        this._on_mouse_move = this._on_mouse_move.bind(this);
        this._on_mouse_up = this._on_mouse_up.bind(this);
        this._on_click = this._on_click.bind(this);
        this._on_dblclick = this._on_dblclick.bind(this);
        this._on_contextmenu = this._on_contextmenu.bind(this);
        this._on_wheel = this._on_wheel.bind(this);
        this._on_keydown = this._on_keydown.bind(this);
        this._on_touch_start = this._on_touch_start.bind(this);
        this._on_touch_move = this._on_touch_move.bind(this);
        this._on_touch_end = this._on_touch_end.bind(this);

        this._attach_listeners();
    }

    // ==================== Public API ====================

    /**
     * Enable input handling.
     *
     * @returns {this} Returns this for chaining
     */
    enable() {
        this._enabled = true;
        return this;
    }

    /**
     * Disable input handling.
     *
     * @returns {this} Returns this for chaining
     */
    disable() {
        this._enabled = false;
        this._stop_drag();
        return this;
    }

    /**
     * Check if input handling is enabled.
     *
     * @returns {boolean} True if enabled
     */
    is_enabled() {
        return this._enabled;
    }

    /**
     * Enable or disable specific input types.
     *
     * @param {string} type - Input type ('drag', 'scroll_zoom', etc.)
     * @param {boolean} enabled - Enable or disable
     * @returns {this} Returns this for chaining
     */
    set_option(type, enabled) {
        const key = `${type}_enabled`;
        if (key in this._options) {
            this._options[key] = enabled;
        }
        return this;
    }

    /**
     * Dispose of the handler and remove listeners.
     */
    dispose() {
        this._detach_listeners();
        this._stop_drag();
        this.off_all();
    }

    // ==================== Event Listeners ====================

    /**
     * Attach event listeners to container.
     * @private
     */
    _attach_listeners() {
        const c = this._container;

        // Mouse events
        c.addEventListener('mousedown', this._on_mouse_down);
        c.addEventListener('click', this._on_click);
        c.addEventListener('dblclick', this._on_dblclick);
        c.addEventListener('contextmenu', this._on_contextmenu);
        c.addEventListener('wheel', this._on_wheel, { passive: false });

        // Touch events
        if (this._options.touch_enabled) {
            c.addEventListener('touchstart', this._on_touch_start, { passive: false });
            c.addEventListener('touchmove', this._on_touch_move, { passive: false });
            c.addEventListener('touchend', this._on_touch_end);
            c.addEventListener('touchcancel', this._on_touch_end);
        }

        // Keyboard events (on document for focus)
        if (this._options.keyboard_enabled) {
            document.addEventListener('keydown', this._on_keydown);
        }
    }

    /**
     * Detach event listeners from container.
     * @private
     */
    _detach_listeners() {
        const c = this._container;

        c.removeEventListener('mousedown', this._on_mouse_down);
        c.removeEventListener('click', this._on_click);
        c.removeEventListener('dblclick', this._on_dblclick);
        c.removeEventListener('contextmenu', this._on_contextmenu);
        c.removeEventListener('wheel', this._on_wheel);

        c.removeEventListener('touchstart', this._on_touch_start);
        c.removeEventListener('touchmove', this._on_touch_move);
        c.removeEventListener('touchend', this._on_touch_end);
        c.removeEventListener('touchcancel', this._on_touch_end);

        document.removeEventListener('keydown', this._on_keydown);
        document.removeEventListener('mousemove', this._on_mouse_move);
        document.removeEventListener('mouseup', this._on_mouse_up);
    }

    // ==================== Mouse Handlers ====================

    /**
     * Handle mouse down event.
     * @private
     */
    _on_mouse_down(e) {
        if (!this._enabled || !this._options.drag_enabled) return;
        if (e.button !== 0) return; // Left button only

        this._start_drag(this._get_mouse_point(e));
        document.addEventListener('mousemove', this._on_mouse_move);
        document.addEventListener('mouseup', this._on_mouse_up);

        this.emit('input:pointer_down', {
            point: this._drag_start,
            latlng: this._viewport.pixel_to_latlng(this._drag_start),
            original_event: e
        });
    }

    /**
     * Handle mouse move event.
     * @private
     */
    _on_mouse_move(e) {
        if (!this._dragging) return;

        const point = this._get_mouse_point(e);
        this._update_drag(point);

        this.emit('input:pointer_move', {
            point,
            latlng: this._viewport.pixel_to_latlng(point),
            original_event: e
        });
    }

    /**
     * Handle mouse up event.
     * @private
     */
    _on_mouse_up(e) {
        document.removeEventListener('mousemove', this._on_mouse_move);
        document.removeEventListener('mouseup', this._on_mouse_up);

        const point = this._get_mouse_point(e);
        this._end_drag(point);

        this.emit('input:pointer_up', {
            point,
            latlng: this._viewport.pixel_to_latlng(point),
            original_event: e
        });
    }

    /**
     * Handle click event.
     * @private
     */
    _on_click(e) {
        if (!this._enabled) return;

        const point = this._get_mouse_point(e);
        this.emit('input:click', {
            point,
            latlng: this._viewport.pixel_to_latlng(point),
            original_event: e
        });
    }

    /**
     * Handle double-click event.
     * @private
     */
    _on_dblclick(e) {
        if (!this._enabled || !this._options.double_click_zoom_enabled) return;

        e.preventDefault();
        const point = this._get_mouse_point(e);

        this._viewport.zoom_around(point, 1);

        this.emit('input:dblclick', {
            point,
            latlng: this._viewport.pixel_to_latlng(point),
            original_event: e
        });
    }

    /**
     * Handle context menu event.
     * @private
     */
    _on_contextmenu(e) {
        if (!this._enabled) return;

        const point = this._get_mouse_point(e);
        this.emit('input:contextmenu', {
            point,
            latlng: this._viewport.pixel_to_latlng(point),
            original_event: e
        });
    }

    /**
     * Handle wheel event.
     * @private
     */
    _on_wheel(e) {
        if (!this._enabled || !this._options.scroll_zoom_enabled) return;

        e.preventDefault();

        const point = this._get_mouse_point(e);
        const delta = -e.deltaY;

        // Accumulate wheel delta for smoother zooming
        this._wheel_delta += delta;

        if (this._wheel_timer) {
            clearTimeout(this._wheel_timer);
        }

        this._wheel_timer = setTimeout(() => {
            const zoom_delta = this._wheel_delta / this._options.wheel_px_per_zoom_level;
            this._viewport.zoom_around(point, zoom_delta);

            this._wheel_delta = 0;
            this._wheel_timer = null;

            this.emit('input:wheel', {
                point,
                delta: zoom_delta,
                original_event: e
            });
        }, this._options.wheel_debounce_time);
    }

    // ==================== Touch Handlers ====================

    /**
     * Handle touch start event.
     * @private
     */
    _on_touch_start(e) {
        if (!this._enabled) return;

        e.preventDefault();

        for (const touch of e.changedTouches) {
            this._touches.set(touch.identifier, this._get_touch_point(touch));
        }

        if (this._touches.size === 1) {
            // Single touch - drag or tap
            const point = this._touches.values().next().value;

            // Check for double tap
            const now = Date.now();
            if (this._last_tap &&
                now - this._last_tap.time < this._options.double_tap_delay &&
                point.distance_to(this._last_tap.point) < this._options.tap_tolerance) {

                if (this._options.double_click_zoom_enabled) {
                    this._viewport.zoom_around(point, 1);
                }
                this.emit('input:double_tap', { point, latlng: this._viewport.pixel_to_latlng(point) });
                this._last_tap = null;
            } else {
                this._last_tap = { time: now, point };
                this._start_drag(point);
            }
        } else if (this._touches.size === 2) {
            // Two touches - pinch zoom
            this._stop_drag();
            const points = Array.from(this._touches.values());
            this._pinch_start_distance = points[0].distance_to(points[1]);
            this._pinch_start_zoom = this._viewport.get_zoom();
        }
    }

    /**
     * Handle touch move event.
     * @private
     */
    _on_touch_move(e) {
        if (!this._enabled) return;

        e.preventDefault();

        for (const touch of e.changedTouches) {
            this._touches.set(touch.identifier, this._get_touch_point(touch));
        }

        if (this._touches.size === 1 && this._dragging) {
            // Single touch drag
            const point = this._touches.values().next().value;
            this._update_drag(point);
        } else if (this._touches.size === 2 && this._pinch_start_distance) {
            // Pinch zoom
            const points = Array.from(this._touches.values());
            const distance = points[0].distance_to(points[1]);
            const scale = distance / this._pinch_start_distance;
            const zoom = this._pinch_start_zoom + Math.log2(scale);

            // Zoom around pinch center
            const center = new Point(
                (points[0].x + points[1].x) / 2,
                (points[0].y + points[1].y) / 2
            );

            this._viewport.set_zoom(zoom);

            this.emit('input:pinch', {
                center,
                scale,
                zoom
            });
        }
    }

    /**
     * Handle touch end event.
     * @private
     */
    _on_touch_end(e) {
        for (const touch of e.changedTouches) {
            this._touches.delete(touch.identifier);
        }

        if (this._touches.size === 0) {
            if (this._dragging) {
                this._end_drag(this._last_move);
            }
            this._pinch_start_distance = null;
            this._pinch_start_zoom = null;
        } else if (this._touches.size === 1) {
            // Switched from pinch to drag
            this._pinch_start_distance = null;
            const point = this._touches.values().next().value;
            this._start_drag(point);
        }
    }

    // ==================== Keyboard Handler ====================

    /**
     * Handle keydown event.
     * @private
     */
    _on_keydown(e) {
        if (!this._enabled || !this._options.keyboard_enabled) return;

        // Only handle if map container is focused or no element is focused
        if (document.activeElement &&
            document.activeElement !== document.body &&
            !this._container.contains(document.activeElement)) {
            return;
        }

        const pan_delta = 80;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this._viewport.pan_by(pan_delta, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this._viewport.pan_by(-pan_delta, 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._viewport.pan_by(0, pan_delta);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this._viewport.pan_by(0, -pan_delta);
                break;
            case '+':
            case '=':
                e.preventDefault();
                this._viewport.zoom_in();
                break;
            case '-':
            case '_':
                e.preventDefault();
                this._viewport.zoom_out();
                break;
            default:
                return;
        }

        this.emit('input:key_press', {
            key: e.key,
            original_event: e
        });
    }

    // ==================== Drag Handling ====================

    /**
     * Start drag operation.
     * @private
     */
    _start_drag(point) {
        this._dragging = true;
        this._drag_start = point;
        this._last_move = point;
        this._inertia_positions = [{ point, time: Date.now() }];
        this._viewport.stop_animation();

        this.emit('input:drag_start', {
            point,
            latlng: this._viewport.pixel_to_latlng(point)
        });
    }

    /**
     * Update drag operation.
     * @private
     */
    _update_drag(point) {
        if (!this._dragging || !this._last_move) return;

        const dx = point.x - this._last_move.x;
        const dy = point.y - this._last_move.y;

        this._viewport.pan_by(dx, dy);
        this._last_move = point;

        // Record for inertia
        const now = Date.now();
        this._inertia_positions.push({ point, time: now });

        // Keep only recent positions
        while (this._inertia_positions.length > 0 &&
               now - this._inertia_positions[0].time > 150) {
            this._inertia_positions.shift();
        }

        this.emit('input:drag', {
            point,
            latlng: this._viewport.pixel_to_latlng(point)
        });
    }

    /**
     * End drag operation.
     * @private
     */
    _end_drag(point) {
        if (!this._dragging) return;

        this._dragging = false;

        // Apply inertia
        if (this._options.inertia_enabled && this._inertia_positions.length >= 2) {
            this._apply_inertia();
        }

        this.emit('input:drag_end', {
            point,
            latlng: this._viewport.pixel_to_latlng(point)
        });
    }

    /**
     * Stop drag operation.
     * @private
     */
    _stop_drag() {
        this._dragging = false;
        this._drag_start = null;
        this._last_move = null;
        this._inertia_positions = [];
    }

    /**
     * Apply inertia after drag.
     * @private
     */
    _apply_inertia() {
        if (this._inertia_positions.length < 2) return;

        const first = this._inertia_positions[0];
        const last = this._inertia_positions[this._inertia_positions.length - 1];
        const duration = last.time - first.time;

        if (duration === 0) return;

        let vx = (last.point.x - first.point.x) / duration * 1000;
        let vy = (last.point.y - first.point.y) / duration * 1000;

        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed < 100) return;

        // Clamp speed
        const max_speed = this._options.inertia_max_speed;
        if (speed > max_speed) {
            const ratio = max_speed / speed;
            vx *= ratio;
            vy *= ratio;
        }

        // Calculate pan distance
        const decel = this._options.inertia_deceleration;
        const t = speed / decel;
        const dx = vx * t / 2;
        const dy = vy * t / 2;

        this._viewport.pan_by(-dx, -dy, {
            animate: true,
            duration: t * 1000
        });
    }

    // ==================== Utilities ====================

    /**
     * Get point from mouse event.
     * @private
     */
    _get_mouse_point(e) {
        const rect = this._container.getBoundingClientRect();
        return new Point(e.clientX - rect.left, e.clientY - rect.top);
    }

    /**
     * Get point from touch.
     * @private
     */
    _get_touch_point(touch) {
        const rect = this._container.getBoundingClientRect();
        return new Point(touch.clientX - rect.left, touch.clientY - rect.top);
    }
}
