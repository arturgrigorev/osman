/**
 * ColorScale - Color scale utilities for data visualization
 *
 * Provides sequential, diverging, and categorical color scales
 * for mapping data values to colors.
 *
 * @example
 * const scale = ColorScale.sequential('viridis');
 * const color = scale.get_color(0.5);  // '#21918c'
 *
 * const data_scale = ColorScale.from_data(values, 'viridis');
 * const color = data_scale.get_color(value);
 */

/**
 * Built-in sequential color schemes.
 */
const SEQUENTIAL_SCHEMES = {
    viridis: ['#440154', '#482878', '#3e4a89', '#31688e', '#26838f', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
    plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'],
    inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'],
    magma: ['#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'],
    blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
    reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
    oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
    purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
    greys: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'],
    ylgnbu: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'],
    ylorbr: ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506'],
    ylorrd: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026']
};

/**
 * Built-in diverging color schemes.
 */
const DIVERGING_SCHEMES = {
    rdbu: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'],
    rdylbu: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'],
    rdylgn: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'],
    spectral: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
    brbg: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'],
    prgn: ['#40004b', '#762a83', '#9970ab', '#c2a5cf', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837', '#00441b'],
    piyg: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419']
};

/**
 * Built-in categorical color schemes.
 */
const CATEGORICAL_SCHEMES = {
    category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
    paired: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'],
    set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
    set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
    set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f'],
    tableau10: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab']
};

/**
 * Interpolate between two colors.
 *
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated color (hex)
 */
function interpolate_color(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * ColorScale class for mapping values to colors.
 */
export class ColorScale {
    /**
     * Create a new ColorScale.
     *
     * @param {Array<string>} colors - Array of color values
     * @param {Object} [options] - Scale options
     * @param {number} [options.min=0] - Minimum value
     * @param {number} [options.max=1] - Maximum value
     * @param {boolean} [options.reverse=false] - Reverse the scale
     */
    constructor(colors, options = {}) {
        this._colors = [...colors];
        this._min = options.min ?? 0;
        this._max = options.max ?? 1;

        if (options.reverse) {
            this._colors.reverse();
        }
    }

    /**
     * Get color for a value.
     *
     * @param {number} value - Value to map
     * @returns {string} Color (hex)
     */
    get_color(value) {
        // Normalize value to 0-1 range
        let t = (value - this._min) / (this._max - this._min);
        t = Math.max(0, Math.min(1, t));

        // Find colors to interpolate between
        const n = this._colors.length - 1;
        const i = Math.min(Math.floor(t * n), n - 1);
        const local_t = (t * n) - i;

        return interpolate_color(this._colors[i], this._colors[i + 1], local_t);
    }

    /**
     * Get color at a specific index (no interpolation).
     *
     * @param {number} index - Color index
     * @returns {string} Color (hex)
     */
    get_color_at(index) {
        const i = Math.max(0, Math.min(this._colors.length - 1, Math.floor(index)));
        return this._colors[i];
    }

    /**
     * Get all colors.
     *
     * @returns {Array<string>} Array of colors
     */
    get_colors() {
        return [...this._colors];
    }

    /**
     * Get domain (min/max).
     *
     * @returns {Array<number>} [min, max]
     */
    get_domain() {
        return [this._min, this._max];
    }

    /**
     * Set domain.
     *
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {this} Returns this for chaining
     */
    set_domain(min, max) {
        this._min = min;
        this._max = max;
        return this;
    }

    /**
     * Create a reversed copy.
     *
     * @returns {ColorScale} Reversed color scale
     */
    reverse() {
        return new ColorScale([...this._colors].reverse(), {
            min: this._min,
            max: this._max
        });
    }

    /**
     * Sample N colors from the scale.
     *
     * @param {number} n - Number of colors
     * @returns {Array<string>} Array of colors
     */
    sample(n) {
        const colors = [];
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0.5 : i / (n - 1);
            colors.push(this.get_color(this._min + t * (this._max - this._min)));
        }
        return colors;
    }

    // ==================== Static Factory Methods ====================

    /**
     * Create a sequential color scale.
     *
     * @param {string|Array<string>} scheme - Scheme name or color array
     * @param {Object} [options] - Scale options
     * @returns {ColorScale} Color scale
     */
    static sequential(scheme, options = {}) {
        const colors = Array.isArray(scheme)
            ? scheme
            : SEQUENTIAL_SCHEMES[scheme] || SEQUENTIAL_SCHEMES.viridis;

        return new ColorScale(colors, options);
    }

    /**
     * Create a diverging color scale.
     *
     * @param {string|Array<string>} scheme - Scheme name or color array
     * @param {Object} [options] - Scale options
     * @returns {ColorScale} Color scale
     */
    static diverging(scheme, options = {}) {
        const colors = Array.isArray(scheme)
            ? scheme
            : DIVERGING_SCHEMES[scheme] || DIVERGING_SCHEMES.rdbu;

        return new ColorScale(colors, options);
    }

    /**
     * Create a categorical color scale.
     *
     * @param {string|Array<string>} scheme - Scheme name or color array
     * @returns {CategoricalScale} Categorical scale
     */
    static categorical(scheme) {
        const colors = Array.isArray(scheme)
            ? scheme
            : CATEGORICAL_SCHEMES[scheme] || CATEGORICAL_SCHEMES.category10;

        return new CategoricalScale(colors);
    }

    /**
     * Create a color scale from data values.
     *
     * @param {Array<number>} values - Data values
     * @param {string|Array<string>} scheme - Color scheme
     * @param {Object} [options] - Scale options
     * @returns {ColorScale} Color scale with domain from data
     */
    static from_data(values, scheme, options = {}) {
        const min = Math.min(...values);
        const max = Math.max(...values);

        return ColorScale.sequential(scheme, { ...options, min, max });
    }

    /**
     * Get available sequential schemes.
     *
     * @returns {Array<string>} Scheme names
     */
    static get_sequential_schemes() {
        return Object.keys(SEQUENTIAL_SCHEMES);
    }

    /**
     * Get available diverging schemes.
     *
     * @returns {Array<string>} Scheme names
     */
    static get_diverging_schemes() {
        return Object.keys(DIVERGING_SCHEMES);
    }

    /**
     * Get available categorical schemes.
     *
     * @returns {Array<string>} Scheme names
     */
    static get_categorical_schemes() {
        return Object.keys(CATEGORICAL_SCHEMES);
    }
}

/**
 * CategoricalScale - Color scale for discrete categories.
 */
export class CategoricalScale {
    /**
     * Create a new CategoricalScale.
     *
     * @param {Array<string>} colors - Array of colors
     */
    constructor(colors) {
        this._colors = [...colors];
        this._mapping = new Map();
        this._next_index = 0;
    }

    /**
     * Get color for a category.
     *
     * @param {*} category - Category value
     * @returns {string} Color (hex)
     */
    get_color(category) {
        if (!this._mapping.has(category)) {
            this._mapping.set(category, this._next_index);
            this._next_index = (this._next_index + 1) % this._colors.length;
        }

        const index = this._mapping.get(category);
        return this._colors[index];
    }

    /**
     * Set specific mapping.
     *
     * @param {*} category - Category value
     * @param {string} color - Color to use
     * @returns {this} Returns this for chaining
     */
    set_color(category, color) {
        // Find or add color to array
        let index = this._colors.indexOf(color);
        if (index === -1) {
            index = this._colors.length;
            this._colors.push(color);
        }
        this._mapping.set(category, index);
        return this;
    }

    /**
     * Get all colors.
     *
     * @returns {Array<string>} Array of colors
     */
    get_colors() {
        return [...this._colors];
    }

    /**
     * Get current mapping.
     *
     * @returns {Map} Category to index mapping
     */
    get_mapping() {
        return new Map(this._mapping);
    }

    /**
     * Reset mapping.
     *
     * @returns {this} Returns this for chaining
     */
    reset() {
        this._mapping.clear();
        this._next_index = 0;
        return this;
    }
}
