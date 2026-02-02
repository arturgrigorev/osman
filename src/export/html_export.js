/**
 * HtmlExport - Generate standalone HTML files with map visualizations
 *
 * Creates self-contained HTML files that display points, lines, and polygons
 * with interactive tooltips based on feature properties.
 *
 * @example
 * const exporter = new HtmlExport();
 *
 * // Add points with tooltips
 * exporter.add_points([
 *     { lat: 40.71, lng: -74.00, name: 'NYC', population: 8336817 },
 *     { lat: 34.05, lng: -118.24, name: 'LA', population: 3979576 }
 * ], {
 *     tooltip_fields: ['name', 'population'],
 *     color: '#e74c3c'
 * });
 *
 * // Add lines
 * exporter.add_lines([
 *     { coords: [[40.71, -74.00], [34.05, -118.24]], route: 'NYC to LA' }
 * ], {
 *     tooltip_fields: ['route'],
 *     stroke: '#3498db'
 * });
 *
 * // Generate and download HTML
 * exporter.download('my_map.html');
 */

/**
 * Default export options.
 */
const DEFAULT_OPTIONS = {
    title: 'Map Export',
    width: '100%',
    height: '100vh',
    center: null,
    zoom: null,
    background_color: '#f0f0f0',
    tile_url: null,
    attribution: ''
};

/**
 * Default point style options.
 */
const DEFAULT_POINT_STYLE = {
    color: '#3388ff',
    radius: 8,
    stroke: '#ffffff',
    stroke_width: 2,
    opacity: 1,
    tooltip_fields: null,
    tooltip_template: null,
    label_field: null
};

/**
 * Default line style options.
 */
const DEFAULT_LINE_STYLE = {
    stroke: '#3388ff',
    stroke_width: 3,
    stroke_opacity: 1,
    stroke_dasharray: null,
    tooltip_fields: null,
    tooltip_template: null
};

/**
 * Default polygon style options.
 */
const DEFAULT_POLYGON_STYLE = {
    fill: '#3388ff',
    fill_opacity: 0.3,
    stroke: '#3388ff',
    stroke_width: 2,
    stroke_opacity: 1,
    tooltip_fields: null,
    tooltip_template: null
};

/**
 * HtmlExport class for generating standalone HTML map files.
 */
export class HtmlExport {
    /**
     * Create a new HtmlExport instance.
     *
     * @param {Object} [options] - Export options
     * @param {string} [options.title='Map Export'] - HTML page title
     * @param {string} [options.width='100%'] - Map container width
     * @param {string} [options.height='100vh'] - Map container height
     * @param {Array} [options.center] - Initial center [lat, lng]
     * @param {number} [options.zoom] - Initial zoom level
     * @param {string} [options.background_color='#f0f0f0'] - Background color
     * @param {string} [options.tile_url] - Optional tile layer URL template
     * @param {string} [options.attribution] - Map attribution text
     */
    constructor(options = {}) {
        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._points = [];
        this._lines = [];
        this._polygons = [];
        this._bounds = null;
    }

    // ==================== Data Methods ====================

    /**
     * Add points to the export.
     *
     * @param {Array<Object>} points - Array of point objects
     * @param {Object} [style] - Point style options
     * @param {string} [style.color='#3388ff'] - Point fill color
     * @param {number} [style.radius=8] - Point radius in pixels
     * @param {string} [style.stroke='#ffffff'] - Point stroke color
     * @param {number} [style.stroke_width=2] - Point stroke width
     * @param {number} [style.opacity=1] - Point opacity
     * @param {Array<string>} [style.tooltip_fields] - Fields to show in tooltip
     * @param {string} [style.tooltip_template] - Custom tooltip template
     * @param {string} [style.label_field] - Field to use for labels
     * @returns {this} Returns this for chaining
     *
     * @example
     * exporter.add_points([
     *     { lat: 40.71, lng: -74.00, name: 'NYC', type: 'city' },
     *     { lat: 34.05, lng: -118.24, name: 'LA', type: 'city' }
     * ], {
     *     tooltip_fields: ['name', 'type'],
     *     color: '#e74c3c',
     *     radius: 10
     * });
     */
    add_points(points, style = {}) {
        const merged_style = { ...DEFAULT_POINT_STYLE, ...style };

        for (const point of points) {
            const lat = point.lat ?? point.latitude ?? point.y;
            const lng = point.lng ?? point.longitude ?? point.lon ?? point.x;

            if (lat == null || lng == null) {
                console.warn('HtmlExport: Point missing lat/lng coordinates', point);
                continue;
            }

            // Extract properties (everything except coordinates)
            const properties = { ...point };
            delete properties.lat;
            delete properties.latitude;
            delete properties.lng;
            delete properties.longitude;
            delete properties.lon;
            delete properties.x;
            delete properties.y;

            this._points.push({
                lat,
                lng,
                properties,
                style: merged_style
            });

            this._update_bounds(lat, lng);
        }

        return this;
    }

