/**
 * Renderer - Canvas drawing engine
 *
 * Handles all canvas-based rendering for vector layers.
 * Uses Strategy pattern for different rendering approaches.
 *
 * @example
 * const renderer = new Renderer(canvas, transform);
 * renderer.draw_polygon(coords, style);
 * renderer.draw_polyline(coords, style);
 */

import { Point } from '../geo/projection.js';
import { LatLng } from '../geo/lat_lng.js';

/**
 * Default render style.
 */
const DEFAULT_STYLE = {
    stroke: '#3388ff',
    stroke_width: 2,
    stroke_opacity: 1,
    stroke_dasharray: null,
    stroke_linecap: 'round',
    stroke_linejoin: 'round',
    fill: '#3388ff',
    fill_opacity: 0.2,
    opacity: 1
};

/**
 * Renderer class for canvas operations.
 */
export class Renderer {
    /**
     * Create a new Renderer.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Transform} transform - Coordinate transform
     */
    constructor(ctx, transform) {
        this._ctx = ctx;
        this._transform = transform;
    }

    /**
     * Set the transform.
     *
     * @param {Transform} transform - New transform
     */
    set_transform(transform) {
        this._transform = transform;
    }

    /**
     * Clear the canvas.
     *
     * @param {number} [width] - Width to clear
     * @param {number} [height] - Height to clear
     */
    clear(width, height) {
        const w = width || this._transform.get_width();
        const h = height || this._transform.get_height();
        this._ctx.clearRect(0, 0, w, h);
    }

    // ==================== Style Application ====================

    /**
     * Apply stroke style to context.
     *
     * @param {Object} style - Style object
     * @private
     */
    _apply_stroke(style) {
        const ctx = this._ctx;
        const s = { ...DEFAULT_STYLE, ...style };

        if (!s.stroke) return false;

        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.stroke_width;
        ctx.lineCap = s.stroke_linecap;
        ctx.lineJoin = s.stroke_linejoin;
        ctx.globalAlpha = s.opacity * s.stroke_opacity;

        if (s.stroke_dasharray) {
            const dashes = s.stroke_dasharray.split(',').map(Number);
            ctx.setLineDash(dashes);
        } else {
            ctx.setLineDash([]);
        }

        return true;
    }

    /**
     * Apply fill style to context.
     *
     * @param {Object} style - Style object
     * @private
     */
    _apply_fill(style) {
        const ctx = this._ctx;
        const s = { ...DEFAULT_STYLE, ...style };

        if (!s.fill || s.fill === 'none' || s.fill === 'transparent') return false;

        ctx.fillStyle = s.fill;
        ctx.globalAlpha = s.opacity * s.fill_opacity;

        return true;
    }

    /**
     * Reset context state.
     * @private
     */
    _reset() {
        this._ctx.globalAlpha = 1;
        this._ctx.setLineDash([]);
    }

    // ==================== Coordinate Conversion ====================

    /**
     * Convert geographic coordinates to pixel array.
     *
     * @param {Array<LatLng|Array>} coords - Geographic coordinates
     * @returns {Array<Point>} Pixel coordinates
     * @private
     */
    _to_pixels(coords) {
        return coords.map(coord => {
            const ll = LatLng.from(coord);
            return this._transform.latlng_to_pixel(ll);
        });
    }

    // ==================== Drawing Methods ====================

    /**
     * Draw a polyline.
     *
     * @param {Array<LatLng|Array>} coords - Geographic coordinates
     * @param {Object} [style] - Style object
     */
    draw_polyline(coords, style = {}) {
        if (coords.length < 2) return;

        const pixels = this._to_pixels(coords);
        const ctx = this._ctx;

        ctx.beginPath();
        ctx.moveTo(pixels[0].x, pixels[0].y);

        for (let i = 1; i < pixels.length; i++) {
            ctx.lineTo(pixels[i].x, pixels[i].y);
        }

        if (this._apply_stroke(style)) {
            ctx.stroke();
        }

        this._reset();
    }

