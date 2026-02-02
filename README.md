# Osman

JavaScript ES module for urban analysis map visualizations.

## Installation

```bash
# npm install osman
# not available yet
```

## Quick Start

```javascript
import { Osman, TileLayer, ZoomControl } from 'osman';

const map = new Osman('map', {
    center: [40.7128, -74.0060],
    zoom: 12
});

new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').add_to(map);
new ZoomControl().add_to(map);
```

## Examples

### Adding Vector Shapes

```javascript
import { Osman, Polygon, Circle, Polyline } from 'osman';

const map = new Osman('map', { center: [40.7, -74.0], zoom: 13 });

// Draw a polygon
new Polygon([
    [40.71, -74.01],
    [40.72, -74.00],
    [40.71, -73.99]
], {
    fill_color: '#3388ff',
    fill_opacity: 0.5
}).add_to(map);

// Draw a circle (radius in meters)
new Circle([40.715, -74.005], {
    radius: 500,
    stroke_color: '#ff0000'
}).add_to(map);
```

### Working with GeoJSON

```javascript
import { Osman, GeoJSON, load_geojson } from 'osman';

const map = new Osman('map', { center: [40.7, -74.0], zoom: 12 });

// Load and display GeoJSON
const data = await load_geojson('neighborhoods.geojson');
new GeoJSON(data, {
    style: feature => ({
        fill_color: feature.properties.color,
        stroke_width: 2
    }),
    on_each_feature: (feature, layer) => {
        layer.bindPopup(feature.properties.name);
    }
}).add_to(map);
```

### Urban Analysis Layers

```javascript
import { Osman, BuildingLayer, RoadLayer, ZoneLayer } from 'osman';

const map = new Osman('map', { center: [40.7, -74.0], zoom: 15 });

// Building footprints with height extrusion
new BuildingLayer(buildingData, {
    height_property: 'floors',
    height_multiplier: 3.5
}).add_to(map);

// Road network with classification styling
new RoadLayer(roadData, {
    style_by_type: true
}).add_to(map);

// Zoning visualization
new ZoneLayer(zoneData, {
    color_by: 'zone_type'
}).add_to(map);
```

### Measurement Tools

```javascript
import { Osman, MeasureTool, MeasureMode } from 'osman';

const map = new Osman('map', { center: [40.7, -74.0], zoom: 14 });

const measure = new MeasureTool(map, {
    mode: MeasureMode.DISTANCE,  // or MeasureMode.AREA
    units: 'metric'
});

measure.on('measurement', result => {
    console.log(`Distance: ${result.value} ${result.unit}`);
});

measure.enable();
```

### Drawing Tools

```javascript
import { Osman, DrawTool, DrawMode } from 'osman';

const map = new Osman('map', { center: [40.7, -74.0], zoom: 14 });

const draw = new DrawTool(map, {
    mode: DrawMode.POLYGON
});

draw.on('created', layer => {
    console.log('Shape drawn:', layer.toGeoJSON());
});

draw.enable();
```

### Buffer Analysis

```javascript
import { point_buffer, line_buffer, polygon_buffer } from 'osman';

// Create 500m buffer around a point
const pointBuffer = point_buffer([40.7128, -74.0060], 500);

// Create 100m buffer around a line
const lineBuffer = line_buffer([
    [40.71, -74.01],
    [40.72, -74.00]
], 100);
```

### Data Visualization with Color Scales

```javascript
import { Osman, GeoJSON, ColorScale } from 'osman';

const scale = new ColorScale({
    domain: [0, 100],
    range: ['#ffffcc', '#800026']  // yellow to red
});

new GeoJSON(data, {
    style: feature => ({
        fill_color: scale.get(feature.properties.density)
    })
}).add_to(map);
```

### Map Export

```javascript
import { MapExport, HtmlExport, ExportFormat } from 'osman';

// Export as PNG
const exporter = new MapExport(map);
const blob = await exporter.to_blob(ExportFormat.PNG);

// Export as standalone HTML
const htmlExporter = new HtmlExport(map);
const html = htmlExporter.generate({ title: 'My Map' });
```

### Recording Animations

```javascript
import { Osman, Recorder, Player } from 'osman';

const map = new Osman('map', { center: [40.7, -74.0], zoom: 12 });

// Record map movements
const recorder = new Recorder(map);
recorder.start();

// ... user interacts with map ...

const recording = recorder.stop();

// Playback
const player = new Player(map, recording);
player.play();
```

## API Reference

### Core Classes

| Class | Description |
|-------|-------------|
| `Osman` | Main map container |
| `LatLng` | Geographic coordinate |
| `Bounds` | Rectangular bounds |
| `Point` | Pixel coordinate |

### Layers

| Class | Description |
|-------|-------------|
| `TileLayer` | Raster tile layer |
| `LayerGroup` | Collection of layers |
| `GeoJSON` | GeoJSON data layer |
| `GridLayer` | Analysis grid overlay |

### Vector

| Class | Description |
|-------|-------------|
| `Polyline` | Line geometry |
| `Polygon` | Polygon geometry |
| `Rectangle` | Rectangle geometry |
| `Circle` | Circle with radius |
| `CircleMarker` | Fixed-size circle marker |

### Markers

| Class | Description |
|-------|-------------|
| `Marker` | Standard map marker |
| `IconMarker` | Custom icon marker |
| `SymbolMarker` | Symbol-based marker |

### Controls

| Class | Description |
|-------|-------------|
| `ZoomControl` | Zoom in/out buttons |
| `ScaleBar` | Distance scale indicator |
| `Legend` | Map legend |

### Urban

| Class | Description |
|-------|-------------|
| `BuildingLayer` | Building footprints |
| `RoadLayer` | Road network |
| `ZoneLayer` | Zoning areas |

### Tools

| Class | Description |
|-------|-------------|
| `MeasureTool` | Distance/area measurement |
| `DrawTool` | Shape drawing |

## Events

The map and layers emit events that can be listened to:

```javascript
map.on('click', e => console.log('Clicked at:', e.latlng));
map.on('zoom', e => console.log('Zoom level:', e.zoom));
map.on('move', e => console.log('Center:', e.center));

layer.on('add', () => console.log('Layer added'));
layer.on('remove', () => console.log('Layer removed'));
```

## Python Bindings

Python bindings are available in the `python/` directory for generating maps from Python scripts.

```python
from osman import Osman, TileLayer, Marker

m = Osman(center=[40.7128, -74.0060], zoom=12)
TileLayer('osm').add_to(m)
Marker([40.7128, -74.0060], popup='NYC').add_to(m)

m.save('map.html')
```

## Browser Support

Modern browsers with ES module support (Chrome, Firefox, Safari, Edge).

## License

MIT