    /**
     * Add lines to the export.
     *
     * @param {Array<Object>} lines - Array of line objects
     * @param {Object} [style] - Line style options
     * @param {string} [style.stroke='#3388ff'] - Line stroke color
     * @param {number} [style.stroke_width=3] - Line stroke width
     * @param {number} [style.stroke_opacity=1] - Line opacity
     * @param {string} [style.stroke_dasharray] - Dash pattern (e.g., '5,5')
     * @param {Array<string>} [style.tooltip_fields] - Fields to show in tooltip
     * @param {string} [style.tooltip_template] - Custom tooltip template
     * @returns {this} Returns this for chaining
     *
     * @example
     * exporter.add_lines([
     *     { coords: [[40.71, -74.00], [40.72, -73.99]], name: 'Route A' },
     *     { coords: [[34.05, -118.24], [34.06, -118.23]], name: 'Route B' }
     * ], {
     *     tooltip_fields: ['name'],
     *     stroke: '#e74c3c',
     *     stroke_width: 4
     * });
     */
    add_lines(lines, style = {}) {
        const merged_style = { ...DEFAULT_LINE_STYLE, ...style };

        for (const line of lines) {
            const coords = line.coords ?? line.coordinates ?? line.path ?? line.latlngs;

            if (!coords || !Array.isArray(coords) || coords.length < 2) {
                console.warn('HtmlExport: Line missing valid coordinates', line);
                continue;
            }

            const normalized_coords = this._normalize_coords(coords);

            // Extract properties
            const properties = { ...line };
            delete properties.coords;
            delete properties.coordinates;
            delete properties.path;
            delete properties.latlngs;

            this._lines.push({
                coords: normalized_coords,
                properties,
                style: merged_style
            });

            for (const coord of normalized_coords) {
                this._update_bounds(coord[0], coord[1]);
            }
        }

        return this;
    }

    /**
     * Add polygons to the export.
     *
     * @param {Array<Object>} polygons - Array of polygon objects
     * @param {Object} [style] - Polygon style options
     * @param {string} [style.fill='#3388ff'] - Polygon fill color
     * @param {number} [style.fill_opacity=0.3] - Fill opacity
     * @param {string} [style.stroke='#3388ff'] - Polygon stroke color
     * @param {number} [style.stroke_width=2] - Stroke width
     * @param {number} [style.stroke_opacity=1] - Stroke opacity
     * @param {Array<string>} [style.tooltip_fields] - Fields to show in tooltip
     * @param {string} [style.tooltip_template] - Custom tooltip template
     * @returns {this} Returns this for chaining
     *
     * @example
     * exporter.add_polygons([
     *     {
     *         coords: [[40.71, -74.00], [40.72, -73.99], [40.71, -73.98]],
     *         name: 'Zone A',
     *         area: 1500
     *     }
     * ], {
     *     tooltip_fields: ['name', 'area'],
     *     fill: '#27ae60',
     *     fill_opacity: 0.4
     * });
     */
    add_polygons(polygons, style = {}) {
        const merged_style = { ...DEFAULT_POLYGON_STYLE, ...style };

        for (const polygon of polygons) {
            const coords = polygon.coords ?? polygon.coordinates ?? polygon.ring ?? polygon.latlngs;

            if (!coords || !Array.isArray(coords) || coords.length === 0) {
                console.warn('HtmlExport: Polygon missing valid coordinates', polygon);
                continue;
            }

            // Handle single ring or multi-ring (with holes)
            // Multi-ring: [[[lat,lng], [lat,lng], ...], [[lat,lng], ...]]
            // Single ring: [[lat,lng], [lat,lng], ...]
            let rings;
            const is_multi_ring = Array.isArray(coords[0]) && Array.isArray(coords[0][0]);

            if (is_multi_ring) {
                // Multi-ring format - validate each ring has at least 3 points
                const valid_rings = coords.filter(ring => Array.isArray(ring) && ring.length >= 3);
                if (valid_rings.length === 0) {
                    console.warn('HtmlExport: Polygon has no valid rings', polygon);
                    continue;
                }
                rings = valid_rings.map(ring => this._normalize_coords(ring));
            } else {
                // Single ring format - need at least 3 coordinates
                if (coords.length < 3) {
                    console.warn('HtmlExport: Polygon needs at least 3 coordinates', polygon);
                    continue;
                }
                rings = [this._normalize_coords(coords)];
            }

            // Extract properties
            const properties = { ...polygon };
            delete properties.coords;
            delete properties.coordinates;
            delete properties.ring;
            delete properties.latlngs;

            this._polygons.push({
                rings,
                properties,
                style: merged_style
            });

            for (const ring of rings) {
                for (const coord of ring) {
                    this._update_bounds(coord[0], coord[1]);
                }
            }
        }

        return this;
    }

