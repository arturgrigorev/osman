/**
 * Timeline - Timeline control for presentation navigation
 *
 * Visual timeline control for navigating and controlling
 * presentation playback with keyframe markers.
 *
 * @example
 * const timeline = new Timeline({
 *     position: 'bottom_center'
 * });
 * timeline.add_to(map);
 * timeline.bind_player(player);
 */

import { Control, ControlPosition } from '../control/control.js';

/**
 * Default timeline options.
 */
const DEFAULT_OPTIONS = {
    position: ControlPosition.BOTTOM_LEFT,
    width: 400,
    show_time: true,
    show_progress: true,
    show_keyframe_markers: true,
    collapsed: false
};

/**
 * Timeline control class.
 */
export class Timeline extends Control {
    /**
     * Create a new Timeline control.
     *
     * @param {Object} [options] - Control options
     */
    constructor(options = {}) {
        super({ ...DEFAULT_OPTIONS, ...options });

        this._player = null;
        this._dragging = false;
        this._elements = {};
    }

    /**
     * Bind to a player instance.
     *
     * @param {Player} player - Player to bind
     * @returns {this} Returns this for chaining
     */
    bind_player(player) {
        this._unbind_player();

        this._player = player;

        // Bind player events
        this._on_keyframe = this._on_keyframe.bind(this);
        this._on_play = this._on_play.bind(this);
        this._on_pause = this._on_pause.bind(this);
        this._on_stop = this._on_stop.bind(this);
        this._on_load = this._on_load.bind(this);

        player.on('player:keyframe', this._on_keyframe);
        player.on('player:play', this._on_play);
        player.on('player:pause', this._on_pause);
        player.on('player:stop', this._on_stop);
        player.on('player:load', this._on_load);

        this._update_markers();
        this._update_state();

        return this;
    }

    /**
     * Unbind current player.
     *
     * @returns {this} Returns this for chaining
     */
    _unbind_player() {
        if (this._player) {
            this._player.off('player:keyframe', this._on_keyframe);
            this._player.off('player:play', this._on_play);
            this._player.off('player:pause', this._on_pause);
            this._player.off('player:stop', this._on_stop);
            this._player.off('player:load', this._on_load);
        }

        this._player = null;
        return this;
    }

    /**
     * Create control container.
     * @private
     */
    _create_container() {
        const container = document.createElement('div');
        container.className = 'urban-timeline';
        container.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
            padding: 10px 15px;
            width: ${this._options.width}px;
            user-select: none;
        `;

        // Create elements
        this._create_header(container);
        this._create_progress_bar(container);
        this._create_controls(container);

        return container;
    }

    /**
     * Create header section.
     * @private
     */
    _create_header(container) {
        const header = document.createElement('div');
        header.className = 'urban-timeline-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
            color: #666;
        `;

        // Title
        this._elements.title = document.createElement('span');
        this._elements.title.textContent = 'Presentation';
        header.appendChild(this._elements.title);

        // Time display
        if (this._options.show_time) {
            this._elements.time = document.createElement('span');
            this._elements.time.textContent = '0:00 / 0:00';
            header.appendChild(this._elements.time);
        }

        container.appendChild(header);
    }

    /**
     * Create progress bar.
     * @private
     */
    _create_progress_bar(container) {
        const bar_container = document.createElement('div');
        bar_container.className = 'urban-timeline-bar';
        bar_container.style.cssText = `
            position: relative;
            height: 24px;
            background: #e0e0e0;
            border-radius: 4px;
            margin-bottom: 10px;
            cursor: pointer;
        `;

        // Progress fill
        this._elements.progress = document.createElement('div');
        this._elements.progress.className = 'urban-timeline-progress';
        this._elements.progress.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: #3498db;
            border-radius: 4px;
            width: 0%;
            transition: width 0.1s ease;
        `;
        bar_container.appendChild(this._elements.progress);

        // Keyframe markers container
        this._elements.markers = document.createElement('div');
        this._elements.markers.className = 'urban-timeline-markers';
        this._elements.markers.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        `;
        bar_container.appendChild(this._elements.markers);

        // Playhead
        this._elements.playhead = document.createElement('div');
        this._elements.playhead.className = 'urban-timeline-playhead';
        this._elements.playhead.style.cssText = `
            position: absolute;
            top: -2px;
            width: 8px;
            height: 28px;
            background: #2980b9;
            border-radius: 4px;
            transform: translateX(-50%);
            left: 0%;
            cursor: grab;
        `;
        bar_container.appendChild(this._elements.playhead);

        // Click handler
        bar_container.addEventListener('click', (e) => this._on_bar_click(e));

        // Drag handlers
        this._elements.playhead.addEventListener('mousedown', (e) => this._on_drag_start(e));
        document.addEventListener('mousemove', (e) => this._on_drag_move(e));
        document.addEventListener('mouseup', () => this._on_drag_end());

        container.appendChild(bar_container);
        this._elements.bar = bar_container;
    }

