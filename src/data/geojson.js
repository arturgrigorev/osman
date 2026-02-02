/**
 * GeoJSON - GeoJSON data loading and parsing
 *
 * Utilities for loading, parsing, and working with GeoJSON data.
 *
 * @example
 * const data = await load_geojson('/data/buildings.geojson');
 * const layer = geojson_to_layers(data, { style: { fill: '#ff0000' } });
 * layer.add_to(map);
 */

import { LatLng } from '../geo/lat_lng.js';
import { Bounds } from '../geo/bounds.js';
import { Polyline } from '../vector/polyline.js';
import { Polygon } from '../vector/polygon.js';
import { Circle, CircleMarker } from '../vector/circle.js';
import { Marker } from '../marker/marker.js';
import { LayerGroup } from '../layer/layer_group.js';

/**
 * Load GeoJSON from a URL.
 *
 * @param {string} url - URL to load from
 * @param {Object} [options] - Fetch options
 * @returns {Promise<Object>} GeoJSON data
 */
export async function load_geojson(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Failed to load GeoJSON: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.type) {
        throw new Error('Invalid GeoJSON: missing type property');
    }

    return data;
}

/**
 * Parse GeoJSON coordinates to LatLng array.
 *
 * @param {Array} coords - GeoJSON coordinates
 * @returns {Array<LatLng>} Array of LatLng
 */
export function parse_coords(coords) {
    if (!Array.isArray(coords)) return [];

    // Single coordinate [lng, lat]
    if (typeof coords[0] === 'number') {
        return [LatLng.from_geojson(coords)];
    }

    // Array of coordinates
    return coords.map(c => {
        if (typeof c[0] === 'number') {
            return LatLng.from_geojson(c);
        }
        return parse_coords(c);
    }).flat();
}

/**
 * Parse GeoJSON ring to LatLng array.
 *
 * @param {Array} ring - GeoJSON ring coordinates
 * @returns {Array<LatLng>} Array of LatLng
 */
export function parse_ring(ring) {
    return ring.map(coord => LatLng.from_geojson(coord));
}

/**
 * Convert GeoJSON geometry to layer(s).
 *
 * @param {Object} geometry - GeoJSON geometry
 * @param {Object} [options] - Layer options
 * @returns {Layer|LayerGroup|null} Layer or null
 */
export function geometry_to_layer(geometry, options = {}) {
    if (!geometry || !geometry.type) return null;

    switch (geometry.type) {
        case 'Point':
            return new Marker(LatLng.from_geojson(geometry.coordinates), options);

        case 'MultiPoint': {
            const markers = geometry.coordinates.map(coord =>
                new Marker(LatLng.from_geojson(coord), options)
            );
            return new LayerGroup(markers);
        }

        case 'LineString':
            return new Polyline(
                geometry.coordinates.map(c => LatLng.from_geojson(c)),
                options
            );

        case 'MultiLineString': {
            const lines = geometry.coordinates.map(coords =>
                new Polyline(coords.map(c => LatLng.from_geojson(c)), options)
            );
            return new LayerGroup(lines);
        }

        case 'Polygon':
            return new Polygon(
                geometry.coordinates.map(ring => ring.map(c => LatLng.from_geojson(c))),
                options
            );

        case 'MultiPolygon': {
            const polygons = geometry.coordinates.map(poly =>
                new Polygon(
                    poly.map(ring => ring.map(c => LatLng.from_geojson(c))),
                    options
                )
            );
            return new LayerGroup(polygons);
        }

        case 'GeometryCollection': {
            const layers = geometry.geometries
                .map(g => geometry_to_layer(g, options))
                .filter(l => l !== null);
            return new LayerGroup(layers);
        }

        default:
            console.warn(`Unsupported geometry type: ${geometry.type}`);
            return null;
    }
}

/**
 * Convert GeoJSON feature to layer.
 *
 * @param {Object} feature - GeoJSON feature
 * @param {Object} [options] - Layer options
 * @param {Function} [options.style] - Style function (feature) => style
 * @param {Function} [options.on_each_feature] - Callback for each feature
 * @param {Function} [options.point_to_layer] - Custom point layer factory
 * @returns {Layer|null} Layer or null
 */