    /**
     * Draw a polygon.
     *
     * @param {Array<LatLng|Array>} coords - Geographic coordinates (ring)
     * @param {Object} [style] - Style object
     */
    draw_polygon(coords, style = {}) {
        if (coords.length < 3) return;

        const pixels = this._to_pixels(coords);
        const ctx = this._ctx;

        ctx.beginPath();
        ctx.moveTo(pixels[0].x, pixels[0].y);

        for (let i = 1; i < pixels.length; i++) {
            ctx.lineTo(pixels[i].x, pixels[i].y);
        }

        ctx.closePath();

        if (this._apply_fill(style)) {
            ctx.fill();
        }

        if (this._apply_stroke(style)) {
            ctx.stroke();
        }

        this._reset();
    }

    /**
     * Draw a polygon with holes.
     *
     * @param {Array<Array>} rings - Array of rings (first is outer, rest are holes)
     * @param {Object} [style] - Style object
     */
    draw_polygon_with_holes(rings, style = {}) {
        if (rings.length === 0 || rings[0].length < 3) return;

        const ctx = this._ctx;
        ctx.beginPath();

        // Outer ring (clockwise)
        const outer = this._to_pixels(rings[0]);
        ctx.moveTo(outer[0].x, outer[0].y);
        for (let i = 1; i < outer.length; i++) {
            ctx.lineTo(outer[i].x, outer[i].y);
        }
        ctx.closePath();

        // Holes (counter-clockwise)
        for (let r = 1; r < rings.length; r++) {
            const hole = this._to_pixels(rings[r]);
            ctx.moveTo(hole[0].x, hole[0].y);
            for (let i = 1; i < hole.length; i++) {
                ctx.lineTo(hole[i].x, hole[i].y);
            }
            ctx.closePath();
        }

        if (this._apply_fill(style)) {
            ctx.fill('evenodd');
        }

        if (this._apply_stroke(style)) {
            ctx.stroke();
        }

        this._reset();
    }

    /**
     * Draw a circle.
     *
     * @param {LatLng|Array} center - Center coordinate
     * @param {number} radius - Radius in meters
     * @param {Object} [style] - Style object
     */
    draw_circle(center, radius, style = {}) {
        const ll = LatLng.from(center);
        const center_px = this._transform.latlng_to_pixel(ll);

        // Calculate pixel radius (approximate)
        const edge = ll.destination(radius, 0);
        const edge_px = this._transform.latlng_to_pixel(edge);
        const radius_px = Math.abs(edge_px.y - center_px.y);

        const ctx = this._ctx;

        ctx.beginPath();
        ctx.arc(center_px.x, center_px.y, radius_px, 0, Math.PI * 2);

        if (this._apply_fill(style)) {
            ctx.fill();
        }

        if (this._apply_stroke(style)) {
            ctx.stroke();
        }

        this._reset();
    }

    /**
     * Draw a circle with pixel radius.
     *
     * @param {LatLng|Array} center - Center coordinate
     * @param {number} radius_px - Radius in pixels
     * @param {Object} [style] - Style object
     */
    draw_circle_px(center, radius_px, style = {}) {
        const ll = LatLng.from(center);
        const center_px = this._transform.latlng_to_pixel(ll);
        const ctx = this._ctx;

        ctx.beginPath();
        ctx.arc(center_px.x, center_px.y, radius_px, 0, Math.PI * 2);

        if (this._apply_fill(style)) {
            ctx.fill();
        }

        if (this._apply_stroke(style)) {
            ctx.stroke();
        }

        this._reset();
    }

