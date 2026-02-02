/**
 * MeasureTool - Distance and area measurement tool
 *
 * Interactive tool for measuring distances and areas on the map.
 * Supports polyline (distance) and polygon (area) measurements.
 *
 * @example
 * const measure = new MeasureTool({
 *     mode: 'distance',
 *     units: 'metric'
 * });
 * measure.add_to(map);
 * measure.enable();
 *
 * measure.on('measure:complete', (e) => {
 *     console.log('Total distance:', e.distance, 'meters');
 * });
 */

import { EventEmitter } from '../core/event_emitter.js';
import { LatLng } from '../geo/lat_lng.js';
import { Polyline } from '../vector/polyline.js';
import { Polygon } from '../vector/polygon.js';
import { Circle } from '../vector/circle.js';
import { Marker } from '../marker/marker.js';
import { LayerGroup } from '../layer/layer_group.js';
import { deep_merge } from '../core/utils.js';

/**
 * Measurement mode constants.
 */
export const MeasureMode = {
    DISTANCE: 'distance',
    AREA: 'area'
};

/**
 * Unit system constants.
 */
export const MeasureUnits = {
    METRIC: 'metric',
    IMPERIAL: 'imperial'
};

/**
 * Default measure tool options.
 */
const DEFAULT_OPTIONS = {
    mode: MeasureMode.DISTANCE,
    units: MeasureUnits.METRIC,
    show_labels: true,
    show_total: true,
    max_points: null,
    line_style: {
        stroke: '#3498db',
        stroke_width: 3,
        stroke_opacity: 0.8,
        stroke_dasharray: [8, 4]
    },
    polygon_style: {
        stroke: '#3498db',
        stroke_width: 2,
        fill: '#3498db',
        fill_opacity: 0.2
    },
    vertex_style: {
        radius: 6,
        stroke: '#ffffff',
        stroke_width: 2,
        fill: '#3498db'
    },
    label_style: {
        background: 'rgba(255, 255, 255, 0.9)',
        color: '#333',
        font_size: 12
    }
};

/**
 * MeasureTool class for interactive measurement.
 */
export class MeasureTool extends EventEmitter {
    /**
     * Create a new MeasureTool.
     *
     * @param {Object} [options] - Tool options
     */
    constructor(options = {}) {
        super();

        this._options = deep_merge({}, DEFAULT_OPTIONS, options);
        this._map = null;
        this._enabled = false;
        this._points = [];
        this._layer_group = new LayerGroup();
        this._line = null;
        this._polygon = null;
        this._vertices = [];
        this._labels = [];
        this._total_label = null;
        this._cursor_marker = null;
    }

    /**
     * Add tool to map.
     *
     * @param {Osman} map - Map instance
     * @returns {this} Returns this for chaining
     */
    add_to(map) {
        this._map = map;
        this._layer_group.add_to(map);
        return this;
    }

    /**
     * Remove tool from map.
     *
     * @returns {this} Returns this for chaining
     */
    remove() {
        this.disable();
        this._layer_group.remove();
        this._map = null;
        return this;
    }

    /**
     * Enable the tool.
     *
     * @returns {this} Returns this for chaining
     */
    enable() {
        if (!this._map || this._enabled) return this;

        this._enabled = true;
        this._bind_events();

        // Set cursor
        this._map.get_container().style.cursor = 'crosshair';

        this.emit('measure:enable');
        return this;
    }

    /**
     * Disable the tool.
     *
     * @returns {this} Returns this for chaining
     */
    disable() {
        if (!this._enabled) return this;

        this._enabled = false;
        this._unbind_events();

        // Reset cursor
        if (this._map) {
            this._map.get_container().style.cursor = '';
        }

        this.emit('measure:disable');
        return this;
    }

    /**
     * Check if tool is enabled.
     *
     * @returns {boolean} True if enabled
     */
    is_enabled() {
        return this._enabled;
    }

    /**
     * Set measurement mode.
     *
     * @param {string} mode - 'distance' or 'area'
     * @returns {this} Returns this for chaining
     */
    set_mode(mode) {
        this._options.mode = mode;
        this.clear();
        return this;
    }

    /**
     * Get current mode.
     *
     * @returns {string} Current mode
     */
    get_mode() {
        return this._options.mode;
    }

    /**
     * Set unit system.
     *
     * @param {string} units - 'metric' or 'imperial'
     * @returns {this} Returns this for chaining
     */
    set_units(units) {
        this._options.units = units;
        this._update_labels();
        return this;
    }

    /**
     * Get current units.
     *
     * @returns {string} Current units
     */
    get_units() {
        return this._options.units;
    }

