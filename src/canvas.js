// src/canvas.js — Canvas setup, responsive sizing, retina scaling, lane bounds.
// All other modules read canvas dimensions through the getters here.

import { CANVAS, LAYOUT } from './config.js';

let _canvas = null;
let _ctx    = null;
let _logicalW = 0;
let _logicalH = 0;
let _dpr      = 1;

// Registered callbacks fired after every resize.
const _resizeListeners = [];

let _resizeTimer = null;

// ── Init ─────────────────────────────────────────────────────────────────────

export function initCanvas() {
    _canvas = document.getElementById('game-canvas');
    _ctx    = _canvas.getContext('2d');
    _ctx.imageSmoothingEnabled = false;

    _applySize();

    window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(_applySize, 150);
    });

    return { canvas: _canvas, ctx: _ctx };
}

function _applySize() {
    _dpr = window.devicePixelRatio || 1;

    _logicalW = Math.max(
        CANVAS.MIN_WIDTH,
        Math.min(CANVAS.MAX_WIDTH, window.innerWidth - CANVAS.MARGIN)
    );
    _logicalH = Math.max(
        CANVAS.MIN_HEIGHT,
        Math.min(CANVAS.MAX_HEIGHT, window.innerHeight * CANVAS.HEIGHT_RATIO)
    );

    // Physical pixel resolution (retina)
    _canvas.width  = Math.floor(_logicalW * _dpr);
    _canvas.height = Math.floor(_logicalH * _dpr);

    // CSS size stays at logical pixels so layout doesn't shift
    _canvas.style.width  = _logicalW + 'px';
    _canvas.style.height = _logicalH + 'px';

    // Scale the context so all draw calls use logical coordinates
    _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
    _ctx.imageSmoothingEnabled = false;

    _resizeListeners.forEach(fn => fn(_logicalW, _logicalH));
}

// ── Getters ──────────────────────────────────────────────────────────────────

export function getCanvas() { return _canvas; }
export function getCtx()    { return _ctx; }
export function getWidth()  { return _logicalW; }
export function getHeight() { return _logicalH; }
export function getDpr()    { return _dpr; }

/** Register a callback invoked with (width, height) after every resize. */
export function onResize(fn) {
    _resizeListeners.push(fn);
}

// ── Lane Bounds (Section 8) ──────────────────────────────────────────────────
//
//   PLAYABLE_TOP    = HUD_HEIGHT + 60px
//   PLAYABLE_BOTTOM = CANVAS_HEIGHT - INPUT_AREA_HEIGHT - 80px
//   LANE_HEIGHT     = (PLAYABLE_BOTTOM - PLAYABLE_TOP) / activeLaneCount
//   lane[i].centerY = PLAYABLE_TOP + (i × LANE_HEIGHT) + (LANE_HEIGHT / 2)

export function getPlayableBounds() {
    const top    = LAYOUT.HUD_HEIGHT + LAYOUT.PLAYABLE_TOP_PADDING;
    const bottom = _logicalH - LAYOUT.INPUT_AREA_HEIGHT - LAYOUT.PLAYABLE_BOTTOM_PADDING;
    return { top, bottom };
}

/**
 * Compute lane geometry for the given active lane count.
 * Returns an array of lane objects with: index, top, bottom, centerY, height.
 */
export function computeLanes(activeLaneCount) {
    const { top, bottom } = getPlayableBounds();
    const laneHeight = (bottom - top) / activeLaneCount;
    const lanes = [];
    for (let i = 0; i < activeLaneCount; i++) {
        lanes.push({
            index:   i,
            top:     top + i * laneHeight,
            bottom:  top + (i + 1) * laneHeight,
            centerY: top + i * laneHeight + laneHeight / 2,
            height:  laneHeight,
        });
    }
    return lanes;
}

/**
 * Clamp a y-coordinate to the playable area.
 * Call every frame on entity positions to enforce bounds (Section 8).
 */
export function clampToPlayable(y) {
    const { top, bottom } = getPlayableBounds();
    return Math.max(top, Math.min(bottom, y));
}
