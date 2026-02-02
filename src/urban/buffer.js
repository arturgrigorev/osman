/**
 * Buffer - Buffer zone generation utilities
 *
 * Creates buffer zones around points, lines, and polygons
 * for proximity analysis and spatial queries.
 *
 * @example
 * // Create buffer around a point
 * const circle = Buffer.point([40.7128, -74.0060], 500);
 * circle.add_to(map);
 *
 * // Create buffer around a line
 * const corridor = Buffer.line(route_coords, 100);
 * corridor.add_to(map);
 *
 * // Create buffer around a polygon
 * const expanded = Buffer.polygon(boundary_coords, 200);
 * expanded.add_to(map);
 */

import { LatLng, EARTH_RADIUS } from '../geo/lat_lng.js';
import { Polygon } from '../vector/polygon.js';
import { Circle } from '../vector/circle.js';
import { LayerGroup } from '../layer/layer_group.js';

/**
 * Default buffer options.
 */
const DEFAULT_OPTIONS = {
    stroke: '#3498db',
    stroke_width: 2,
    stroke_opacity: 0.8,
    fill: '#3498db',
    fill_opacity: 0.2,
    segments: 32,       // Number of segments for circular approximation
    join_style: 'round', // 'round', 'miter', 'bevel'
    cap_style: 'round'   // 'round', 'flat', 'square'
};

/**
 * Buffer utility class.
 */
export class Buffer {
    /**
     * Create a circular buffer around a point.
     *
     * @param {LatLng|Array} center - Center point
     * @param {number} radius - Radius in meters
     * @param {Object} [options] - Style options
     * @returns {Circle} Circle layer
     */
    static point(center, radius, options = {}) {
        const latlng = center instanceof LatLng ? center : new LatLng(center[0], center[1]);
        const opts = { ...DEFAULT_OPTIONS, ...options };

        return new Circle(latlng, radius, opts);
    }

    /**
     * Create a buffer around a line (corridor).
     *
     * @param {Array<LatLng|Array>} coords - Line coordinates
     * @param {number} distance - Buffer distance in meters
     * @param {Object} [options] - Style options
     * @returns {Polygon} Buffer polygon
     */
    static line(coords, distance, options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const points = coords.map(c =>
            c instanceof LatLng ? c : new LatLng(c[0], c[1])
        );

        if (points.length < 2) {
            // Single point - return circle
            return Buffer.point(points[0], distance, opts);
        }

        const buffer_points = Buffer._compute_line_buffer(points, distance, opts);

        return new Polygon([buffer_points], opts);
    }

    /**
     * Create a buffer around a polygon.
     *
     * @param {Array<LatLng|Array>} coords - Polygon coordinates
     * @param {number} distance - Buffer distance in meters (positive = expand, negative = shrink)
     * @param {Object} [options] - Style options
     * @returns {Polygon} Buffer polygon
     */
    static polygon(coords, distance, options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const points = coords.map(c =>
            c instanceof LatLng ? c : new LatLng(c[0], c[1])
        );

        const buffer_points = Buffer._compute_polygon_buffer(points, distance, opts);

        return new Polygon([buffer_points], opts);
    }

    /**
     * Create multiple buffers (rings) around a point.
     *
     * @param {LatLng|Array} center - Center point
     * @param {Array<number>} radii - Array of radii in meters
     * @param {Object} [options] - Style options
     * @returns {LayerGroup} Group of circle layers
     */
    static multi_ring(center, radii, options = {}) {
        const latlng = center instanceof LatLng ? center : new LatLng(center[0], center[1]);
        const opts = { ...DEFAULT_OPTIONS, ...options };

        const circles = radii.map((radius, i) => {
            // Adjust opacity for inner rings
            const ring_opts = {
                ...opts,
                fill_opacity: opts.fill_opacity * (1 - i * 0.15)
            };
            return new Circle(latlng, radius, ring_opts);
        });

        // Sort by radius descending so larger circles are behind
        circles.sort((a, b) => b._radius - a._radius);

        return new LayerGroup(circles);
    }