    /**
     * Clear current measurement.
     *
     * @returns {this} Returns this for chaining
     */
    clear() {
        this._points = [];
        this._layer_group.clear_layers();
        this._line = null;
        this._polygon = null;
        this._vertices = [];
        this._labels = [];
        this._total_label = null;
        this._cursor_marker = null;

        this.emit('measure:clear');
        return this;
    }

    /**
     * Complete measurement and finalize.
     *
     * @returns {Object} Measurement result
     */
    complete() {
        if (this._points.length < 2) return null;

        const result = this._get_result();

        this.emit('measure:complete', result);
        return result;
    }

    /**
     * Get current measurement result.
     *
     * @returns {Object} Measurement result
     */
    get_result() {
        return this._get_result();
    }

    /**
     * Get points.
     *
     * @returns {Array<LatLng>} Array of measurement points
     */
    get_points() {
        return [...this._points];
    }

    /**
     * Bind map events.
     * @private
     */
    _bind_events() {
        this._on_click = this._on_click.bind(this);
        this._on_mousemove = this._on_mousemove.bind(this);
        this._on_dblclick = this._on_dblclick.bind(this);
        this._on_keydown = this._on_keydown.bind(this);

        this._map.on('map:click', this._on_click);
        this._map.on('map:mousemove', this._on_mousemove);
        this._map.on('map:dblclick', this._on_dblclick);

        document.addEventListener('keydown', this._on_keydown);
    }

    /**
     * Unbind map events.
     * @private
     */
    _unbind_events() {
        if (this._map) {
            this._map.off('map:click', this._on_click);
            this._map.off('map:mousemove', this._on_mousemove);
            this._map.off('map:dblclick', this._on_dblclick);
        }

        document.removeEventListener('keydown', this._on_keydown);
    }

    /**
     * Handle click event.
     * @private
     */
    _on_click(e) {
        e.original_event?.preventDefault();

        // Check max points
        if (this._options.max_points && this._points.length >= this._options.max_points) {
            return;
        }

        this._add_point(e.latlng);
    }

    /**
     * Handle mouse move.
     * @private
     */
    _on_mousemove(e) {
        if (this._points.length === 0) return;

        this._update_preview(e.latlng);
    }

    /**
     * Handle double click.
     * @private
     */
    _on_dblclick(e) {
        e.original_event?.preventDefault();
        this.complete();
    }

    /**
     * Handle keydown.
     * @private
     */
    _on_keydown(e) {
        if (e.key === 'Escape') {
            this.clear();
        } else if (e.key === 'Enter') {
            this.complete();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            this._remove_last_point();
        }
    }

    /**
     * Add a point to measurement.
     * @private
     */
    _add_point(latlng) {
        this._points.push(latlng);

        // Create vertex marker
        const vertex = new Circle(latlng, this._options.vertex_style.radius, {
            ...this._options.vertex_style,
            radius_in_pixels: true
        });
        this._vertices.push(vertex);
        this._layer_group.add_layer(vertex);

        // Update geometry
        this._update_geometry();

        this.emit('measure:point', {
            point: latlng,
            points: [...this._points],
            ...this._get_result()
        });
    }

    /**
     * Remove last point.
     * @private
     */
    _remove_last_point() {
        if (this._points.length === 0) return;

        this._points.pop();

        // Remove vertex
        const vertex = this._vertices.pop();
        if (vertex) {
            this._layer_group.remove_layer(vertex);
        }

        // Update geometry
        this._update_geometry();
    }

    /**
     * Update measurement geometry.
     * @private
     */
    _update_geometry() {
        // Remove old geometry
        if (this._line) {
            this._layer_group.remove_layer(this._line);
            this._line = null;
        }
        if (this._polygon) {
            this._layer_group.remove_layer(this._polygon);
            this._polygon = null;
        }

        if (this._points.length < 2) return;

        if (this._options.mode === MeasureMode.DISTANCE) {
            this._line = new Polyline(this._points, this._options.line_style);
            this._layer_group.add_layer(this._line);
        } else {
            this._polygon = new Polygon([this._points], this._options.polygon_style);
            this._layer_group.add_layer(this._polygon);
        }

        this._update_labels();
    }

    /**
     * Update preview with cursor position.
     * @private
     */
    _update_preview(cursor_latlng) {
        // Update preview line/polygon to cursor position
        const preview_points = [...this._points, cursor_latlng];

        if (this._line) {
            this._layer_group.remove_layer(this._line);
        }
        if (this._polygon) {
            this._layer_group.remove_layer(this._polygon);
        }

        if (preview_points.length >= 2) {
            if (this._options.mode === MeasureMode.DISTANCE) {
                this._line = new Polyline(preview_points, {
                    ...this._options.line_style,
                    stroke_opacity: this._options.line_style.stroke_opacity * 0.6
                });
                this._layer_group.add_layer(this._line);
            } else if (preview_points.length >= 3) {
                this._polygon = new Polygon([preview_points], {
                    ...this._options.polygon_style,
                    fill_opacity: this._options.polygon_style.fill_opacity * 0.6
                });
                this._layer_group.add_layer(this._polygon);
            }
        }
    }