    /**
     * Add GeoJSON data to the export.
     *
     * @param {Object} geojson - GeoJSON FeatureCollection, Feature, or Geometry
     * @param {Object} [style] - Style options applied to all features
     * @returns {this} Returns this for chaining
     *
     * @example
     * exporter.add_geojson({
     *     type: 'FeatureCollection',
     *     features: [
     *         {
     *             type: 'Feature',
     *             geometry: { type: 'Point', coordinates: [-74.00, 40.71] },
     *             properties: { name: 'NYC' }
     *         }
     *     ]
     * }, { tooltip_fields: ['name'] });
     */
    add_geojson(geojson, style = {}) {
        if (!geojson) return this;

        if (geojson.type === 'FeatureCollection') {
            for (const feature of geojson.features || []) {
                this._add_geojson_feature(feature, style);
            }
        } else if (geojson.type === 'Feature') {
            this._add_geojson_feature(geojson, style);
        } else {
            // Geometry object
            this._add_geojson_feature({ type: 'Feature', geometry: geojson, properties: {} }, style);
        }

        return this;
    }

    /**
     * Add a single GeoJSON feature.
     * @private
     */
    _add_geojson_feature(feature, style) {
        const geometry = feature.geometry;
        const properties = feature.properties || {};

        if (!geometry) return;

        switch (geometry.type) {
            case 'Point':
                this.add_points([{
                    lng: geometry.coordinates[0],
                    lat: geometry.coordinates[1],
                    ...properties
                }], style);
                break;

            case 'MultiPoint':
                for (const coord of geometry.coordinates) {
                    this.add_points([{
                        lng: coord[0],
                        lat: coord[1],
                        ...properties
                    }], style);
                }
                break;

            case 'LineString':
                this.add_lines([{
                    coords: geometry.coordinates.map(c => [c[1], c[0]]),
                    ...properties
                }], style);
                break;

            case 'MultiLineString':
                for (const line of geometry.coordinates) {
                    this.add_lines([{
                        coords: line.map(c => [c[1], c[0]]),
                        ...properties
                    }], style);
                }
                break;

            case 'Polygon':
                this.add_polygons([{
                    coords: geometry.coordinates.map(ring => ring.map(c => [c[1], c[0]])),
                    ...properties
                }], style);
                break;

            case 'MultiPolygon':
                for (const poly of geometry.coordinates) {
                    this.add_polygons([{
                        coords: poly.map(ring => ring.map(c => [c[1], c[0]])),
                        ...properties
                    }], style);
                }
                break;
        }
    }

    /**
     * Clear all data.
     *
     * @returns {this} Returns this for chaining
     */
    clear() {
        this._points = [];
        this._lines = [];
        this._polygons = [];
        this._bounds = null;
        return this;
    }

    // ==================== Export Methods ====================

    /**
     * Generate the HTML string.
     *
     * @returns {string} Complete HTML document
     */
    generate() {
        const data = {
            points: this._points,
            lines: this._lines,
            polygons: this._polygons
        };

        const bounds = this._bounds || { min_lat: 0, max_lat: 0, min_lng: 0, max_lng: 0 };
        const center = this._options.center || [
            (bounds.min_lat + bounds.max_lat) / 2,
            (bounds.min_lng + bounds.max_lng) / 2
        ];
        const zoom = this._options.zoom ?? this._calculate_auto_zoom(bounds);

        return this._generate_html(data, center, zoom, bounds);
    }

    /**
     * Generate HTML and return as a Blob.
     *
     * @returns {Blob} HTML file blob
     */
    to_blob() {
        const html = this.generate();
        return new Blob([html], { type: 'text/html' });
    }

