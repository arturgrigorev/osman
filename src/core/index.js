/**
 * Core module exports
 *
 * Re-exports all core components for convenient importing.
 */

export { EventEmitter } from './event_emitter.js';

export {
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
    get_pixel_ratio
} from './utils.js';

export {
    merge_options,
    StyleBuilder,
    DEFAULT_STYLES,
    validate_options,
    create_options
} from './options.js';

export {
    PluginManager,
    PluginType,
    Plugin
} from './plugin_manager.js';
