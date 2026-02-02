/**
 * EventEmitter - Simple pub/sub event system
 *
 * Provides consistent event handling across all Osman components.
 * Events use the pattern: `category:action` (e.g., 'layer:add', 'map:click')
 *
 * @example
 * class MyClass extends EventEmitter {
 *     do_something() {
 *         this.emit('my:event', { data: 123 });
 *     }
 * }
 *
 * const obj = new MyClass();
 * obj.on('my:event', (e) => console.log(e.data));
 */
export class EventEmitter {
    constructor() {
        this._listeners = new Map();
        this._once_listeners = new Map();
    }

    /**
     * Subscribe to an event.
     *
     * @param {string} event - Event name (e.g., 'layer:add')
     * @param {Function} handler - Callback function
     * @param {Object} [context] - Context for callback (this value)
     * @returns {this} Returns this for chaining
     * @example
     * map.on('map:click', (e) => console.log(e.latlng));
     */
    on(event, handler, context = null) {
        if (typeof handler !== 'function') {
            throw new TypeError('Handler must be a function');
        }

        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }

        this._listeners.get(event).push({ handler, context });
        return this;
    }

    /**
     * Subscribe to an event, but only fire once.
     *
     * @param {string} event - Event name
     * @param {Function} handler - Callback function
     * @param {Object} [context] - Context for callback
     * @returns {this} Returns this for chaining
     * @example
     * map.once('map:ready', () => console.log('Map is ready!'));
     */
    once(event, handler, context = null) {
        if (typeof handler !== 'function') {
            throw new TypeError('Handler must be a function');
        }

        if (!this._once_listeners.has(event)) {
            this._once_listeners.set(event, []);
        }

        this._once_listeners.get(event).push({ handler, context });
        return this;
    }

    /**
     * Unsubscribe from an event.
     *
     * @param {string} event - Event name
     * @param {Function} [handler] - Specific handler to remove (removes all if omitted)
     * @returns {this} Returns this for chaining
     * @example
     * map.off('map:click', myHandler);
     * map.off('map:click'); // Remove all handlers
     */
    off(event, handler = null) {
        if (handler === null) {
            // Remove all handlers for this event
            this._listeners.delete(event);
            this._once_listeners.delete(event);
        } else {
            // Remove specific handler
            if (this._listeners.has(event)) {
                const listeners = this._listeners.get(event);
                const filtered = listeners.filter(l => l.handler !== handler);
                if (filtered.length > 0) {
                    this._listeners.set(event, filtered);
                } else {
                    this._listeners.delete(event);
                }
            }

            if (this._once_listeners.has(event)) {
                const listeners = this._once_listeners.get(event);
                const filtered = listeners.filter(l => l.handler !== handler);
                if (filtered.length > 0) {
                    this._once_listeners.set(event, filtered);
                } else {
                    this._once_listeners.delete(event);
                }
            }
        }

        return this;
    }

    /**
     * Emit an event to all subscribers.
     *
     * @param {string} event - Event name
     * @param {Object} [data] - Event data to pass to handlers
     * @returns {this} Returns this for chaining
     * @fires event
     */
    emit(event, data = {}) {
        const event_obj = {
            type: event,
            target: this,
            timestamp: Date.now(),
            ...data
        };

        // Fire regular listeners
        if (this._listeners.has(event)) {
            const listeners = this._listeners.get(event);
            for (const { handler, context } of listeners) {
                try {
                    handler.call(context, event_obj);
                } catch (error) {
                    console.error(`Error in event handler for '${event}':`, error);
                }
            }
        }

        // Fire once listeners and remove them
        if (this._once_listeners.has(event)) {
            const listeners = this._once_listeners.get(event);
            this._once_listeners.delete(event);

            for (const { handler, context } of listeners) {
                try {
                    handler.call(context, event_obj);
                } catch (error) {
                    console.error(`Error in once handler for '${event}':`, error);
                }
            }
        }

        return this;
    }

    /**
     * Check if event has any listeners.
     *
     * @param {string} event - Event name
     * @returns {boolean} True if event has listeners
     */
    has_listeners(event) {
        return (
            (this._listeners.has(event) && this._listeners.get(event).length > 0) ||
            (this._once_listeners.has(event) && this._once_listeners.get(event).length > 0)
        );
    }

    /**
     * Get count of listeners for an event.
     *
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    get_listener_count(event) {
        let count = 0;
        if (this._listeners.has(event)) {
            count += this._listeners.get(event).length;
        }
        if (this._once_listeners.has(event)) {
            count += this._once_listeners.get(event).length;
        }
        return count;
    }

    /**
     * Remove all event listeners.
     *
     * @returns {this} Returns this for chaining
     */
    off_all() {
        this._listeners.clear();
        this._once_listeners.clear();
        return this;
    }
}
