/**
 * ScaleBar - Scale indicator control
 *
 * Displays a scale bar showing the distance at the current zoom level.
 *
 * @example
 * const scale = new ScaleBar({ position: 'bottom_left' });
 * scale.add_to(map);
 */

import { Control, ControlPosition } from './control.js';
import { merge_options } from '../core/options.js';

/**
 * Default scale bar options.
 */
const DEFAULT_OPTIONS = {
    position: ControlPosition.BOTTOM_LEFT,
    max_width: 100,
    metric: true,
    imperial: false,
    update_when_idle: false
};

/**
 * ScaleBar class for scale indicator.
 */
export class ScaleBar extends Control {
    /**
     * Create a new ScaleBar.
     *
     * @param {Object} [options] - Scale bar options
     */
    constructor(options = {}) {
        super(merge_options(DEFAULT_OPTIONS, options));

        this._metric_scale = null;
        this._imperial_scale = null;
    }

    /**
     * Called when control is added to a map.
     *
     * @param {Osman} map - The map instance
     * @returns {HTMLElement} The control container element
     */
    on_add(map) {
        const container = super.on_add(map);
        container.classList.add('um-scale-bar');

        if (this._options.metric) {
            this._metric_scale = this._create_scale('metric');
            container.appendChild(this._metric_scale);
        }

        if (this._options.imperial) {
            this._imperial_scale = this._create_scale('imperial');
            container.appendChild(this._imperial_scale);
        }

        // Update on zoom/move
        map.on('map:zoom', () => this._update());
        map.on('map:move', () => this._update());

        this._update();

        return container;
    }

    /**
     * Called when control is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        this._metric_scale = null;
        this._imperial_scale = null;

        super.on_remove(map);
    }

    /**
     * Create a scale element.
     *
     * @param {string} type - 'metric' or 'imperial'
     * @returns {HTMLElement} Scale element
     * @private
     */
    _create_scale(type) {
        const scale = document.createElement('div');
        scale.className = `um-scale-${type}`;

        const label = document.createElement('span');
        label.className = 'um-scale-label';
        scale.appendChild(label);

        const line = document.createElement('div');
        line.className = 'um-scale-line';
        scale.appendChild(line);

        return scale;
    }

    /**
     * Update the scale bar.
     * @private
     */
    _update() {
        if (!this._map) return;

        const center = this._map.get_center();
        const resolution = this._map._viewport.get_resolution();

        // Calculate max meters for the scale bar width
        const max_meters = this._options.max_width * resolution;

        if (this._options.metric && this._metric_scale) {
            this._update_metric(max_meters);
        }

        if (this._options.imperial && this._imperial_scale) {
            this._update_imperial(max_meters);
        }
    }

    /**
     * Update metric scale.
     *
     * @param {number} max_meters - Maximum meters
     * @private
     */
    _update_metric(max_meters) {
        const { value, unit, label } = this._get_metric_scale(max_meters);
        const width = this._options.max_width * (value / max_meters);

        const scale_label = this._metric_scale.querySelector('.um-scale-label');
        const scale_line = this._metric_scale.querySelector('.um-scale-line');

        scale_label.textContent = label;
        scale_line.style.width = `${width}px`;
    }

    /**
     * Update imperial scale.
     *
     * @param {number} max_meters - Maximum meters
     * @private
     */
    _update_imperial(max_meters) {
        const max_feet = max_meters * 3.28084;
        const { value, label } = this._get_imperial_scale(max_feet);
        const width = this._options.max_width * ((value / 3.28084) / max_meters);

        const scale_label = this._imperial_scale.querySelector('.um-scale-label');
        const scale_line = this._imperial_scale.querySelector('.um-scale-line');

        scale_label.textContent = label;
        scale_line.style.width = `${width}px`;
    }

    /**
     * Get nice metric scale value.
     *
     * @param {number} max_meters - Maximum meters
     * @returns {Object} { value, unit, label }
     * @private
     */
    _get_metric_scale(max_meters) {
        const nice_values = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

        let value = max_meters;
        let unit = 'm';

        for (const v of nice_values) {
            if (v <= max_meters) {
                value = v;
            } else {
                break;
            }
        }

        let label;
        if (value >= 1000) {
            label = `${value / 1000} km`;
        } else {
            label = `${value} m`;
        }

        return { value, unit, label };
    }

    /**
     * Get nice imperial scale value.
     *
     * @param {number} max_feet - Maximum feet
     * @returns {Object} { value, label }
     * @private
     */
    _get_imperial_scale(max_feet) {
        const nice_feet = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5280, 10560, 26400, 52800];

        let value = max_feet;

        for (const v of nice_feet) {
            if (v <= max_feet) {
                value = v;
            } else {
                break;
            }
        }

        let label;
        if (value >= 5280) {
            const miles = value / 5280;
            label = miles === 1 ? '1 mile' : `${miles} miles`;
        } else {
            label = `${value} ft`;
        }

        return { value, label };
    }
}