    /**
     * Create playback controls.
     * @private
     */
    _create_controls(container) {
        const controls = document.createElement('div');
        controls.className = 'urban-timeline-controls';
        controls.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        `;

        // Previous button
        this._elements.prev = this._create_button('⏮', 'Previous', () => {
            this._player?.previous();
        });
        controls.appendChild(this._elements.prev);

        // Play/Pause button
        this._elements.play = this._create_button('▶', 'Play', () => {
            if (!this._player) return;

            const state = this._player.get_state();
            if (state === 'playing') {
                this._player.pause();
            } else if (state === 'paused') {
                this._player.resume();
            } else {
                this._player.play();
            }
        });
        this._elements.play.style.width = '40px';
        this._elements.play.style.height = '40px';
        this._elements.play.style.fontSize = '18px';
        controls.appendChild(this._elements.play);

        // Stop button
        this._elements.stop = this._create_button('⏹', 'Stop', () => {
            this._player?.stop();
        });
        controls.appendChild(this._elements.stop);

        // Next button
        this._elements.next = this._create_button('⏭', 'Next', () => {
            this._player?.next();
        });
        controls.appendChild(this._elements.next);

        // Speed control
        const speed_container = document.createElement('div');
        speed_container.style.cssText = `
            margin-left: 15px;
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            color: #666;
        `;

        const speed_label = document.createElement('span');
        speed_label.textContent = 'Speed:';
        speed_container.appendChild(speed_label);

        this._elements.speed = document.createElement('select');
        this._elements.speed.style.cssText = `
            padding: 2px 5px;
            border: 1px solid #ccc;
            border-radius: 3px;
            font-size: 11px;
        `;

        [0.5, 0.75, 1, 1.25, 1.5, 2].forEach(rate => {
            const option = document.createElement('option');
            option.value = rate;
            option.textContent = rate + 'x';
            option.selected = rate === 1;
            this._elements.speed.appendChild(option);
        });

        this._elements.speed.addEventListener('change', () => {
            this._player?.set_playback_rate(parseFloat(this._elements.speed.value));
        });

        speed_container.appendChild(this._elements.speed);
        controls.appendChild(speed_container);

        container.appendChild(controls);
    }

    /**
     * Create a control button.
     * @private
     */
    _create_button(icon, title, handler) {
        const button = document.createElement('button');
        button.className = 'urban-timeline-button';
        button.textContent = icon;
        button.title = title;
        button.style.cssText = `
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 50%;
            background: #f0f0f0;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.background = '#e0e0e0';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = '#f0f0f0';
        });

        button.addEventListener('click', handler);

        return button;
    }

    /**
     * Handle bar click.
     * @private
     */
    _on_bar_click(e) {
        if (!this._player || this._dragging) return;

        const rect = this._elements.bar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = x / rect.width;

        const index = Math.floor(progress * this._player.get_keyframe_count());
        this._player.go_to(index);
    }

    /**
     * Handle drag start.
     * @private
     */
    _on_drag_start(e) {
        if (!this._player) return;

        this._dragging = true;
        this._elements.playhead.style.cursor = 'grabbing';
        e.preventDefault();
    }

    /**
     * Handle drag move.
     * @private
     */
    _on_drag_move(e) {
        if (!this._dragging || !this._player) return;

        const rect = this._elements.bar.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));

        const progress = x / rect.width;
        this._elements.playhead.style.left = (progress * 100) + '%';

        const index = Math.floor(progress * this._player.get_keyframe_count());
        if (index !== this._player.get_current_index()) {
            this._player.go_to(index, false);
        }
    }

    /**
     * Handle drag end.
     * @private
     */
    _on_drag_end() {
        if (!this._dragging) return;

        this._dragging = false;
        this._elements.playhead.style.cursor = 'grab';
    }

    /**
     * Handle keyframe event.
     * @private
     */
    _on_keyframe(e) {
        this._update_progress(e.progress);
        this._update_time();
    }

    /**
     * Handle play event.
     * @private
     */
    _on_play() {
        this._elements.play.textContent = '⏸';
        this._elements.play.title = 'Pause';
    }

    /**
     * Handle pause event.
     * @private
     */
    _on_pause() {
        this._elements.play.textContent = '▶';
        this._elements.play.title = 'Play';
    }

    /**
     * Handle stop event.
     * @private
     */
    _on_stop() {
        this._elements.play.textContent = '▶';
        this._elements.play.title = 'Play';
        this._update_progress(0);
    }

    /**
     * Handle load event.
     * @private
     */
    _on_load(e) {
        this._elements.title.textContent = e.metadata?.title || 'Presentation';
        this._update_markers();
        this._update_progress(0);
        this._update_time();
    }

    /**
     * Update state from player.
     * @private
     */
    _update_state() {
        if (!this._player) return;

        const state = this._player.get_state();
        if (state === 'playing') {
            this._on_play();
        } else {
            this._on_pause();
        }

        this._update_progress(this._player.get_progress());
        this._update_time();
    }

    /**
     * Update progress display.
     * @private
     */
    _update_progress(progress) {
        const percent = (progress * 100) + '%';
        this._elements.progress.style.width = percent;
        this._elements.playhead.style.left = percent;
    }

    /**
     * Update time display.
     * @private
     */
    _update_time() {
        if (!this._elements.time || !this._player) return;

        const current = this._player.get_current_index() + 1;
        const total = this._player.get_keyframe_count();

        this._elements.time.textContent = `${current} / ${total}`;
    }

    /**
     * Update keyframe markers.
     * @private
     */
    _update_markers() {
        if (!this._elements.markers || !this._player) return;

        // Clear existing markers
        this._elements.markers.innerHTML = '';

        const count = this._player.get_keyframe_count();
        if (count === 0 || !this._options.show_keyframe_markers) return;

        for (let i = 0; i < count; i++) {
            const position = ((i + 0.5) / count) * 100;

            const marker = document.createElement('div');
            marker.className = 'urban-timeline-marker';
            marker.style.cssText = `
                position: absolute;
                left: ${position}%;
                top: 50%;
                transform: translate(-50%, -50%);
                width: 6px;
                height: 6px;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 50%;
                pointer-events: none;
            `;

            this._elements.markers.appendChild(marker);
        }
    }

    /**
     * Remove control.
     */
    remove() {
        this._unbind_player();
        super.remove();
    }
}
