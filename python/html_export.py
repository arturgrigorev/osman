"""
HtmlExport - Generate standalone HTML files with map visualizations

Creates self-contained HTML files that display points, lines, and polygons
with interactive tooltips based on feature properties.

Example:
    exporter = HtmlExport()

    # Add points with tooltips
    exporter.add_points([
        {'lat': 40.71, 'lng': -74.00, 'name': 'NYC', 'population': 8336817},
        {'lat': 34.05, 'lng': -118.24, 'name': 'LA', 'population': 3979576}
    ], tooltip_fields=['name', 'population'], color='#e74c3c')

    # Add lines
    exporter.add_lines([
        {'coords': [[40.71, -74.00], [34.05, -118.24]], 'route': 'NYC to LA'}
    ], tooltip_fields=['route'], stroke='#3498db')

    # Save HTML file
    exporter.save('my_map.html')
"""

import json
import html
from typing import List, Dict, Optional, Any, Union
from pathlib import Path


# Default options
DEFAULT_OPTIONS = {
    'title': 'Map Export',
    'width': '100%',
    'height': '100vh',
    'center': None,
    'zoom': None,
    'background_color': '#f0f0f0',
    'tile_url': None,
    'attribution': ''
}

# Default point style
DEFAULT_POINT_STYLE = {
    'color': '#3388ff',
    'radius': 8,
    'stroke': '#ffffff',
    'stroke_width': 2,
    'opacity': 1,
    'tooltip_fields': None,
    'tooltip_template': None,
    'label_field': None
}

# Default line style
DEFAULT_LINE_STYLE = {
    'stroke': '#3388ff',
    'stroke_width': 3,
    'stroke_opacity': 1,
    'stroke_dasharray': None,
    'tooltip_fields': None,
    'tooltip_template': None
}

# Default polygon style
DEFAULT_POLYGON_STYLE = {
    'fill': '#3388ff',
    'fill_opacity': 0.3,
    'stroke': '#3388ff',
    'stroke_width': 2,
    'stroke_opacity': 1,
    'tooltip_fields': None,
    'tooltip_template': None
}