    /**
     * Generate HTML and return as a data URL.
     *
     * @returns {Promise<string>} Resolves with data URL
     */
    async to_data_url() {
        const blob = this.to_blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Download the generated HTML file.
     *
     * @param {string} [filename='map.html'] - Download filename
     * @returns {this} Returns this for chaining
     */
    download(filename = 'map.html') {
        const blob = this.to_blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return this;
    }

    // ==================== Static Factory Methods ====================

    /**
     * Create HtmlExport from points data.
     *
     * @param {Array<Object>} points - Array of point objects
     * @param {Object} [options] - Export and style options
     * @returns {HtmlExport} New HtmlExport instance
     */
    static from_points(points, options = {}) {
        const { title, width, height, center, zoom, background_color, tile_url, attribution, ...style } = options;
        const exporter = new HtmlExport({ title, width, height, center, zoom, background_color, tile_url, attribution });
        return exporter.add_points(points, style);
    }

    /**
     * Create HtmlExport from lines data.
     *
     * @param {Array<Object>} lines - Array of line objects
     * @param {Object} [options] - Export and style options
     * @returns {HtmlExport} New HtmlExport instance
     */
    static from_lines(lines, options = {}) {
        const { title, width, height, center, zoom, background_color, tile_url, attribution, ...style } = options;
        const exporter = new HtmlExport({ title, width, height, center, zoom, background_color, tile_url, attribution });
        return exporter.add_lines(lines, style);
    }

    /**
     * Create HtmlExport from polygons data.
     *
     * @param {Array<Object>} polygons - Array of polygon objects
     * @param {Object} [options] - Export and style options
     * @returns {HtmlExport} New HtmlExport instance
     */
    static from_polygons(polygons, options = {}) {
        const { title, width, height, center, zoom, background_color, tile_url, attribution, ...style } = options;
        const exporter = new HtmlExport({ title, width, height, center, zoom, background_color, tile_url, attribution });
        return exporter.add_polygons(polygons, style);
    }

    /**
     * Create HtmlExport from GeoJSON.
     *
     * @param {Object} geojson - GeoJSON data
     * @param {Object} [options] - Export and style options
     * @returns {HtmlExport} New HtmlExport instance
     */
    static from_geojson(geojson, options = {}) {
        const { title, width, height, center, zoom, background_color, tile_url, attribution, ...style } = options;
        const exporter = new HtmlExport({ title, width, height, center, zoom, background_color, tile_url, attribution });
        return exporter.add_geojson(geojson, style);
    }

    // ==================== Private Methods ====================

    /**
     * Normalize coordinates to [lat, lng] format.
     * @private
     */
    _normalize_coords(coords) {
        return coords.map(coord => {
            if (Array.isArray(coord)) {
                return [coord[0], coord[1]];
            } else if (coord.lat != null && coord.lng != null) {
                return [coord.lat, coord.lng];
            } else if (coord.latitude != null && coord.longitude != null) {
                return [coord.latitude, coord.longitude];
            } else if (coord.y != null && coord.x != null) {
                return [coord.y, coord.x];
            }
            return [0, 0];
        });
    }

    /**
     * Update bounds with new coordinate.
     * @private
     */
    _update_bounds(lat, lng) {
        if (!this._bounds) {
            this._bounds = {
                min_lat: lat,
                max_lat: lat,
                min_lng: lng,
                max_lng: lng
            };
        } else {
            this._bounds.min_lat = Math.min(this._bounds.min_lat, lat);
            this._bounds.max_lat = Math.max(this._bounds.max_lat, lat);
            this._bounds.min_lng = Math.min(this._bounds.min_lng, lng);
            this._bounds.max_lng = Math.max(this._bounds.max_lng, lng);
        }
    }

    /**
     * Calculate automatic zoom level based on bounds.
     * @private
     */
    _calculate_auto_zoom(bounds) {
        const lat_diff = bounds.max_lat - bounds.min_lat;
        const lng_diff = bounds.max_lng - bounds.min_lng;
        const max_diff = Math.max(lat_diff, lng_diff);

        if (max_diff === 0) return 15;
        if (max_diff < 0.01) return 16;
        if (max_diff < 0.05) return 14;
        if (max_diff < 0.1) return 13;
        if (max_diff < 0.5) return 11;
        if (max_diff < 1) return 10;
        if (max_diff < 5) return 8;
        if (max_diff < 10) return 6;
        if (max_diff < 50) return 4;
        return 2;
    }

    /**
     * Generate the complete HTML document.
     * @private
     */
    _generate_html(data, center, zoom, bounds) {
        const options = this._options;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this._escape_html(options.title)}</title>
    <style>
${this._generate_css()}
    </style>
</head>
<body>
    <div id="map-container">
        <canvas id="map-canvas"></canvas>
        <div id="tooltip" class="tooltip"></div>
        <div id="controls">
            <button id="zoom-in" title="Zoom in">+</button>
            <button id="zoom-out" title="Zoom out">−</button>
            <button id="fit-bounds" title="Fit to data">⊡</button>
        </div>
        ${options.attribution ? `<div id="attribution">${this._escape_html(options.attribution)}</div>` : ''}
    </div>
    <script>
${this._generate_js(data, center, zoom, bounds, options)}
    </script>
</body>
</html>`;
    }

    /**
     * Generate CSS styles.
     * @private
     */
    _generate_css() {
        return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        }
        #map-container {
            width: ${this._options.width};
            height: ${this._options.height};
            position: relative;
            background: ${this._options.background_color};
            overflow: hidden;
        }
        #map-canvas {
            width: 100%;
            height: 100%;
            cursor: grab;
        }
        #map-canvas:active {
            cursor: grabbing;
        }
        .tooltip {
            position: absolute;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 13px;
            line-height: 1.4;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            pointer-events: none;
            display: none;
            max-width: 300px;
            z-index: 1000;
        }
        .tooltip.visible {
            display: block;
        }
        .tooltip-row {
            margin: 2px 0;
        }
        .tooltip-field {
            font-weight: 600;
            color: #333;
        }
        .tooltip-value {
            color: #666;
        }
        #controls {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            z-index: 100;
        }
        #controls button {
            width: 32px;
            height: 32px;
            border: 1px solid #ccc;
            background: white;
            border-radius: 4px;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #controls button:hover {
            background: #f0f0f0;
        }
        #attribution {
            position: absolute;
            bottom: 5px;
            right: 5px;
            font-size: 11px;
            color: #666;
            background: rgba(255,255,255,0.7);
            padding: 2px 5px;
            border-radius: 3px;
        }`;
    }

