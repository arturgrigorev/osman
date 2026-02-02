/**
 * ZoomControl - Zoom +/- buttons control
 *
 * Provides buttons for zooming in and out of the map.
 *
 * @example
 * const zoom = new ZoomControl({ position: 'top_left' });
 * zoom.add_to(map);
 */

import { Control, ControlPosition } from './control.js';
import { merge_options } from '../core/options.js';

/**
 * Default zoom control options.
 */
const DEFAULT_OPTIONS = {
    position: ControlPosition.TOP_LEFT,
    zoom_in_text: '+',
    zoom_out_text: '−',  // minus sign, not hyphen
    zoom_in_title: 'Zoom in',
    zoom_out_title: 'Zoom out',
    zoom_delta: 1
};

/**
 * ZoomControl class for zoom buttons.
 */
export class ZoomControl extends Control {
    /**
     * Create a new ZoomControl.
     *
     * @param {Object} [options] - Zoom control options
     */
    constructor(options = {}) {
        super(merge_options(DEFAULT_OPTIONS, options));

        this._zoom_in_btn = null;
        this._zoom_out_btn = null;
    }

    /**
     * Called when control is added to a map.
     *
     * @param {Osman} map - The map instance
     * @returns {HTMLElement} The control container element
     */
    on_add(map) {
        const container = super.on_add(map);
        container.classList.add('um-zoom-control');

        // Create zoom in button
        this._zoom_in_btn = this._create_button(
            this._options.zoom_in_text,
            this._options.zoom_in_title,
            () => this._zoom_in()
        );
        this._zoom_in_btn.className = 'um-zoom-btn um-zoom-in';
        container.appendChild(this._zoom_in_btn);

        // Create zoom out button
        this._zoom_out_btn = this._create_button(
            this._options.zoom_out_text,
            this._options.zoom_out_title,
            () => this._zoom_out()
        );
        this._zoom_out_btn.className = 'um-zoom-btn um-zoom-out';
        container.appendChild(this._zoom_out_btn);

        // Prevent click propagation to map
        this._disable_click_propagation(container);

        // Listen for zoom changes to update button states
        map.on('map:zoom', this._update_button_state.bind(this));
        this._update_button_state();

        return container;
    }

    /**
     * Called when control is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        map.off('map:zoom', this._update_button_state.bind(this));

        this._zoom_in_btn = null;
        this._zoom_out_btn = null;

        super.on_remove(map);
    }

    /**
     * Zoom in.
     * @private
     */
    _zoom_in() {
        if (!this._map) return;

        this._map.zoom_in(this._options.zoom_delta);
        this.emit('control:zoom_in');
    }

    /**
     * Zoom out.
     * @private
     */
    _zoom_out() {
        if (!this._map) return;

        this._map.zoom_out(this._options.zoom_delta);
        this.emit('control:zoom_out');
    }

    /**
     * Update button disabled states based on current zoom.
     * @private
     */
    _update_button_state() {
        if (!this._map) return;

        const zoom = this._map.get_zoom();
        const viewport = this._map._viewport;

        // Disable zoom in at max zoom
        if (this._zoom_in_btn) {
            this._zoom_in_btn.disabled = zoom >= viewport.get_max_zoom();
        }

        // Disable zoom out at min zoom
        if (this._zoom_out_btn) {
            this._zoom_out_btn.disabled = zoom <= viewport.get_min_zoom();
        }
    }

    /**
     * Set zoom delta.
     *
     * @param {number} delta - Zoom delta
     * @returns {this} Returns this for chaining
     */
    set_zoom_delta(delta) {
        this._options.zoom_delta = delta;
        return this;
    }
}