    /**
     * Draw a rectangle.
     *
     * @param {LatLng|Array} southwest - Southwest corner
     * @param {LatLng|Array} northeast - Northeast corner
     * @param {Object} [style] - Style object
     */
    draw_rectangle(southwest, northeast, style = {}) {
        const sw = LatLng.from(southwest);
        const ne = LatLng.from(northeast);

        const coords = [
            [sw.lat, sw.lng],
            [ne.lat, sw.lng],
            [ne.lat, ne.lng],
            [sw.lat, ne.lng]
        ];

        this.draw_polygon(coords, style);
    }

    /**
     * Draw text at a geographic location.
     *
     * @param {string} text - Text to draw
     * @param {LatLng|Array} position - Geographic position
     * @param {Object} [options] - Text options
     */
    draw_text(text, position, options = {}) {
        const {
            font = '12px sans-serif',
            color = '#333',
            align = 'center',
            baseline = 'middle',
            offset_x = 0,
            offset_y = 0,
            background = null,
            padding = 4
        } = options;

        const ll = LatLng.from(position);
        const px = this._transform.latlng_to_pixel(ll);
        const ctx = this._ctx;

        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;

        const x = px.x + offset_x;
        const y = px.y + offset_y;

        // Draw background if specified
        if (background) {
            const metrics = ctx.measureText(text);
            const width = metrics.width + padding * 2;
            const height = parseInt(font) + padding * 2;

            ctx.fillStyle = background;
            ctx.fillRect(
                x - (align === 'center' ? width / 2 : align === 'right' ? width : 0),
                y - height / 2,
                width,
                height
            );
        }

        // Draw text
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    /**
     * Draw an image at a geographic location.
     *
     * @param {HTMLImageElement} image - Image to draw
     * @param {LatLng|Array} position - Geographic position
     * @param {Object} [options] - Image options
     */
    draw_image(image, position, options = {}) {
        const {
            width = image.width,
            height = image.height,
            anchor_x = 0.5,
            anchor_y = 0.5,
            rotation = 0,
            opacity = 1
        } = options;

        const ll = LatLng.from(position);
        const px = this._transform.latlng_to_pixel(ll);
        const ctx = this._ctx;

        const x = px.x - width * anchor_x;
        const y = px.y - height * anchor_y;

        ctx.save();
        ctx.globalAlpha = opacity;

        if (rotation) {
            ctx.translate(px.x, px.y);
            ctx.rotate(rotation * Math.PI / 180);
            ctx.drawImage(image, -width * anchor_x, -height * anchor_y, width, height);
        } else {
            ctx.drawImage(image, x, y, width, height);
        }

        ctx.restore();
    }

    // ==================== Hit Testing ====================

    /**
     * Check if a point is inside a polygon.
     *
     * @param {Point} point - Pixel point
     * @param {Array<Point>} polygon - Polygon vertices in pixels
     * @returns {boolean} True if point is inside
     */
    static point_in_polygon(point, polygon) {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Check if a point is near a polyline.
     *
     * @param {Point} point - Pixel point
     * @param {Array<Point>} polyline - Polyline vertices in pixels
     * @param {number} tolerance - Distance tolerance in pixels
     * @returns {boolean} True if point is near the line
     */
    static point_near_polyline(point, polyline, tolerance = 5) {
        for (let i = 0; i < polyline.length - 1; i++) {
            const dist = Renderer.point_to_segment_distance(
                point,
                polyline[i],
                polyline[i + 1]
            );
            if (dist <= tolerance) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calculate distance from point to line segment.
     *
     * @param {Point} point - Point
     * @param {Point} v - Segment start
     * @param {Point} w - Segment end
     * @returns {number} Distance in pixels
     */
    static point_to_segment_distance(point, v, w) {
        const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;

        if (l2 === 0) {
            return Math.sqrt((point.x - v.x) ** 2 + (point.y - v.y) ** 2);
        }

        let t = ((point.x - v.x) * (w.x - v.x) + (point.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));

        const proj_x = v.x + t * (w.x - v.x);
        const proj_y = v.y + t * (w.y - v.y);

        return Math.sqrt((point.x - proj_x) ** 2 + (point.y - proj_y) ** 2);
    }
}