    /**
     * Create isochrone-style buffers (distance bands).
     *
     * @param {LatLng|Array} center - Center point
     * @param {Array<number>} distances - Array of distances in meters
     * @param {Array<string>} [colors] - Array of colors for each band
     * @param {Object} [options] - Style options
     * @returns {LayerGroup} Group of ring layers
     */
    static distance_bands(center, distances, colors = null, options = {}) {
        const latlng = center instanceof LatLng ? center : new LatLng(center[0], center[1]);
        const opts = { ...DEFAULT_OPTIONS, ...options };

        // Default colors (green to red gradient)
        const default_colors = ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6'];

        const sorted_distances = [...distances].sort((a, b) => b - a);
        const layers = [];

        for (let i = 0; i < sorted_distances.length; i++) {
            const color = colors ? colors[i] : default_colors[i % default_colors.length];
            const circle = new Circle(latlng, sorted_distances[i], {
                ...opts,
                stroke: color,
                fill: color
            });
            layers.push(circle);
        }

        return new LayerGroup(layers);
    }

    /**
     * Check if a point is within buffer distance of a target.
     *
     * @param {LatLng|Array} point - Point to check
     * @param {LatLng|Array} target - Target location
     * @param {number} distance - Buffer distance in meters
     * @returns {boolean} True if within buffer
     */
    static is_within(point, target, distance) {
        const p = point instanceof LatLng ? point : new LatLng(point[0], point[1]);
        const t = target instanceof LatLng ? target : new LatLng(target[0], target[1]);

        return p.distance_to(t) <= distance;
    }

    /**
     * Find all points within buffer distance.
     *
     * @param {Array<LatLng|Array>} points - Array of points to check
     * @param {LatLng|Array} center - Center location
     * @param {number} distance - Buffer distance in meters
     * @returns {Array} Points within buffer
     */
    static find_within(points, center, distance) {
        const c = center instanceof LatLng ? center : new LatLng(center[0], center[1]);

        return points.filter(p => {
            const point = p instanceof LatLng ? p : new LatLng(p[0], p[1]);
            return point.distance_to(c) <= distance;
        });
    }

    /**
     * Calculate union of multiple buffers.
     *
     * @param {Array<{center: LatLng|Array, radius: number}>} buffers - Buffer definitions
     * @param {Object} [options] - Style options
     * @returns {Polygon} Union polygon (approximate)
     */
    static union(buffers, options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options, segments: opts.segments || 16 };

        // Collect all buffer outline points
        const all_points = [];

        for (const buffer of buffers) {
            const center = buffer.center instanceof LatLng
                ? buffer.center
                : new LatLng(buffer.center[0], buffer.center[1]);

            const circle_points = Buffer._generate_circle_points(center, buffer.radius, opts.segments);
            all_points.push(...circle_points);
        }

        // Compute convex hull as approximation
        const hull = Buffer._convex_hull(all_points);

