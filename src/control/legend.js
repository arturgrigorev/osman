/**
 * Legend - Interactive layer legend control
 *
 * Displays layer information with toggles for visibility control.
 *
 * @example
 * const legend = new Legend({
 *     position: 'bottom_right',
 *     layers: [
 *         { layer: buildings, name: 'Buildings', toggle: true },
 *         { layer: roads, name: 'Roads', toggle: true }
 *     ]
 * });
 * legend.add_to(map);
 */

import { Control, ControlPosition } from './control.js';
import { merge_options } from '../core/options.js';

/**
 * Default legend options.
 */
const DEFAULT_OPTIONS = {
    position: ControlPosition.BOTTOM_RIGHT,
    title: null,
    collapsed: false,
    layers: [],
    auto_z_index: true,
    sort_layers: false
};

/**
 * Legend class for layer control.
 */
export class Legend extends Control {
    /**
     * Create a new Legend.
     *
     * @param {Object} [options] - Legend options
     * @param {string} [options.title] - Legend title
     * @param {Array} [options.layers] - Layer entries
     * @param {boolean} [options.collapsed=false] - Start collapsed
     */
    constructor(options = {}) {
        super(merge_options(DEFAULT_OPTIONS, options));

        this._layers = new Map();
        this._content = null;

        // Add initial layers
        for (const entry of this._options.layers) {
            this.add_layer(entry.layer, entry.name, entry);
        }
    }

    /**
     * Called when control is added to a map.
     *
     * @param {Osman} map - The map instance
     * @returns {HTMLElement} The control container element
     */
    on_add(map) {
        const container = super.on_add(map);
        container.classList.add('um-legend');

        // Title
        if (this._options.title) {
            const title = document.createElement('div');
            title.className = 'um-legend-title';
            title.textContent = this._options.title;
            container.appendChild(title);
        }

        // Content
        this._content = document.createElement('div');
        this._content.className = 'um-legend-content';
        container.appendChild(this._content);

        // Render layers
        this._render_layers();

        // Prevent click propagation
        this._disable_click_propagation(container);

        // Collapsed state
        if (this._options.collapsed) {
            this.collapse();
        }

        return container;
    }

    /**
     * Called when control is removed from a map.
     *
     * @param {Osman} map - The map instance
     */
    on_remove(map) {
        this._content = null;
        super.on_remove(map);
    }

    // ==================== Layer Management ====================

    /**
     * Add a layer to the legend.
     *
     * @param {Layer} layer - Layer to add
     * @param {string} name - Display name
     * @param {Object} [options] - Entry options
     * @param {boolean} [options.toggle=true] - Show toggle checkbox
     * @param {string} [options.color] - Color swatch
     * @returns {this} Returns this for chaining
     */
    add_layer(layer, name, options = {}) {
        const entry = {
            layer,
            name,
            toggle: options.toggle !== false,
            color: options.color || null,
            visible: layer.is_visible ? layer.is_visible() : true
        };

        this._layers.set(layer, entry);
        this._render_layers();

        return this;
    }

    /**
     * Remove a layer from the legend.
     *
     * @param {Layer} layer - Layer to remove
     * @returns {this} Returns this for chaining
     */
    remove_layer(layer) {
        this._layers.delete(layer);
        this._render_layers();
        return this;
    }

    /**
     * Get all layers in the legend.
     *
     * @returns {Array<Layer>} Array of layers
     */
    get_layers() {
        return Array.from(this._layers.keys());
    }

    // ==================== Rendering ====================

    /**
     * Render all layer entries.
     * @private
     */
    _render_layers() {
        if (!this._content) return;

        this._content.innerHTML = '';

        const entries = Array.from(this._layers.values());

        if (this._options.sort_layers) {
            entries.sort((a, b) => a.name.localeCompare(b.name));
        }

        for (const entry of entries) {
            const item = this._create_layer_item(entry);
            this._content.appendChild(item);
        }
    }

    /**
     * Create a layer item element.
     *
     * @param {Object} entry - Layer entry
     * @returns {HTMLElement} Layer item element
     * @private
     */
    _create_layer_item(entry) {
        const item = document.createElement('div');
        item.className = 'um-legend-item';

        // Toggle checkbox
        if (entry.toggle) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'um-legend-checkbox';
            checkbox.checked = entry.visible;

            checkbox.addEventListener('change', () => {
                entry.visible = checkbox.checked;
                if (entry.layer.set_visible) {
                    entry.layer.set_visible(checkbox.checked);
                }
                this.emit('legend:toggle', { layer: entry.layer, visible: checkbox.checked });
            });

            item.appendChild(checkbox);
        }

        // Color swatch
        if (entry.color) {
            const swatch = document.createElement('span');
            swatch.className = 'um-legend-swatch';
            swatch.style.backgroundColor = entry.color;
            item.appendChild(swatch);
        }

        // Label
        const label = document.createElement('span');
        label.className = 'um-legend-label';
        label.textContent = entry.name;
        item.appendChild(label);

        // Click on label toggles if toggle is enabled
        if (entry.toggle) {
            label.style.cursor = 'pointer';
            label.addEventListener('click', () => {
                const checkbox = item.querySelector('.um-legend-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        }

        return item;
    }

    // ==================== Collapse/Expand ====================

    /**
     * Collapse the legend.
     *
     * @returns {this} Returns this for chaining
     */
    collapse() {
        if (this._content) {
            this._content.style.display = 'none';
        }
        if (this._container) {
            this._container.classList.add('um-collapsed');
        }
        return this;
    }

    /**
     * Expand the legend.
     *
     * @returns {this} Returns this for chaining
     */
    expand() {
        if (this._content) {
            this._content.style.display = '';
        }
        if (this._container) {
            this._container.classList.remove('um-collapsed');
        }
        return this;
    }

    /**
     * Toggle collapsed state.
     *
     * @returns {this} Returns this for chaining
     */
    toggle_collapse() {
        if (this._container?.classList.contains('um-collapsed')) {
            return this.expand();
        }
        return this.collapse();
    }

    /**
     * Check if legend is collapsed.
     *
     * @returns {boolean} True if collapsed
     */
    is_collapsed() {
        return this._container?.classList.contains('um-collapsed') || false;
    }

    // ==================== Utilities ====================

    /**
     * Update layer visibility state.
     *
     * @param {Layer} layer - Layer to update
     * @param {boolean} visible - New visibility
     */
    update_layer_visibility(layer, visible) {
        const entry = this._layers.get(layer);
        if (entry) {
            entry.visible = visible;
            this._render_layers();
        }
    }

    /**
     * Set title.
     *
     * @param {string} title - New title
     * @returns {this} Returns this for chaining
     */
    set_title(title) {
        this._options.title = title;

        if (this._container) {
            let title_el = this._container.querySelector('.um-legend-title');
            if (title) {
                if (!title_el) {
                    title_el = document.createElement('div');
                    title_el.className = 'um-legend-title';
                    this._container.insertBefore(title_el, this._content);
                }
                title_el.textContent = title;
            } else if (title_el) {
                title_el.remove();
            }
        }

        return this;
    }
}
