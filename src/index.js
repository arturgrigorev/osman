/**
 * Osman - JavaScript ES module for urban analysis map visualizations
 *
 * @module osman
 * @version 0.1.0
 *
 * @example
 * import { Osman, TileLayer, ZoomControl } from 'osman';
 *
 * const map = new Osman('map', {
 *     center: [40.7128, -74.0060],
 *     zoom: 12
 * });
 *
 * new TileLayer('osm').add_to(map);
 * new ZoomControl().add_to(map);
 */

// Core
export {
    EventEmitter,
    uid,
    clamp,
    lerp,
    is_number,
    is_object,
    is_array,
    is_function,
    is_string,
    deep_clone,
    deep_merge,
    debounce,
    throttle,
    request_frame,
    cancel_frame,
    to_radians,
    to_degrees,
    wrap,
    format_number,
    delay,
    is_browser,
    get_pixel_ratio,
    merge_options,
    StyleBuilder,
    DEFAULT_STYLES,
    validate_options,
    create_options,
    PluginManager,
    PluginType,
    Plugin
} from './core/index.js';

// Geo
export {
    LatLng,
    EARTH_RADIUS,
    Bounds,
    Point,
    Projection,
    SphericalMercator,
    MAX_LATITUDE,
    SEMI_MAJOR_AXIS,
    ORIGIN_SHIFT,
    Transform,
    MIN_ZOOM,
    MAX_ZOOM,
    TILE_SIZE
} from './geo/index.js';

// Map
export {
    Osman,
    Viewport,
    InputHandler
} from './map/index.js';

// Layer
export {
    Layer,
    LayerGroup,
    TileLayer
} from './layer/index.js';

// Vector
export {
    Renderer,
    Path,
    Polyline,
    Polygon,
    Circle,
    CircleMarker,
    Rectangle
} from './vector/index.js';

// Control
export {
    Control,
    ControlPosition,
    ZoomControl,
    ScaleBar,
    Legend
} from './control/index.js';

// Marker
export {
    Marker,
    SymbolMarker,
    IconMarker,
    Icon
} from './marker/index.js';

// Data
export {
    load_geojson,
    parse_coords,
    parse_ring,
    geometry_to_layer,
    feature_to_layer,
    geojson_to_layers,
    geojson_bounds,
    GeoJSON,
    ColorScale,
    CategoricalScale
} from './data/index.js';

// Urban
export {
    GridLayer,
    GridType,
    BuildingLayer,
    RoadLayer,
    ROAD_TYPES,
    ZoneLayer,
    ZONE_COLORS,
    Buffer,
    point_buffer,
    line_buffer,
    polygon_buffer
} from './urban/index.js';

// Tool
export {
    MeasureTool,
    MeasureMode,
    MeasureUnits,
    DrawTool,
    DrawMode
} from './tool/index.js';

// Presentation
export {
    Recorder,
    KeyframeType,
    Easing,
    Player,
    PlayerState,
    Timeline
} from './presentation/index.js';

// Export
export {
    MapExport,
    SelectionExport,
    ExportFormat,
    HtmlExport
} from './export/index.js';

// Version
export const VERSION = '0.1.0';

// Default export
export { Osman as default } from './map/index.js';