        return new Polygon([hull], opts);
    }

    /**
     * Compute line buffer points.
     * @private
     */
    static _compute_line_buffer(points, distance, options) {
        const segments = options.segments || 8;
        const left_side = [];
        const right_side = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            let bearing;

            if (i === 0) {
                // First point - use bearing to next
                bearing = point.bearing_to(points[1]);
            } else if (i === points.length - 1) {
                // Last point - use bearing from previous
                bearing = points[i - 1].bearing_to(point);
            } else {
                // Middle points - average bearing
                const bearing1 = points[i - 1].bearing_to(point);
                const bearing2 = point.bearing_to(points[i + 1]);
                bearing = (bearing1 + bearing2) / 2;
            }

            // Generate offset points perpendicular to bearing
            const left_bearing = bearing - 90;
            const right_bearing = bearing + 90;

            left_side.push(point.destination(distance, left_bearing));
            right_side.push(point.destination(distance, right_bearing));
        }

        // Generate end caps
        const start_cap = Buffer._generate_cap(
            points[0],
            points[0].bearing_to(points[1]) + 180,
            distance,
            segments,
            options.cap_style
        );

        const end_cap = Buffer._generate_cap(
            points[points.length - 1],
            points[points.length - 2].bearing_to(points[points.length - 1]),
            distance,
            segments,
            options.cap_style
        );

        // Combine all points
        return [
            ...left_side,
            ...end_cap,
            ...right_side.reverse(),
            ...start_cap
        ];
    }

    /**
     * Compute polygon buffer points.
     * @private
     */
    static _compute_polygon_buffer(points, distance, options) {
        const segments = options.segments || 8;
        const result = [];
        const n = points.length;

        // Ensure closed polygon
        const closed = points[0].equals(points[n - 1])
            ? points.slice(0, -1)
            : points;

        const m = closed.length;

        for (let i = 0; i < m; i++) {
            const prev = closed[(i - 1 + m) % m];
            const curr = closed[i];
            const next = closed[(i + 1) % m];

            // Calculate bearings
            const bearing1 = prev.bearing_to(curr);
            const bearing2 = curr.bearing_to(next);

            // Calculate offset direction (outward normal)
            const offset_bearing = (bearing1 + bearing2) / 2 + 90;

            // Adjust distance for corner angle
            const angle = Math.abs(bearing2 - bearing1);
            const adjusted_distance = distance / Math.cos((180 - angle) / 2 * Math.PI / 180);

            // Generate corner points
            if (options.join_style === 'round' && distance > 0) {
                const corner_points = Buffer._generate_corner(
                    curr,
                    bearing1 + 90,
                    bearing2 + 90,
                    distance,
                    segments
                );
                result.push(...corner_points);
            } else {
                const offset_point = curr.destination(
                    Math.min(Math.abs(adjusted_distance), Math.abs(distance) * 2),
                    offset_bearing * (distance < 0 ? -1 : 1)
                );
                result.push(offset_point);
            }
        }

        return result;
    }

    /**
     * Generate cap points for line ends.
     * @private
     */
    static _generate_cap(point, bearing, radius, segments, style) {
        if (style === 'flat') {
            return [];
        }

        if (style === 'square') {
            const p1 = point.destination(radius, bearing - 90);
            const p2 = point.destination(radius, bearing + 90);
            const p3 = p2.destination(radius, bearing);
            const p4 = p1.destination(radius, bearing);
            return [p3, p4];
        }

        // Round cap (semicircle)
        const points = [];
        const half_segments = Math.ceil(segments / 2);

        for (let i = 0; i <= half_segments; i++) {
            const angle = bearing - 90 + (180 * i / half_segments);
            points.push(point.destination(radius, angle));
        }

        return points;
    }

    /**
     * Generate corner points for polygon buffer.
     * @private
     */
    static _generate_corner(point, start_bearing, end_bearing, radius, segments) {
        const points = [];
        let angle_diff = end_bearing - start_bearing;

        // Normalize angle difference
        while (angle_diff < 0) angle_diff += 360;
        while (angle_diff > 360) angle_diff -= 360;

        if (angle_diff > 180) {
            angle_diff = angle_diff - 360;
        }

        const num_points = Math.max(2, Math.ceil(Math.abs(angle_diff) / 360 * segments));

        for (let i = 0; i <= num_points; i++) {
            const angle = start_bearing + (angle_diff * i / num_points);
            points.push(point.destination(radius, angle));
        }

        return points;
    }

    /**
     * Generate circle approximation points.
     * @private
     */
    static _generate_circle_points(center, radius, segments) {
        const points = [];

        for (let i = 0; i < segments; i++) {
            const angle = (360 * i / segments);
            points.push(center.destination(radius, angle));
        }

        return points;
    }

    /**
     * Compute convex hull of points (Graham scan).
     * @private
     */
    static _convex_hull(points) {
        if (points.length < 3) return points;

        // Find lowest point
        let lowest = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].lat < points[lowest].lat ||
                (points[i].lat === points[lowest].lat && points[i].lng < points[lowest].lng)) {
                lowest = i;
            }
        }

        // Swap to first position
        [points[0], points[lowest]] = [points[lowest], points[0]];
        const pivot = points[0];

        // Sort by polar angle
        const sorted = points.slice(1).sort((a, b) => {
            const angle_a = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng);
            const angle_b = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng);
            return angle_a - angle_b;
        });

        // Build hull
        const hull = [pivot];

        for (const point of sorted) {
            while (hull.length > 1 && Buffer._cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }

        return hull;
    }

    /**
     * Cross product of vectors (p1->p2) and (p1->p3).
     * @private
     */
    static _cross(p1, p2, p3) {
        return (p2.lng - p1.lng) * (p3.lat - p1.lat) -
               (p2.lat - p1.lat) * (p3.lng - p1.lng);
    }
}

/**
 * Convenience function for point buffer.
 */
export function point_buffer(center, radius, options) {
    return Buffer.point(center, radius, options);
}

/**
 * Convenience function for line buffer.
 */
export function line_buffer(coords, distance, options) {
    return Buffer.line(coords, distance, options);
}

/**
 * Convenience function for polygon buffer.
 */
export function polygon_buffer(coords, distance, options) {
    return Buffer.polygon(coords, distance, options);
}