    /**
     * Update measurement labels.
     * @private
     */
    _update_labels() {
        // Clear old labels
        for (const label of this._labels) {
            this._layer_group.remove_layer(label);
        }
        this._labels = [];

        if (!this._options.show_labels || this._points.length < 2) return;

        // Add segment labels
        for (let i = 1; i < this._points.length; i++) {
            const distance = this._points[i - 1].distance_to(this._points[i]);
            const formatted = this._format_distance(distance);

            // Calculate midpoint
            const mid_lat = (this._points[i - 1].lat + this._points[i].lat) / 2;
            const mid_lng = (this._points[i - 1].lng + this._points[i].lng) / 2;

            // Create label marker
            const label = this._create_label(new LatLng(mid_lat, mid_lng), formatted);
            this._labels.push(label);
            this._layer_group.add_layer(label);
        }

        // Add total label
        if (this._options.show_total && this._points.length > 2) {
            const result = this._get_result();
            const total_text = this._options.mode === MeasureMode.DISTANCE
                ? `Total: ${this._format_distance(result.distance)}`
                : `Area: ${this._format_area(result.area)}`;

            // Position at last point
            const total_label = this._create_label(
                this._points[this._points.length - 1],
                total_text,
                true
            );
            this._labels.push(total_label);
            this._layer_group.add_layer(total_label);
        }
    }

    /**
     * Create a label marker.
     * @private
     */
    _create_label(latlng, text, is_total = false) {
        // Create a marker with custom icon for label
        const marker = new Marker(latlng, {
            interactive: false
        });

        // Store label text for rendering
        marker._label_text = text;
        marker._is_total = is_total;

        return marker;
    }

    /**
     * Get measurement result.
     * @private
     */
    _get_result() {
        if (this._points.length < 2) {
            return { distance: 0, area: 0, points: [] };
        }

        let total_distance = 0;
        for (let i = 1; i < this._points.length; i++) {
            total_distance += this._points[i - 1].distance_to(this._points[i]);
        }

        let area = 0;
        if (this._options.mode === MeasureMode.AREA && this._points.length >= 3) {
            area = this._calculate_area(this._points);
        }

        return {
            distance: total_distance,
            distance_formatted: this._format_distance(total_distance),
            area: area,
            area_formatted: this._format_area(area),
            points: [...this._points],
            mode: this._options.mode,
            units: this._options.units
        };
    }

    /**
     * Calculate polygon area using spherical excess formula.
     * @private
     */
    _calculate_area(points) {
        if (points.length < 3) return 0;

        const EARTH_RADIUS = 6371000; // meters
        let total = 0;
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const lat1 = points[i].lat * Math.PI / 180;
            const lat2 = points[j].lat * Math.PI / 180;
            const lng1 = points[i].lng * Math.PI / 180;
            const lng2 = points[j].lng * Math.PI / 180;

            total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
        }

        return Math.abs(total * EARTH_RADIUS * EARTH_RADIUS / 2);
    }

    /**
     * Format distance value.
     * @private
     */
    _format_distance(meters) {
        if (this._options.units === MeasureUnits.IMPERIAL) {
            const feet = meters * 3.28084;
            if (feet < 5280) {
                return `${feet.toFixed(0)} ft`;
            } else {
                return `${(feet / 5280).toFixed(2)} mi`;
            }
        } else {
            if (meters < 1000) {
                return `${meters.toFixed(0)} m`;
            } else {
                return `${(meters / 1000).toFixed(2)} km`;
            }
        }
    }

    /**
     * Format area value.
     * @private
     */
    _format_area(sq_meters) {
        if (this._options.units === MeasureUnits.IMPERIAL) {
            const sq_feet = sq_meters * 10.7639;
            if (sq_feet < 43560) {
                return `${sq_feet.toFixed(0)} sq ft`;
            } else {
                return `${(sq_feet / 43560).toFixed(2)} acres`;
            }
        } else {
            if (sq_meters < 10000) {
                return `${sq_meters.toFixed(0)} m²`;
            } else if (sq_meters < 1000000) {
                return `${(sq_meters / 10000).toFixed(2)} ha`;
            } else {
                return `${(sq_meters / 1000000).toFixed(2)} km²`;
            }
        }
    }
}