export function feature_to_layer(feature, options = {}) {
    if (!feature || feature.type !== 'Feature') return null;

    const { style, on_each_feature, point_to_layer, ...layer_options } = options;

    // Get style for this feature
    let feature_style = layer_options;
    if (typeof style === 'function') {
        feature_style = { ...layer_options, ...style(feature) };
    } else if (style) {
        feature_style = { ...layer_options, ...style };
    }

    // Create layer
    let layer;

    if (feature.geometry?.type === 'Point' && point_to_layer) {
        // Custom point layer factory
        const latlng = LatLng.from_geojson(feature.geometry.coordinates);
        layer = point_to_layer(feature, latlng);
    } else {
        layer = geometry_to_layer(feature.geometry, feature_style);
    }

    if (!layer) return null;

    // Store feature reference on layer
    layer._feature = feature;
    layer._properties = feature.properties;

    // Call on_each_feature callback
    if (on_each_feature) {
        on_each_feature(feature, layer);
    }

    return layer;
}

/**
 * Convert GeoJSON to layers.
 *
 * @param {Object} geojson - GeoJSON object
 * @param {Object} [options] - Layer options
 * @returns {LayerGroup} Layer group containing all features
 */
export function geojson_to_layers(geojson, options = {}) {
    const layers = [];

    if (geojson.type === 'FeatureCollection') {
        for (const feature of geojson.features) {
            const layer = feature_to_layer(feature, options);
            if (layer) {
                layers.push(layer);
            }
        }
    } else if (geojson.type === 'Feature') {
        const layer = feature_to_layer(geojson, options);
        if (layer) {
            layers.push(layer);
        }
    } else {
        // Geometry only
        const layer = geometry_to_layer(geojson, options);
        if (layer) {
            layers.push(layer);
        }
    }

    return new LayerGroup(layers);
}

/**
 * Get bounds of GeoJSON data.
 *
 * @param {Object} geojson - GeoJSON object
 * @returns {Bounds|null} Bounds or null
 */
export function geojson_bounds(geojson) {
    const coords = [];

    function extract_coords(obj) {
        if (!obj) return;

        if (obj.type === 'FeatureCollection') {
            for (const feature of obj.features) {
                extract_coords(feature);
            }
        } else if (obj.type === 'Feature') {
            extract_coords(obj.geometry);
        } else if (obj.type === 'GeometryCollection') {
            for (const geometry of obj.geometries) {
                extract_coords(geometry);
            }
        } else if (obj.coordinates) {
            const flat = parse_coords(obj.coordinates);
            coords.push(...flat);
        }
    }

    extract_coords(geojson);

    return Bounds.from_points(coords);
}

/**
 * GeoJSON layer class for convenient data binding.
 */
export class GeoJSON extends LayerGroup {
    /**
     * Create a new GeoJSON layer.
     *
     * @param {Object} [data] - GeoJSON data
     * @param {Object} [options] - Layer options
     */
    constructor(data = null, options = {}) {
        super([], options);

        this._geojson_options = options;

        if (data) {
            this.add_data(data);
        }
    }

    /**
     * Add GeoJSON data.
     *
     * @param {Object} data - GeoJSON data
     * @returns {this} Returns this for chaining
     */
    add_data(data) {
        const layers = geojson_to_layers(data, this._geojson_options);

        for (const layer of layers) {
            this.add_layer(layer);
        }

        return this;
    }

    /**
     * Clear all data.
     *
     * @returns {this} Returns this for chaining
     */
    clear_data() {
        return this.clear_layers();
    }

    /**
     * Get all features.
     *
     * @returns {Array<Object>} Array of GeoJSON features
     */
    get_features() {
        const features = [];

        for (const layer of this.get_layers()) {
            if (layer._feature) {
                features.push(layer._feature);
            }
        }

        return features;
    }

    /**
     * Convert to GeoJSON FeatureCollection.
     *
     * @returns {Object} GeoJSON FeatureCollection
     */
    to_geojson() {
        return {
            type: 'FeatureCollection',
            features: this.get_features()
        };
    }

    /**
     * Create GeoJSON layer from URL.
     *
     * @param {string} url - URL to load from
     * @param {Object} [options] - Layer options
     * @returns {Promise<GeoJSON>} GeoJSON layer
     */
    static async from_url(url, options = {}) {
        const data = await load_geojson(url);
        return new GeoJSON(data, options);
    }
}