class HtmlExport:
    """Generate standalone HTML files with interactive map visualizations."""

    def __init__(
        self,
        title: str = 'Map Export',
        width: str = '100%',
        height: str = '100vh',
        center: Optional[List[float]] = None,
        zoom: Optional[float] = None,
        background_color: str = '#f0f0f0',
        tile_url: Optional[str] = None,
        attribution: str = ''
    ):
        """
        Create a new HtmlExport instance.

        Args:
            title: HTML page title
            width: Map container width (CSS value)
            height: Map container height (CSS value)
            center: Initial center [lat, lng]
            zoom: Initial zoom level (1-20)
            background_color: Canvas background color
            tile_url: Optional tile layer URL template with {z}, {x}, {y}
            attribution: Map attribution text
        """
        self._options = {
            'title': title,
            'width': width,
            'height': height,
            'center': center,
            'zoom': zoom,
            'background_color': background_color,
            'tile_url': tile_url,
            'attribution': attribution
        }
        self._points: List[Dict] = []
        self._lines: List[Dict] = []
        self._polygons: List[Dict] = []
        self._bounds: Optional[Dict[str, float]] = None

    # ==================== Data Methods ====================

    def add_points(
        self,
        points: List[Dict[str, Any]],
        color: str = '#3388ff',
        radius: int = 8,
        stroke: str = '#ffffff',
        stroke_width: int = 2,
        opacity: float = 1,
        tooltip_fields: Optional[List[str]] = None,
        tooltip_template: Optional[str] = None,
        label_field: Optional[str] = None
    ) -> 'HtmlExport':
        """
        Add points to the export.

        Args:
            points: Array of point objects with lat/lng and properties
            color: Point fill color
            radius: Point radius in pixels
            stroke: Point stroke color
            stroke_width: Point stroke width
            opacity: Point opacity (0-1)
            tooltip_fields: List of property names to show in tooltip
            tooltip_template: Custom tooltip HTML template
            label_field: Property name to use for labels

        Returns:
            self for chaining

        Example:
            exporter.add_points([
                {'lat': 40.71, 'lng': -74.00, 'name': 'NYC', 'type': 'city'},
                {'lat': 34.05, 'lng': -118.24, 'name': 'LA', 'type': 'city'}
            ], tooltip_fields=['name', 'type'], color='#e74c3c', radius=10)
        """
        style = {
            'color': color,
            'radius': radius,
            'stroke': stroke,
            'stroke_width': stroke_width,
            'opacity': opacity,
            'tooltip_fields': tooltip_fields,
            'tooltip_template': tooltip_template,
            'label_field': label_field
        }

        for point in points:
            # Check each key explicitly to handle 0 values correctly
            lat = None
            for key in ('lat', 'latitude', 'y'):
                if key in point and point[key] is not None:
                    lat = point[key]
                    break

            lng = None
            for key in ('lng', 'longitude', 'lon', 'x'):
                if key in point and point[key] is not None:
                    lng = point[key]
                    break

            if lat is None or lng is None:
                print(f'HtmlExport: Point missing lat/lng coordinates: {point}')
                continue

            # Extract properties (everything except coordinates)
            properties = {k: v for k, v in point.items()
                         if k not in ('lat', 'latitude', 'lng', 'longitude', 'lon', 'x', 'y')}

            self._points.append({
                'lat': float(lat),
                'lng': float(lng),
                'properties': properties,
                'style': style
            })

            self._update_bounds(float(lat), float(lng))

        return self

    def add_lines(
        self,
        lines: List[Dict[str, Any]],
        stroke: str = '#3388ff',
        stroke_width: int = 3,
        stroke_opacity: float = 1,
        stroke_dasharray: Optional[str] = None,
        tooltip_fields: Optional[List[str]] = None,
        tooltip_template: Optional[str] = None
    ) -> 'HtmlExport':
        """
        Add lines to the export.

        Args:
            lines: Array of line objects with coords and properties
            stroke: Line stroke color
            stroke_width: Line stroke width
            stroke_opacity: Line opacity (0-1)
            stroke_dasharray: Dash pattern (e.g., '5,5')
            tooltip_fields: List of property names to show in tooltip
            tooltip_template: Custom tooltip HTML template

        Returns:
            self for chaining

        Example:
            exporter.add_lines([
                {'coords': [[40.71, -74.00], [40.72, -73.99]], 'name': 'Route A'},
                {'coords': [[34.05, -118.24], [34.06, -118.23]], 'name': 'Route B'}
            ], tooltip_fields=['name'], stroke='#e74c3c', stroke_width=4)
        """
        style = {
            'stroke': stroke,
            'stroke_width': stroke_width,
            'stroke_opacity': stroke_opacity,
            'stroke_dasharray': stroke_dasharray,
            'tooltip_fields': tooltip_fields,
            'tooltip_template': tooltip_template
        }

        for line in lines:
            coords = line.get('coords') or line.get('coordinates') or line.get('path') or line.get('latlngs')

            if not coords or not isinstance(coords, list) or len(coords) < 2:
                print(f'HtmlExport: Line missing valid coordinates: {line}')
                continue

            normalized_coords = self._normalize_coords(coords)

            # Extract properties
            properties = {k: v for k, v in line.items()
                         if k not in ('coords', 'coordinates', 'path', 'latlngs')}

            self._lines.append({
                'coords': normalized_coords,
                'properties': properties,
                'style': style
            })

            for coord in normalized_coords:
                self._update_bounds(coord[0], coord[1])

        return self

    def add_polygons(
        self,
        polygons: List[Dict[str, Any]],
        fill: str = '#3388ff',
        fill_opacity: float = 0.3,
        stroke: str = '#3388ff',
        stroke_width: int = 2,
        stroke_opacity: float = 1,
        tooltip_fields: Optional[List[str]] = None,
        tooltip_template: Optional[str] = None
    ) -> 'HtmlExport':
        """
        Add polygons to the export.

        Args:
            polygons: Array of polygon objects with coords and properties
            fill: Polygon fill color
            fill_opacity: Fill opacity (0-1)
            stroke: Polygon stroke color
            stroke_width: Stroke width
            stroke_opacity: Stroke opacity (0-1)
            tooltip_fields: List of property names to show in tooltip
            tooltip_template: Custom tooltip HTML template

        Returns:
            self for chaining

        Example:
            exporter.add_polygons([
                {
                    'coords': [[40.71, -74.00], [40.72, -73.99], [40.71, -73.98]],
                    'name': 'Zone A',
                    'area': 1500
                }
            ], tooltip_fields=['name', 'area'], fill='#27ae60', fill_opacity=0.4)
        """
        style = {
            'fill': fill,
            'fill_opacity': fill_opacity,
            'stroke': stroke,
            'stroke_width': stroke_width,
            'stroke_opacity': stroke_opacity,
            'tooltip_fields': tooltip_fields,
            'tooltip_template': tooltip_template
        }

        for polygon in polygons:
            coords = polygon.get('coords') or polygon.get('coordinates') or polygon.get('ring') or polygon.get('latlngs')

            if not coords or not isinstance(coords, list) or len(coords) == 0:
                print(f'HtmlExport: Polygon missing valid coordinates: {polygon}')
                continue

            # Handle single ring or multi-ring (with holes)
            is_multi_ring = (isinstance(coords[0], list) and
                           len(coords[0]) > 0 and
                           isinstance(coords[0][0], list))

            if is_multi_ring:
                # Multi-ring format
                valid_rings = [ring for ring in coords if isinstance(ring, list) and len(ring) >= 3]
                if not valid_rings:
                    print(f'HtmlExport: Polygon has no valid rings: {polygon}')
                    continue
                rings = [self._normalize_coords(ring) for ring in valid_rings]
            else:
                # Single ring format
                if len(coords) < 3:
                    print(f'HtmlExport: Polygon needs at least 3 coordinates: {polygon}')
                    continue
                rings = [self._normalize_coords(coords)]

            # Extract properties
            properties = {k: v for k, v in polygon.items()
                         if k not in ('coords', 'coordinates', 'ring', 'latlngs')}

            self._polygons.append({
                'rings': rings,
                'properties': properties,
                'style': style
            })

            for ring in rings:
                for coord in ring:
                    self._update_bounds(coord[0], coord[1])

        return self

    def add_geojson(
        self,
        geojson: Dict[str, Any],
        **style_kwargs
    ) -> 'HtmlExport':
        """
        Add GeoJSON data to the export.

        Args:
            geojson: GeoJSON FeatureCollection, Feature, or Geometry
            **style_kwargs: Style options applied to all features

        Returns:
            self for chaining

        Example:
            exporter.add_geojson({
                'type': 'FeatureCollection',
                'features': [
                    {
                        'type': 'Feature',
                        'geometry': {'type': 'Point', 'coordinates': [-74.00, 40.71]},
                        'properties': {'name': 'NYC'}
                    }
                ]
            }, tooltip_fields=['name'])
        """
        if not geojson:
            return self

        geojson_type = geojson.get('type')

        if geojson_type == 'FeatureCollection':
            for feature in geojson.get('features', []):
                self._add_geojson_feature(feature, style_kwargs)
        elif geojson_type == 'Feature':
            self._add_geojson_feature(geojson, style_kwargs)
        else:
            # Geometry object
            self._add_geojson_feature({
                'type': 'Feature',
                'geometry': geojson,
                'properties': {}
            }, style_kwargs)

        return self

    def _add_geojson_feature(self, feature: Dict, style: Dict):
        """Add a single GeoJSON feature."""
        geometry = feature.get('geometry')
        properties = feature.get('properties', {})

        if not geometry:
            return

        geom_type = geometry.get('type')
        coords = geometry.get('coordinates')

        if geom_type == 'Point':
            self.add_points([{
                'lng': coords[0],
                'lat': coords[1],
                **properties
            }], **style)

        elif geom_type == 'MultiPoint':
            for coord in coords:
                self.add_points([{
                    'lng': coord[0],
                    'lat': coord[1],
                    **properties
                }], **style)

        elif geom_type == 'LineString':
            self.add_lines([{
                'coords': [[c[1], c[0]] for c in coords],
                **properties
            }], **style)

        elif geom_type == 'MultiLineString':
            for line in coords:
                self.add_lines([{
                    'coords': [[c[1], c[0]] for c in line],
                    **properties
                }], **style)

        elif geom_type == 'Polygon':
            self.add_polygons([{
                'coords': [[[c[1], c[0]] for c in ring] for ring in coords],
                **properties
            }], **style)

        elif geom_type == 'MultiPolygon':
            for poly in coords:
                self.add_polygons([{
                    'coords': [[[c[1], c[0]] for c in ring] for ring in poly],
                    **properties
                }], **style)

    def clear(self) -> 'HtmlExport':
        """
        Clear all data.

        Returns:
            self for chaining
        """
        self._points = []
        self._lines = []
        self._polygons = []
        self._bounds = None
        return self

    # ==================== Export Methods ====================

    def generate(self) -> str:
        """
        Generate the HTML string.

        Returns:
            Complete HTML document as string
        """
        data = {
            'points': self._points,
            'lines': self._lines,
            'polygons': self._polygons
        }

        bounds = self._bounds or {'min_lat': 0, 'max_lat': 0, 'min_lng': 0, 'max_lng': 0}
        center = self._options['center'] or [
            (bounds['min_lat'] + bounds['max_lat']) / 2,
            (bounds['min_lng'] + bounds['max_lng']) / 2
        ]
        zoom = self._options['zoom'] if self._options['zoom'] is not None else self._calculate_auto_zoom(bounds)

        return self._generate_html(data, center, zoom, bounds)

    def save(self, filename: Union[str, Path]) -> 'HtmlExport':
        """
        Save the generated HTML to a file.

        Args:
            filename: Output file path

        Returns:
            self for chaining
        """
        html_content = self.generate()
        Path(filename).write_text(html_content, encoding='utf-8')
        return self

    def to_bytes(self) -> bytes:
        """
        Generate HTML and return as bytes.

        Returns:
            HTML content as UTF-8 bytes
        """
        return self.generate().encode('utf-8')

    # ==================== Static Factory Methods ====================

    @staticmethod
    def from_points(points: List[Dict], **options) -> 'HtmlExport':
        """
        Create HtmlExport from points data.

        Args:
            points: Array of point objects
            **options: Export and style options

        Returns:
            New HtmlExport instance
        """
        # Separate export options from style options
        export_keys = {'title', 'width', 'height', 'center', 'zoom', 'background_color', 'tile_url', 'attribution'}
        export_opts = {k: v for k, v in options.items() if k in export_keys}
        style_opts = {k: v for k, v in options.items() if k not in export_keys}

        exporter = HtmlExport(**export_opts)
        return exporter.add_points(points, **style_opts)

    @staticmethod
    def from_lines(lines: List[Dict], **options) -> 'HtmlExport':
        """
        Create HtmlExport from lines data.

        Args:
            lines: Array of line objects
            **options: Export and style options

        Returns:
            New HtmlExport instance
        """
        export_keys = {'title', 'width', 'height', 'center', 'zoom', 'background_color', 'tile_url', 'attribution'}
        export_opts = {k: v for k, v in options.items() if k in export_keys}
        style_opts = {k: v for k, v in options.items() if k not in export_keys}

        exporter = HtmlExport(**export_opts)
        return exporter.add_lines(lines, **style_opts)

    @staticmethod
    def from_polygons(polygons: List[Dict], **options) -> 'HtmlExport':
        """
        Create HtmlExport from polygons data.

        Args:
            polygons: Array of polygon objects
            **options: Export and style options

        Returns:
            New HtmlExport instance
        """
        export_keys = {'title', 'width', 'height', 'center', 'zoom', 'background_color', 'tile_url', 'attribution'}
        export_opts = {k: v for k, v in options.items() if k in export_keys}
        style_opts = {k: v for k, v in options.items() if k not in export_keys}

        exporter = HtmlExport(**export_opts)
        return exporter.add_polygons(polygons, **style_opts)

    @staticmethod
    def from_geojson(geojson: Dict, **options) -> 'HtmlExport':
        """
        Create HtmlExport from GeoJSON.

        Args:
            geojson: GeoJSON data
            **options: Export and style options

        Returns:
            New HtmlExport instance
        """
        export_keys = {'title', 'width', 'height', 'center', 'zoom', 'background_color', 'tile_url', 'attribution'}
        export_opts = {k: v for k, v in options.items() if k in export_keys}
        style_opts = {k: v for k, v in options.items() if k not in export_keys}

        exporter = HtmlExport(**export_opts)
        return exporter.add_geojson(geojson, **style_opts)

    # ==================== Private Methods ====================

    def _normalize_coords(self, coords: List) -> List[List[float]]:
        """Normalize coordinates to [lat, lng] format."""
        result = []
        for coord in coords:
            if isinstance(coord, (list, tuple)):
                result.append([float(coord[0]), float(coord[1])])
            elif isinstance(coord, dict):
                lat = coord.get('lat') or coord.get('latitude') or coord.get('y')
                lng = coord.get('lng') or coord.get('longitude') or coord.get('x')
                if lat is not None and lng is not None:
                    result.append([float(lat), float(lng)])
                else:
                    result.append([0.0, 0.0])
            else:
                result.append([0.0, 0.0])
        return result

    def _update_bounds(self, lat: float, lng: float):
        """Update bounds with new coordinate."""
        if self._bounds is None:
            self._bounds = {
                'min_lat': lat,
                'max_lat': lat,
                'min_lng': lng,
                'max_lng': lng
            }
        else:
            self._bounds['min_lat'] = min(self._bounds['min_lat'], lat)
            self._bounds['max_lat'] = max(self._bounds['max_lat'], lat)
            self._bounds['min_lng'] = min(self._bounds['min_lng'], lng)
            self._bounds['max_lng'] = max(self._bounds['max_lng'], lng)

    def _calculate_auto_zoom(self, bounds: Dict) -> int:
        """Calculate automatic zoom level based on bounds."""
        lat_diff = bounds['max_lat'] - bounds['min_lat']
        lng_diff = bounds['max_lng'] - bounds['min_lng']
        max_diff = max(lat_diff, lng_diff)

        if max_diff == 0:
            return 15
        if max_diff < 0.01:
            return 16
        if max_diff < 0.05:
            return 14
        if max_diff < 0.1:
            return 13
        if max_diff < 0.5:
            return 11
        if max_diff < 1:
            return 10
        if max_diff < 5:
            return 8
        if max_diff < 10:
            return 6
        if max_diff < 50:
            return 4
        return 2

    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters."""
        return html.escape(str(text))

    def _generate_html(self, data: Dict, center: List[float], zoom: float, bounds: Dict) -> str:
        """Generate the complete HTML document."""
        options = self._options

        return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self._escape_html(options['title'])}</title>
    <style>
{self._generate_css()}
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
        {f'<div id="attribution">{self._escape_html(options["attribution"])}</div>' if options['attribution'] else ''}
    </div>
    <script>
{self._generate_js(data, center, zoom, bounds, options)}
    </script>
</body>
</html>'''

    def _generate_css(self) -> str:
        """Generate CSS styles."""
        return f'''
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        }}
        #map-container {{
            width: {self._options['width']};
            height: {self._options['height']};
            position: relative;
            background: {self._options['background_color']};
            overflow: hidden;
        }}
        #map-canvas {{
            width: 100%;
            height: 100%;
            cursor: grab;
        }}
        #map-canvas:active {{
            cursor: grabbing;
        }}
        .tooltip {{
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
        }}
        .tooltip.visible {{
            display: block;
        }}
        .tooltip-row {{
            margin: 2px 0;
        }}
        .tooltip-field {{
            font-weight: 600;
            color: #333;
        }}
        .tooltip-value {{
            color: #666;
        }}
        #controls {{
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            z-index: 100;
        }}
        #controls button {{
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
        }}
        #controls button:hover {{
            background: #f0f0f0;
        }}
        #attribution {{
            position: absolute;
            bottom: 5px;
            right: 5px;
            font-size: 11px;
            color: #666;
            background: rgba(255,255,255,0.7);
            padding: 2px 5px;
            border-radius: 3px;
        }}'''

    def _generate_js(self, data: Dict, center: List[float], zoom: float, bounds: Dict, options: Dict) -> str:
        """Generate JavaScript code."""
        tile_url_js = json.dumps(options['tile_url']) if options['tile_url'] else 'null'

        return f'''
(function() {{
    'use strict';

    // Data
    const mapData = {json.dumps(data)};
    const initialCenter = {json.dumps(center)};
    const initialZoom = {zoom};
    const dataBounds = {json.dumps(bounds)};
    const tileUrl = {tile_url_js};

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
    function init() {{
        resize();
        window.addEventListener('resize', resize);
        setupEvents();
        render();
    }}

    function resize() {{
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        render();
    }}

    // Coordinate transforms
    function latlngToPixel(lat, lng) {{
        const scale = Math.pow(2, viewZoom) * TILE_SIZE;
        const x = (lng + 180) / 360 * scale;
        const latRad = lat * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;

        const centerPixel = getCenterPixel();
        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;

        return {{
            x: x - centerPixel.x + canvasWidth / 2,
            y: y - centerPixel.y + canvasHeight / 2
        }};
    }}

    function pixelToLatLng(px, py) {{
        const centerPixel = getCenterPixel();
        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;

        const worldX = px + centerPixel.x - canvasWidth / 2;
        const worldY = py + centerPixel.y - canvasHeight / 2;

        const scale = Math.pow(2, viewZoom) * TILE_SIZE;
        const lng = worldX / scale * 360 - 180;
        const n = Math.PI - 2 * Math.PI * worldY / scale;
        const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        return {{ lat, lng }};
    }}

    function getCenterPixel() {{
        const scale = Math.pow(2, viewZoom) * TILE_SIZE;
        const x = (viewCenter[1] + 180) / 360 * scale;
        const latRad = viewCenter[0] * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;
        return {{ x, y }};
    }}

    // Debug info element
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-info';
    debugDiv.style.cssText = 'position:absolute;bottom:30px;left:10px;background:rgba(0,0,0,0.7);color:#0f0;font:12px monospace;padding:8px;border-radius:4px;z-index:1000;';
    container.appendChild(debugDiv);

    function updateDebugInfo() {{
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        const nw = pixelToLatLng(0, 0);
        const se = pixelToLatLng(w, h);
        const ne = pixelToLatLng(w, 0);
        const sw = pixelToLatLng(0, h);

        const normLng = (lng) => {{
            while (lng > 180) lng -= 360;
            while (lng < -180) lng += 360;
            return lng;
        }};

        debugDiv.innerHTML =
            '<b>Visible Bounds:</b><br>' +
            'NW: ' + nw.lat.toFixed(4) + ', ' + normLng(nw.lng).toFixed(4) + '<br>' +
            'NE: ' + ne.lat.toFixed(4) + ', ' + normLng(ne.lng).toFixed(4) + '<br>' +
            'SW: ' + sw.lat.toFixed(4) + ', ' + normLng(sw.lng).toFixed(4) + '<br>' +
            'SE: ' + se.lat.toFixed(4) + ', ' + normLng(se.lng).toFixed(4) + '<br>' +
            '<b>Center:</b> ' + viewCenter[0].toFixed(4) + ', ' + viewCenter[1].toFixed(4) + '<br>' +
            '<b>Zoom:</b> ' + viewZoom.toFixed(2);
    }}

    // Rendering
    function render() {{
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;

        ctx.clearRect(0, 0, w, h);
        updateDebugInfo();

        if (tileUrl) {{
            drawTiles(w, h);
        }}

        for (const polygon of mapData.polygons) {{
            drawPolygon(polygon);
        }}

        for (const line of mapData.lines) {{
            drawLine(line);
        }}

        for (const point of mapData.points) {{
            drawPoint(point);
        }}
    }}

    function drawTiles(w, h) {{
        const centerPixel = getCenterPixel();
        const tileZoom = Math.floor(viewZoom);
        const tileScale = Math.pow(2, tileZoom);

        const fractionalScale = Math.pow(2, viewZoom - tileZoom);
        const scaledTileSize = TILE_SIZE * fractionalScale;

        const centerAtTileZoom = {{
            x: centerPixel.x / fractionalScale,
            y: centerPixel.y / fractionalScale
        }};

        const halfWidthInTiles = (w / 2) / scaledTileSize;
        const halfHeightInTiles = (h / 2) / scaledTileSize;
        const centerTileX = centerAtTileZoom.x / TILE_SIZE;
        const centerTileY = centerAtTileZoom.y / TILE_SIZE;

        const startX = Math.floor(centerTileX - halfWidthInTiles - 1);
        const startY = Math.floor(centerTileY - halfHeightInTiles - 1);
        const endX = Math.ceil(centerTileX + halfWidthInTiles + 1);
        const endY = Math.ceil(centerTileY + halfHeightInTiles + 1);

        for (let x = startX; x <= endX; x++) {{
            for (let y = startY; y <= endY; y++) {{
                if (x < 0 || y < 0 || x >= tileScale || y >= tileScale) continue;

                const tileWorldX = x * TILE_SIZE * fractionalScale;
                const tileWorldY = y * TILE_SIZE * fractionalScale;

                const tileX = tileWorldX - centerPixel.x + w / 2;
                const tileY = tileWorldY - centerPixel.y + h / 2;

                const key = tileZoom + '/' + x + '/' + y;
                let tile = tileCache.get(key);

                if (!tile) {{
                    tile = new Image();
                    tile.crossOrigin = 'anonymous';
                    tile.onload = render;
                    tile.src = tileUrl.replace('{{z}}', tileZoom).replace('{{x}}', x).replace('{{y}}', y);
                    tileCache.set(key, tile);
                }}

                if (tile.complete && tile.naturalWidth > 0) {{
                    ctx.drawImage(tile, tileX, tileY, scaledTileSize, scaledTileSize);
                }}
            }}
        }}
    }}

    function drawPoint(point) {{
        const pos = latlngToPixel(point.lat, point.lng);
        const style = point.style;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, style.radius, 0, Math.PI * 2);

        ctx.fillStyle = style.color;
        ctx.globalAlpha = style.opacity;
        ctx.fill();

        if (style.stroke_width > 0) {{
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = style.stroke_width;
            ctx.stroke();
        }}

        ctx.globalAlpha = 1;

        if (style.label_field && point.properties[style.label_field]) {{
            ctx.fillStyle = '#333';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(point.properties[style.label_field], pos.x, pos.y - style.radius - 5);
        }}
    }}

    function drawLine(line) {{
        if (line.coords.length < 2) return;

        const style = line.style;
        ctx.beginPath();

        const start = latlngToPixel(line.coords[0][0], line.coords[0][1]);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < line.coords.length; i++) {{
            const pos = latlngToPixel(line.coords[i][0], line.coords[i][1]);
            ctx.lineTo(pos.x, pos.y);
        }}

        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.stroke_width;
        ctx.globalAlpha = style.stroke_opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (style.stroke_dasharray) {{
            ctx.setLineDash(style.stroke_dasharray.split(',').map(Number));
        }} else {{
            ctx.setLineDash([]);
        }}

        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
    }}

    function drawPolygon(polygon) {{
        if (polygon.rings.length === 0 || polygon.rings[0].length < 3) return;

        const style = polygon.style;
        ctx.beginPath();

        const outer = polygon.rings[0];
        const start = latlngToPixel(outer[0][0], outer[0][1]);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < outer.length; i++) {{
            const pos = latlngToPixel(outer[i][0], outer[i][1]);
            ctx.lineTo(pos.x, pos.y);
        }}
        ctx.closePath();

        for (let r = 1; r < polygon.rings.length; r++) {{
            const ring = polygon.rings[r];
            const holeStart = latlngToPixel(ring[0][0], ring[0][1]);
            ctx.moveTo(holeStart.x, holeStart.y);
            for (let i = 1; i < ring.length; i++) {{
                const pos = latlngToPixel(ring[i][0], ring[i][1]);
                ctx.lineTo(pos.x, pos.y);
            }}
            ctx.closePath();
        }}

        ctx.fillStyle = style.fill;
        ctx.globalAlpha = style.fill_opacity;
        ctx.fill('evenodd');

        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.stroke_width;
        ctx.globalAlpha = style.stroke_opacity;
        ctx.stroke();

        ctx.globalAlpha = 1;
    }}

    // Event handling
    function setupEvents() {{
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('wheel', onWheel, {{ passive: false }});

        canvas.addEventListener('touchstart', onTouchStart, {{ passive: false }});
        canvas.addEventListener('touchmove', onTouchMove, {{ passive: false }});
        canvas.addEventListener('touchend', onTouchEnd);

        document.getElementById('zoom-in').addEventListener('click', () => setZoom(viewZoom + 1));
        document.getElementById('zoom-out').addEventListener('click', () => setZoom(viewZoom - 1));
        document.getElementById('fit-bounds').addEventListener('click', fitBounds);
    }}

    function onMouseDown(e) {{
        isDragging = true;
        dragStart = {{ x: e.clientX, y: e.clientY }};
        dragCenterStart = [...viewCenter];
    }}

    function onMouseMove(e) {{
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isDragging && dragStart) {{
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            const startLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);
            const endLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio - dx, canvas.height / 2 / window.devicePixelRatio - dy);

            viewCenter = [
                dragCenterStart[0] - (endLatLng.lat - startLatLng.lat),
                dragCenterStart[1] - (endLatLng.lng - startLatLng.lng)
            ];
            render();
        }} else {{
            updateTooltip(x, y);
        }}
    }}

    function onMouseUp() {{
        isDragging = false;
        dragStart = null;
        dragCenterStart = null;
    }}

    function onMouseLeave() {{
        isDragging = false;
        hideTooltip();
    }}

    function normalizeLng(lng) {{
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;
        return lng;
    }}

    function onWheel(e) {{
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const targetLatLng = pixelToLatLng(mouseX, mouseY);

        let targetLng = targetLatLng.lng;
        while (targetLng - viewCenter[1] > 180) targetLng -= 360;
        while (targetLng - viewCenter[1] < -180) targetLng += 360;
        targetLatLng.lng = targetLng;

        const delta = e.deltaY > 0 ? -0.5 : 0.5;
        const newZoom = Math.max(1, Math.min(20, viewZoom + delta));
        if (newZoom === viewZoom) return;

        viewZoom = newZoom;

        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;
        const scale = Math.pow(2, viewZoom) * TILE_SIZE;

        const targetWorldX = (targetLatLng.lng + 180) / 360 * scale;
        const targetLatRad = targetLatLng.lat * Math.PI / 180;
        const targetWorldY = (1 - Math.log(Math.tan(targetLatRad) + 1 / Math.cos(targetLatRad)) / Math.PI) / 2 * scale;

        const newCenterWorldX = targetWorldX - mouseX + canvasWidth / 2;
        const newCenterWorldY = targetWorldY - mouseY + canvasHeight / 2;

        let newCenterLng = newCenterWorldX / scale * 360 - 180;
        const n = Math.PI - 2 * Math.PI * newCenterWorldY / scale;
        let newCenterLat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        newCenterLat = Math.max(-85, Math.min(85, newCenterLat));
        newCenterLng = normalizeLng(newCenterLng);

        viewCenter = [newCenterLat, newCenterLng];

        render();
    }}

    let touchStartDist = null;
    let touchStartZoom = null;

    function onTouchStart(e) {{
        e.preventDefault();
        if (e.touches.length === 1) {{
            isDragging = true;
            dragStart = {{ x: e.touches[0].clientX, y: e.touches[0].clientY }};
            dragCenterStart = [...viewCenter];
        }} else if (e.touches.length === 2) {{
            isDragging = false;
            touchStartDist = getTouchDistance(e.touches);
            touchStartZoom = viewZoom;
        }}
    }}

    function onTouchMove(e) {{
        e.preventDefault();
        if (e.touches.length === 1 && isDragging && dragStart) {{
            const dx = e.touches[0].clientX - dragStart.x;
            const dy = e.touches[0].clientY - dragStart.y;

            const startLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);
            const endLatLng = pixelToLatLng(canvas.width / 2 / window.devicePixelRatio - dx, canvas.height / 2 / window.devicePixelRatio - dy);

            viewCenter = [
                dragCenterStart[0] - (endLatLng.lat - startLatLng.lat),
                dragCenterStart[1] - (endLatLng.lng - startLatLng.lng)
            ];
            render();
        }} else if (e.touches.length === 2 && touchStartDist) {{
            const dist = getTouchDistance(e.touches);
            const scale = dist / touchStartDist;
            setZoom(touchStartZoom + Math.log2(scale));
        }}
    }}

    function onTouchEnd() {{
        isDragging = false;
        dragStart = null;
        touchStartDist = null;
    }}

    function getTouchDistance(touches) {{
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }}

    function setZoom(z) {{
        viewZoom = Math.max(1, Math.min(20, z));
        render();
    }}

    function fitBounds() {{
        if (!dataBounds) return;

        viewCenter = [
            (dataBounds.min_lat + dataBounds.max_lat) / 2,
            (dataBounds.min_lng + dataBounds.max_lng) / 2
        ];
        viewZoom = initialZoom;
        render();
    }}

    // Tooltip
    function updateTooltip(x, y) {{
        let found = null;
        let foundType = null;

        for (let i = mapData.points.length - 1; i >= 0; i--) {{
            const point = mapData.points[i];
            const pos = latlngToPixel(point.lat, point.lng);
            const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
            if (dist <= point.style.radius + 3) {{
                found = point;
                foundType = 'point';
                break;
            }}
        }}

        if (!found) {{
            for (let i = mapData.lines.length - 1; i >= 0; i--) {{
                const line = mapData.lines[i];
                if (isPointNearLine(x, y, line)) {{
                    found = line;
                    foundType = 'line';
                    break;
                }}
            }}
        }}

        if (!found) {{
            for (let i = mapData.polygons.length - 1; i >= 0; i--) {{
                const polygon = mapData.polygons[i];
                if (isPointInPolygon(x, y, polygon)) {{
                    found = polygon;
                    foundType = 'polygon';
                    break;
                }}
            }}
        }}

        if (found) {{
            showTooltip(x, y, found, foundType);
        }} else {{
            hideTooltip();
        }}
    }}

    function isPointNearLine(px, py, line) {{
        const tolerance = line.style.stroke_width / 2 + 5;

        for (let i = 0; i < line.coords.length - 1; i++) {{
            const p1 = latlngToPixel(line.coords[i][0], line.coords[i][1]);
            const p2 = latlngToPixel(line.coords[i + 1][0], line.coords[i + 1][1]);

            const dist = pointToSegmentDistance(px, py, p1.x, p1.y, p2.x, p2.y);
            if (dist <= tolerance) return true;
        }}
        return false;
    }}

    function pointToSegmentDistance(px, py, x1, y1, x2, y2) {{
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;

        if (len2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));

        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));

        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;

        return Math.sqrt(Math.pow(px - nearX, 2) + Math.pow(py - nearY, 2));
    }}

    function isPointInPolygon(px, py, polygon) {{
        if (polygon.rings.length === 0) return false;

        const pixelRings = polygon.rings.map(ring =>
            ring.map(coord => latlngToPixel(coord[0], coord[1]))
        );

        if (!pointInRing(px, py, pixelRings[0])) return false;

        for (let i = 1; i < pixelRings.length; i++) {{
            if (pointInRing(px, py, pixelRings[i])) return false;
        }}

        return true;
    }}

    function pointInRing(px, py, ring) {{
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {{
            const xi = ring[i].x, yi = ring[i].y;
            const xj = ring[j].x, yj = ring[j].y;

            if (((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {{
                inside = !inside;
            }}
        }}
        return inside;
    }}

    function showTooltip(x, y, feature, type) {{
        const style = feature.style;
        const fields = style.tooltip_fields;
        const template = style.tooltip_template;
        const properties = feature.properties;

        if (!fields && !template) {{
            hideTooltip();
            return;
        }}

        let html = '';

        if (template) {{
            html = template.replace(/\\{{(\\w+)\\}}/g, (_, key) => {{
                return properties[key] != null ? escapeHtml(String(properties[key])) : '';
            }});
        }} else if (fields) {{
            for (const field of fields) {{
                if (properties[field] != null) {{
                    html += '<div class="tooltip-row">';
                    html += '<span class="tooltip-field">' + escapeHtml(field) + ':</span> ';
                    html += '<span class="tooltip-value">' + escapeHtml(String(properties[field])) + '</span>';
                    html += '</div>';
                }}
            }}
        }}

        if (!html) {{
            hideTooltip();
            return;
        }}

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');

        const rect = container.getBoundingClientRect();
        let left = x + 15;
        let top = y + 15;

        if (left + tooltip.offsetWidth > rect.width - 10) {{
            left = x - tooltip.offsetWidth - 10;
        }}
        if (top + tooltip.offsetHeight > rect.height - 10) {{
            top = y - tooltip.offsetHeight - 10;
        }}

        tooltip.style.left = Math.max(5, left) + 'px';
        tooltip.style.top = Math.max(5, top) + 'px';
    }}

    function hideTooltip() {{
        tooltip.classList.remove('visible');
    }}

    function escapeHtml(text) {{
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }}

    window.pixelToLatLng = pixelToLatLng;
    window.latlngToPixel = latlngToPixel;
    window.render = render;
    window.mapData = mapData;
    window.canvas = canvas;
    window.getViewCenter = () => [...viewCenter];
    window.setViewCenter = (lat, lng) => {{ viewCenter[0] = lat; viewCenter[1] = lng; }};
    window.getViewZoom = () => viewZoom;
    window.setViewZoom = (z) => {{ viewZoom = z; }};

    Object.defineProperty(window, 'viewCenter', {{
        get: () => viewCenter,
        set: (v) => {{ viewCenter[0] = v[0]; viewCenter[1] = v[1]; }},
        configurable: true
    }});
    Object.defineProperty(window, 'viewZoom', {{
        get: () => viewZoom,
        set: (v) => {{ viewZoom = v; }},
        configurable: true
    }});

    init();
}})();'''


# Convenience function for quick exports
def export_points(points: List[Dict], filename: str, **options) -> None:
    """Quick export of points to HTML file."""
    HtmlExport.from_points(points, **options).save(filename)


def export_lines(lines: List[Dict], filename: str, **options) -> None:
    """Quick export of lines to HTML file."""
    HtmlExport.from_lines(lines, **options).save(filename)


def export_polygons(polygons: List[Dict], filename: str, **options) -> None:
    """Quick export of polygons to HTML file."""
    HtmlExport.from_polygons(polygons, **options).save(filename)


def export_geojson(geojson: Dict, filename: str, **options) -> None:
    """Quick export of GeoJSON to HTML file."""
    HtmlExport.from_geojson(geojson, **options).save(filename)