    /**
     * Generate JavaScript code.
     * @private
     */
    _generate_js(data, center, zoom, bounds, options) {
        return `
(function() {
    'use strict';

    // Data
    const mapData = ${JSON.stringify(data)};
    const initialCenter = ${JSON.stringify(center)};
    const initialZoom = ${zoom};
    const dataBounds = ${JSON.stringify(bounds)};
    const tileUrl = ${options.tile_url ? JSON.stringify(options.tile_url) : 'null'};

    // State
    let viewCenter = [...initialCenter];
    let viewZoom = initialZoom;
    let isDragging = false;
    let dragStart = null;
    let dragCenterStart = null;

    // DOM elements
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('tooltip');
    const container = document.getElementById('map-container');

    // Tile cache
    const tileCache = new Map();
    const TILE_SIZE = 256;

    // Initialize
    function init() {
        resize();
        window.addEventListener('resize', resize);
        setupEvents();
        render();
    }

    function resize() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        render();
    }

    // Coordinate transforms
    function latlngToPixel(lat, lng) {
        const scale = Math.pow(2, viewZoom) * TILE_SIZE;
        const x = (lng + 180) / 360 * scale;
        const latRad = lat * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;

        const centerPixel = getCenterPixel();
        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;

        return {
            x: x - centerPixel.x + canvasWidth / 2,
            y: y - centerPixel.y + canvasHeight / 2
        };
    }

    function pixelToLatLng(px, py) {
        const centerPixel = getCenterPixel();
        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;

        const worldX = px + centerPixel.x - canvasWidth / 2;
        const worldY = py + centerPixel.y - canvasHeight / 2;

        const scale = Math.pow(2, viewZoom) * TILE_SIZE;
        const lng = worldX / scale * 360 - 180;
        const n = Math.PI - 2 * Math.PI * worldY / scale;
        const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        return { lat, lng };
    }

    function getCenterPixel() {
        const scale = Math.pow(2, viewZoom) * TILE_SIZE;
        const x = (viewCenter[1] + 180) / 360 * scale;
        const latRad = viewCenter[0] * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;
        return { x, y };
    }

    // Debug info element
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-info';
    debugDiv.style.cssText = 'position:absolute;bottom:30px;left:10px;background:rgba(0,0,0,0.7);color:#0f0;font:12px monospace;padding:8px;border-radius:4px;z-index:1000;';
    container.appendChild(debugDiv);

    function updateDebugInfo() {
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        const nw = pixelToLatLng(0, 0);
        const se = pixelToLatLng(w, h);
        const ne = pixelToLatLng(w, 0);
        const sw = pixelToLatLng(0, h);

        // Helper to normalize lng for display
        const normLng = (lng) => {
            while (lng > 180) lng -= 360;
            while (lng < -180) lng += 360;
            return lng;
        };

        debugDiv.innerHTML =
            '<b>Visible Bounds:</b><br>' +
            'NW: ' + nw.lat.toFixed(4) + ', ' + normLng(nw.lng).toFixed(4) + '<br>' +
            'NE: ' + ne.lat.toFixed(4) + ', ' + normLng(ne.lng).toFixed(4) + '<br>' +
            'SW: ' + sw.lat.toFixed(4) + ', ' + normLng(sw.lng).toFixed(4) + '<br>' +
            'SE: ' + se.lat.toFixed(4) + ', ' + normLng(se.lng).toFixed(4) + '<br>' +
            '<b>Center:</b> ' + viewCenter[0].toFixed(4) + ', ' + viewCenter[1].toFixed(4) + '<br>' +
            '<b>Zoom:</b> ' + viewZoom.toFixed(2);
        // Commented out to reduce console spam
        // console.log('[HtmlExport] Visible bounds:', { nw, ne, sw, se, center: viewCenter, zoom: viewZoom });
    }

    // Rendering
    function render() {
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;

        ctx.clearRect(0, 0, w, h);

        // Update debug info
        updateDebugInfo();

        // Draw tiles if URL provided
        if (tileUrl) {
            drawTiles(w, h);
        }

        // Draw polygons first (bottom layer)
        for (const polygon of mapData.polygons) {
            drawPolygon(polygon);
        }

        // Draw lines
        for (const line of mapData.lines) {
            drawLine(line);
        }

        // Draw points (top layer)
        for (const point of mapData.points) {
            drawPoint(point);
        }
    }

    function drawTiles(w, h) {
        const centerPixel = getCenterPixel();
        const tileZoom = Math.floor(viewZoom);
        const tileScale = Math.pow(2, tileZoom);

        // Fractional zoom scale factor - tiles from integer zoom need to be scaled
        const fractionalScale = Math.pow(2, viewZoom - tileZoom);
        const scaledTileSize = TILE_SIZE * fractionalScale;

        // Convert center from fractional zoom to tile zoom coordinates
        const centerAtTileZoom = {
            x: centerPixel.x / fractionalScale,
            y: centerPixel.y / fractionalScale
        };

        // Calculate visible tile range in tile zoom coordinates
        const halfWidthInTiles = (w / 2) / scaledTileSize;
        const halfHeightInTiles = (h / 2) / scaledTileSize;
        const centerTileX = centerAtTileZoom.x / TILE_SIZE;
        const centerTileY = centerAtTileZoom.y / TILE_SIZE;

        const startX = Math.floor(centerTileX - halfWidthInTiles - 1);
        const startY = Math.floor(centerTileY - halfHeightInTiles - 1);
        const endX = Math.ceil(centerTileX + halfWidthInTiles + 1);
        const endY = Math.ceil(centerTileY + halfHeightInTiles + 1);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                if (x < 0 || y < 0 || x >= tileScale || y >= tileScale) continue;

                // Calculate tile position in screen coordinates
                // Tile world position (top-left corner) in fractional zoom coordinates
                const tileWorldX = x * TILE_SIZE * fractionalScale;
                const tileWorldY = y * TILE_SIZE * fractionalScale;

                // Convert to screen coordinates
                const tileX = tileWorldX - centerPixel.x + w / 2;
                const tileY = tileWorldY - centerPixel.y + h / 2;

                const key = tileZoom + '/' + x + '/' + y;
                let tile = tileCache.get(key);

                if (!tile) {
                    tile = new Image();
                    tile.crossOrigin = 'anonymous';
                    tile.onload = render;
                    tile.src = tileUrl.replace('{z}', tileZoom).replace('{x}', x).replace('{y}', y);
                    tileCache.set(key, tile);
                }

                if (tile.complete && tile.naturalWidth > 0) {
                    ctx.drawImage(tile, tileX, tileY, scaledTileSize, scaledTileSize);
                }
            }
        }
    }

    function drawPoint(point) {
        const pos = latlngToPixel(point.lat, point.lng);
        const style = point.style;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, style.radius, 0, Math.PI * 2);

        ctx.fillStyle = style.color;
        ctx.globalAlpha = style.opacity;
        ctx.fill();

        if (style.stroke_width > 0) {
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = style.stroke_width;
            ctx.stroke();
        }

        ctx.globalAlpha = 1;

        // Draw label if configured
        if (style.label_field && point.properties[style.label_field]) {
            ctx.fillStyle = '#333';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(point.properties[style.label_field], pos.x, pos.y - style.radius - 5);
        }
    }

    function drawLine(line) {
        if (line.coords.length < 2) return;

        const style = line.style;
        ctx.beginPath();

        const start = latlngToPixel(line.coords[0][0], line.coords[0][1]);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < line.coords.length; i++) {
            const pos = latlngToPixel(line.coords[i][0], line.coords[i][1]);
            ctx.lineTo(pos.x, pos.y);
        }

        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.stroke_width;
        ctx.globalAlpha = style.stroke_opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (style.stroke_dasharray) {
            ctx.setLineDash(style.stroke_dasharray.split(',').map(Number));
        } else {
            ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
    }

    function drawPolygon(polygon) {
        if (polygon.rings.length === 0 || polygon.rings[0].length < 3) return;

        const style = polygon.style;
        ctx.beginPath();

        // Draw outer ring
        const outer = polygon.rings[0];
        const start = latlngToPixel(outer[0][0], outer[0][1]);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < outer.length; i++) {
            const pos = latlngToPixel(outer[i][0], outer[i][1]);
            ctx.lineTo(pos.x, pos.y);
        }
        ctx.closePath();

        // Draw holes (inner rings)
        for (let r = 1; r < polygon.rings.length; r++) {
            const ring = polygon.rings[r];
            const holeStart = latlngToPixel(ring[0][0], ring[0][1]);
            ctx.moveTo(holeStart.x, holeStart.y);
            for (let i = 1; i < ring.length; i++) {
                const pos = latlngToPixel(ring[i][0], ring[i][1]);
                ctx.lineTo(pos.x, pos.y);
            }
            ctx.closePath();
        }

        // Fill
        ctx.fillStyle = style.fill;
        ctx.globalAlpha = style.fill_opacity;
        ctx.fill('evenodd');

        // Stroke
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.stroke_width;
        ctx.globalAlpha = style.stroke_opacity;
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    // Event handling
    function setupEvents() {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        // Touch events
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);

        // Controls
        document.getElementById('zoom-in').addEventListener('click', () => setZoom(viewZoom + 1));
        document.getElementById('zoom-out').addEventListener('click', () => setZoom(viewZoom - 1));
        document.getElementById('fit-bounds').addEventListener('click', fitBounds);
    }

    function onMouseDown(e) {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        dragCenterStart = [...viewCenter];
    }

    function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isDragging && dragStart) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            const startLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);
            const endLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio - dx, canvas.height / 2 / window.devicePixelRatio - dy);

            viewCenter = [
                dragCenterStart[0] - (endLatLng.lat - startLatLng.lat),
                dragCenterStart[1] - (endLatLng.lng - startLatLng.lng)
            ];
            render();
        } else {
            updateTooltip(x, y);
        }
    }

    function onMouseUp() {
        isDragging = false;
        dragStart = null;
        dragCenterStart = null;
    }

    function onMouseLeave() {
        isDragging = false;
        hideTooltip();
    }

    // Normalize longitude to -180 to 180 range
    function normalizeLng(lng) {
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;
        return lng;
    }

    function onWheel(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Get lat/lng under mouse BEFORE zoom change
        const targetLatLng = pixelToLatLng(mouseX, mouseY);

        // Normalize to handle world wrapping - pick the copy closest to current center
        let targetLng = targetLatLng.lng;
        while (targetLng - viewCenter[1] > 180) targetLng -= 360;
        while (targetLng - viewCenter[1] < -180) targetLng += 360;
        targetLatLng.lng = targetLng;

        // Calculate new zoom
        const delta = e.deltaY > 0 ? -0.5 : 0.5;
        const newZoom = Math.max(1, Math.min(20, viewZoom + delta));
        if (newZoom === viewZoom) return;

        // Change zoom
        viewZoom = newZoom;

        // Now find the new center such that targetLatLng appears at (mouseX, mouseY)
        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;
        const scale = Math.pow(2, viewZoom) * TILE_SIZE;

        // Target point in world coordinates at new zoom
        const targetWorldX = (targetLatLng.lng + 180) / 360 * scale;
        const targetLatRad = targetLatLng.lat * Math.PI / 180;
        const targetWorldY = (1 - Math.log(Math.tan(targetLatRad) + 1 / Math.cos(targetLatRad)) / Math.PI) / 2 * scale;

        // New center in world coordinates (so that target appears at mouse position)
        const newCenterWorldX = targetWorldX - mouseX + canvasWidth / 2;
        const newCenterWorldY = targetWorldY - mouseY + canvasHeight / 2;

        // Convert back to lat/lng
        let newCenterLng = newCenterWorldX / scale * 360 - 180;
        const n = Math.PI - 2 * Math.PI * newCenterWorldY / scale;
        let newCenterLat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        // Clamp latitude and normalize longitude
        newCenterLat = Math.max(-85, Math.min(85, newCenterLat));
        newCenterLng = normalizeLng(newCenterLng);

        viewCenter = [newCenterLat, newCenterLng];

        render();
    }

    let touchStartDist = null;
    let touchStartZoom = null;

    function onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            isDragging = true;
            dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            dragCenterStart = [...viewCenter];
        } else if (e.touches.length === 2) {
            isDragging = false;
            touchStartDist = getTouchDistance(e.touches);
            touchStartZoom = viewZoom;
        }
    }

    function onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging && dragStart) {
            const dx = e.touches[0].clientX - dragStart.x;
            const dy = e.touches[0].clientY - dragStart.y;

            const startLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);
            const endLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio - dx, canvas.height / 2 / window.devicePixelRatio - dy);

            viewCenter = [
                dragCenterStart[0] - (endLatLng.lat - startLatLng.lat),
                dragCenterStart[1] - (endLatLng.lng - startLatLng.lng)
            ];
            render();
        } else if (e.touches.length === 2 && touchStartDist) {
            const dist = getTouchDistance(e.touches);
            const scale = dist / touchStartDist;
            setZoom(touchStartZoom + Math.log2(scale));
        }
    }

    function onTouchEnd() {
        isDragging = false;
        dragStart = null;
        touchStartDist = null;
    }

    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function setZoom(z) {
        viewZoom = Math.max(1, Math.min(20, z));
        render();
    }

    function fitBounds() {
        if (!dataBounds) return;

        viewCenter = [
            (dataBounds.min_lat + dataBounds.max_lat) / 2,
            (dataBounds.min_lng + dataBounds.max_lng) / 2
        ];
        viewZoom = initialZoom;
        render();
    }

    // Tooltip
    function updateTooltip(x, y) {
        let found = null;
        let foundType = null;

        // Check points (in reverse order for top-most)
        for (let i = mapData.points.length - 1; i >= 0; i--) {
            const point = mapData.points[i];
            const pos = latlngToPixel(point.lat, point.lng);
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            if (dist <= point.style.radius + 3) {
                found = point;
                foundType = 'point';
                break;
            }
        }

        // Check lines if no point found
        if (!found) {
            for (let i = mapData.lines.length - 1; i >= 0; i--) {
                const line = mapData.lines[i];
                if (isPointNearLine(x, y, line)) {
                    found = line;
                    foundType = 'line';
                    break;
                }
            }
        }

        // Check polygons if nothing found
        if (!found) {
            for (let i = mapData.polygons.length - 1; i >= 0; i--) {
                const polygon = mapData.polygons[i];
                if (isPointInPolygon(x, y, polygon)) {
                    found = polygon;
                    foundType = 'polygon';
                    break;
                }
            }
        }

        if (found) {
            showTooltip(x, y, found, foundType);
        } else {
            hideTooltip();
        }
    }

    function isPointNearLine(px, py, line) {
        const tolerance = line.style.stroke_width / 2 + 5;

        for (let i = 0; i < line.coords.length - 1; i++) {
            const p1 = latlngToPixel(line.coords[i][0], line.coords[i][1]);
            const p2 = latlngToPixel(line.coords[i + 1][0], line.coords[i + 1][1]);

            const dist = pointToSegmentDistance(px, py, p1.x, p1.y, p2.x, p2.y);
            if (dist <= tolerance) return true;
        }
        return false;
    }

    function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;

        if (len2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));

        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));

        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;

        return Math.sqrt(Math.pow(px - nearX, 2) + Math.pow(py - nearY, 2));
    }

    function isPointInPolygon(px, py, polygon) {
        if (polygon.rings.length === 0) return false;

        const pixelRings = polygon.rings.map(ring =>
            ring.map(coord => latlngToPixel(coord[0], coord[1]))
        );

        // Check outer ring
        if (!pointInRing(px, py, pixelRings[0])) return false;

        // Check holes
        for (let i = 1; i < pixelRings.length; i++) {
            if (pointInRing(px, py, pixelRings[i])) return false;
        }

        return true;
    }

    function pointInRing(px, py, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i].x, yi = ring[i].y;
            const xj = ring[j].x, yj = ring[j].y;

            if (((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    function showTooltip(x, y, feature, type) {
        const style = feature.style;
        const fields = style.tooltip_fields;
        const template = style.tooltip_template;
        const properties = feature.properties;

        if (!fields && !template) {
            hideTooltip();
            return;
        }

        let html = '';

        if (template) {
            html = template.replace(/\\{(\\w+)\\}/g, (_, key) => {
                return properties[key] != null ? escapeHtml(String(properties[key])) : '';
            });
        } else if (fields) {
            for (const field of fields) {
                if (properties[field] != null) {
                    html += '<div class="tooltip-row">';
                    html += '<span class="tooltip-field">' + escapeHtml(field) + ':</span> ';
                    html += '<span class="tooltip-value">' + escapeHtml(String(properties[field])) + '</span>';
                    html += '</div>';
                }
            }
        }

        if (!html) {
            hideTooltip();
            return;
        }

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');

        // Position tooltip
        const rect = container.getBoundingClientRect();
        let left = x + 15;
        let top = y + 15;

        // Keep tooltip in view
        if (left + tooltip.offsetWidth > rect.width - 10) {
            left = x - tooltip.offsetWidth - 10;
        }
        if (top + tooltip.offsetHeight > rect.height - 10) {
            top = y - tooltip.offsetHeight - 10;
        }

        tooltip.style.left = Math.max(5, left) + 'px';
        tooltip.style.top = Math.max(5, top) + 'px';
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose functions and state for testing
    window.pixelToLatLng = pixelToLatLng;
    window.latlngToPixel = latlngToPixel;
    window.render = render;
    window.mapData = mapData;
    window.canvas = canvas;
    window.getViewCenter = () => [...viewCenter];
    window.setViewCenter = (lat, lng) => { viewCenter[0] = lat; viewCenter[1] = lng; };
    window.getViewZoom = () => viewZoom;
    window.setViewZoom = (z) => { viewZoom = z; };

    // Also expose as properties for convenience
    Object.defineProperty(window, 'viewCenter', {
        get: () => viewCenter,
        set: (v) => { viewCenter[0] = v[0]; viewCenter[1] = v[1]; },
        configurable: true
    });
    Object.defineProperty(window, 'viewZoom', {
        get: () => viewZoom,
        set: (v) => { viewZoom = v; },
        configurable: true
    });

    // Start
    init();
})();`;
    }

    /**
     * Escape HTML special characters.
     * @private
     */
    _escape_html(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
