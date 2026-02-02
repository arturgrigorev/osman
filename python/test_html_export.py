"""
Test script for HtmlExport Python implementation.

Run with: python test_html_export.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from html_export import HtmlExport, export_points


def test_basic_points():
    """Test basic point export."""
    print("Testing basic points...")

    cities = [
        {'lat': 40.7128, 'lng': -74.0060, 'name': 'New York', 'country': 'USA', 'population': 8336817},
        {'lat': 51.5074, 'lng': -0.1278, 'name': 'London', 'country': 'UK', 'population': 8982000},
        {'lat': 35.6762, 'lng': 139.6503, 'name': 'Tokyo', 'country': 'Japan', 'population': 13960000},
        {'lat': -33.8688, 'lng': 151.2093, 'name': 'Sydney', 'country': 'Australia', 'population': 5312000},
        {'lat': 48.8566, 'lng': 2.3522, 'name': 'Paris', 'country': 'France', 'population': 2161000},
    ]

    exporter = HtmlExport(
        title='World Capitals',
        tile_url='https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution='© OpenStreetMap contributors'
    )

    exporter.add_points(
        cities,
        color='#e74c3c',
        radius=10,
        tooltip_fields=['name', 'country', 'population'],
        label_field='name'
    )

    output_path = Path(__file__).parent / 'test_output' / 'test_points.html'
    output_path.parent.mkdir(exist_ok=True)
    exporter.save(output_path)

    print(f"  [OK] Generated: {output_path}")
    return True


def test_lines():
    """Test line export."""
    print("Testing lines...")

    routes = [
        {'coords': [[40.7128, -74.0060], [51.5074, -0.1278]], 'route': 'NYC-London', 'airline': 'BA'},
        {'coords': [[51.5074, -0.1278], [35.6762, 139.6503]], 'route': 'London-Tokyo', 'airline': 'JAL'},
        {'coords': [[35.6762, 139.6503], [-33.8688, 151.2093]], 'route': 'Tokyo-Sydney', 'airline': 'QF'},
    ]

    exporter = HtmlExport(
        title='Flight Routes',
        tile_url='https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        attribution='© OpenStreetMap © CARTO'
    )

    exporter.add_lines(
        routes,
        stroke='#e74c3c',
        stroke_width=2,
        stroke_dasharray='10,5',
        tooltip_fields=['route', 'airline']
    )

    output_path = Path(__file__).parent / 'test_output' / 'test_lines.html'
    exporter.save(output_path)

    print(f"  [OK] Generated: {output_path}")
    return True


def test_polygons():
    """Test polygon export."""
    print("Testing polygons...")

    zones = [
        {
            'coords': [
                [40.7580, -73.9855],
                [40.7580, -73.9655],
                [40.7480, -73.9655],
                [40.7480, -73.9855]
            ],
            'name': 'Midtown',
            'type': 'commercial',
            'area': 1.2
        },
        {
            'coords': [
                [40.7280, -74.0060],
                [40.7280, -73.9860],
                [40.7180, -73.9860],
                [40.7180, -74.0060]
            ],
            'name': 'Financial District',
            'type': 'commercial',
            'area': 0.8
        },
        {
            'coords': [
                [40.7831, -73.9712],
                [40.7831, -73.9512],
                [40.7731, -73.9512],
                [40.7731, -73.9712]
            ],
            'name': 'Upper East Side',
            'type': 'residential',
            'area': 1.5
        }
    ]

    exporter = HtmlExport(
        title='Manhattan Zones',
        tile_url='https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution='© OpenStreetMap contributors'
    )

    exporter.add_polygons(
        zones,
        fill='#3498db',
        fill_opacity=0.4,
        stroke='#2980b9',
        stroke_width=2,
        tooltip_fields=['name', 'type', 'area']
    )

    output_path = Path(__file__).parent / 'test_output' / 'test_polygons.html'
    exporter.save(output_path)

    print(f"  [OK] Generated: {output_path}")
    return True


def test_geojson():
    """Test GeoJSON export."""
    print("Testing GeoJSON...")

    geojson = {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [-122.4194, 37.7749]},
                'properties': {'name': 'San Francisco', 'state': 'CA'}
            },
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [-118.2437, 34.0522]},
                'properties': {'name': 'Los Angeles', 'state': 'CA'}
            },
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [[-122.4194, 37.7749], [-118.2437, 34.0522]]
                },
                'properties': {'name': 'SF to LA', 'distance': '380 miles'}
            }
        ]
    }

    exporter = HtmlExport(
        title='California GeoJSON',
        tile_url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    )

    exporter.add_geojson(geojson, tooltip_fields=['name', 'state', 'distance'])

    output_path = Path(__file__).parent / 'test_output' / 'test_geojson.html'
    exporter.save(output_path)

    print(f"  [OK] Generated: {output_path}")
    return True


def test_combined():
    """Test combined points, lines, and polygons."""
    print("Testing combined layers...")

    exporter = HtmlExport(
        title='Combined Map',
        tile_url='https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attribution='© OpenStreetMap © CARTO'
    )

    # Add points
    exporter.add_points([
        {'lat': 40.7128, 'lng': -74.0060, 'name': 'NYC'},
        {'lat': 40.7580, 'lng': -73.9855, 'name': 'Times Square'},
        {'lat': 40.7484, 'lng': -73.9857, 'name': 'Empire State'},
    ], color='#f1c40f', radius=8, tooltip_fields=['name'])

    # Add lines
    exporter.add_lines([
        {'coords': [[40.7128, -74.0060], [40.7580, -73.9855]], 'route': 'Downtown to Midtown'},
        {'coords': [[40.7580, -73.9855], [40.7484, -73.9857]], 'route': 'Midtown Loop'},
    ], stroke='#2ecc71', stroke_width=3, tooltip_fields=['route'])

    # Add polygon
    exporter.add_polygons([
        {
            'coords': [[40.7680, -73.9955], [40.7680, -73.9755], [40.7480, -73.9755], [40.7480, -73.9955]],
            'name': 'Central Area'
        }
    ], fill='#9b59b6', fill_opacity=0.3, tooltip_fields=['name'])

    output_path = Path(__file__).parent / 'test_output' / 'test_combined.html'
    exporter.save(output_path)

    print(f"  [OK] Generated: {output_path}")
    return True


def test_chaining():
    """Test method chaining."""
    print("Testing method chaining...")

    output_path = Path(__file__).parent / 'test_output' / 'test_chaining.html'

    (HtmlExport(title='Chained Export')
        .add_points([{'lat': 40.7128, 'lng': -74.0060, 'name': 'Point 1'}], color='#e74c3c')
        .add_points([{'lat': 40.7580, 'lng': -73.9855, 'name': 'Point 2'}], color='#3498db')
        .add_lines([{'coords': [[40.7128, -74.0060], [40.7580, -73.9855]], 'name': 'Line'}], stroke='#2ecc71')
        .save(output_path))

    print(f"  [OK] Generated: {output_path}")
    return True


def test_factory_methods():
    """Test static factory methods."""
    print("Testing factory methods...")

    output_dir = Path(__file__).parent / 'test_output'

    # from_points
    HtmlExport.from_points(
        [{'lat': 40.7128, 'lng': -74.0060, 'name': 'NYC'}],
        title='From Points',
        color='#e74c3c',
        tooltip_fields=['name']
    ).save(output_dir / 'test_from_points.html')

    print(f"  [OK] Generated: test_from_points.html")
    return True


def test_no_tiles():
    """Test export without tile layer."""
    print("Testing without tiles...")

    exporter = HtmlExport(
        title='No Tiles Map',
        background_color='#1a1a2e'
    )

    exporter.add_points([
        {'lat': 0, 'lng': 0, 'name': 'Origin'},
        {'lat': 45, 'lng': 90, 'name': 'Point A'},
        {'lat': -45, 'lng': -90, 'name': 'Point B'},
    ], color='#00ff00', radius=12, tooltip_fields=['name'])

    output_path = Path(__file__).parent / 'test_output' / 'test_no_tiles.html'
    exporter.save(output_path)

    print(f"  [OK] Generated: {output_path}")
    return True


def main():
    """Run all tests."""
    print("=" * 60)
    print("  HtmlExport Python Test Suite")
    print("=" * 60)
    print()

    tests = [
        test_basic_points,
        test_lines,
        test_polygons,
        test_geojson,
        test_combined,
        test_chaining,
        test_factory_methods,
        test_no_tiles,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  [FAIL] {test.__name__} failed: {e}")
            failed += 1

    print()
    print("=" * 60)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed == 0:
        print("\n  All tests passed! Check test_output/ for generated files.")

    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
