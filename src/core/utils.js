/**
 * Utility functions for Osman
 *
 * Common utilities used across the codebase.
 */

/**
 * Generate a unique ID string.
 *
 * @param {string} [prefix='um'] - Prefix for the ID
 * @returns {string} Unique ID string
 */
export function uid(prefix = 'um') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Clamp a number between min and max values.
 *
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values.
 *
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Check if a value is a number (not NaN or Infinity).
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a finite number
 */
export function is_number(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Check if a value is a non-null object.
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is an object
 */
export function is_object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a value is an array.
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is an array
 */
export function is_array(value) {
    return Array.isArray(value);
}

/**
 * Check if a value is a function.
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a function
 */
export function is_function(value) {
    return typeof value === 'function';
}

/**
 * Check if a value is a string.
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a string
 */
export function is_string(value) {
    return typeof value === 'string';
}

/**
 * Deep clone an object or array.
 *
 * @param {*} value - Value to clone
 * @returns {*} Cloned value
 */
export function deep_clone(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => deep_clone(item));
    }

    const cloned = {};
    for (const key of Object.keys(value)) {
        cloned[key] = deep_clone(value[key]);
    }
    return cloned;
}

/**
 * Deep merge objects. Later objects override earlier ones.
 *
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
export function deep_merge(...objects) {
    const result = {};

    for (const obj of objects) {
        if (!is_object(obj)) continue;

        for (const key of Object.keys(obj)) {
            const value = obj[key];

            if (is_object(value) && is_object(result[key])) {
                result[key] = deep_merge(result[key], value);
            } else {
                result[key] = deep_clone(value);
            }
        }
    }

    return result;
}

/**
 * Debounce a function call.
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
    let timeout_id = null;

    const debounced = function (...args) {
        if (timeout_id !== null) {
            clearTimeout(timeout_id);
        }

        timeout_id = setTimeout(() => {
            timeout_id = null;
            fn.apply(this, args);
        }, delay);
    };

    debounced.cancel = function () {
        if (timeout_id !== null) {
            clearTimeout(timeout_id);
            timeout_id = null;
        }
    };

    return debounced;
}

/**
 * Throttle a function call.
 *
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
    let last_call = 0;
    let timeout_id = null;

    const throttled = function (...args) {
        const now = Date.now();
        const remaining = limit - (now - last_call);

        if (remaining <= 0) {
            if (timeout_id !== null) {
                clearTimeout(timeout_id);
                timeout_id = null;
            }
            last_call = now;
            fn.apply(this, args);
        } else if (timeout_id === null) {
            timeout_id = setTimeout(() => {
                timeout_id = null;
                last_call = Date.now();
                fn.apply(this, args);
            }, remaining);
        }
    };

    throttled.cancel = function () {
        if (timeout_id !== null) {
            clearTimeout(timeout_id);
            timeout_id = null;
        }
    };

    return throttled;
}

/**
 * Request animation frame with fallback.
 *
 * @param {Function} callback - Function to call
 * @returns {number} Request ID
 */
export function request_frame(callback) {
    return requestAnimationFrame(callback);
}

/**
 * Cancel animation frame request.
 *
 * @param {number} id - Request ID to cancel
 */
export function cancel_frame(id) {
    cancelAnimationFrame(id);
}

/**
 * Convert degrees to radians.
 *
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function to_radians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 *
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function to_degrees(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Wrap a number to stay within a range.
 *
 * @param {number} value - Value to wrap
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Wrapped value
 */
export function wrap(value, min, max) {
    const range = max - min;
    return ((((value - min) % range) + range) % range) + min;
}

/**
 * Format a number with specified decimal places.
 *
 * @param {number} value - Value to format
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted number string
 */
export function format_number(value, decimals = 2) {
    return value.toFixed(decimals);
}

/**
 * Create a promise that resolves after a delay.
 *
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after delay
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if code is running in a browser environment.
 *
 * @returns {boolean} True if running in browser
 */
export function is_browser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Get device pixel ratio.
 *
 * @returns {number} Device pixel ratio
 */
export function get_pixel_ratio() {
    return is_browser() ? (window.devicePixelRatio || 1) : 1;
}
