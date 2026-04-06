// src/renderer.js — Main render loop. Draws all visual layers back-to-front.
// All draw calls use logical pixel coordinates (DPR scaling handled in canvas.js).

import { getActiveDescription } from './patterns.js';
import { COLORS, LAYOUT, CASTLE, TIERS } from './config.js';

// ── Public Entry Point ────────────────────────────────────────────────────────

/**
 * Render one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number}  w          — logical canvas width
 * @param {number}  h          — logical canvas height
 * @param {object}  gs         — full gameState object from main.js
 * @param {object}  feedback   — { message, timer, isError } from input.js
 */
export function render(ctx, w, h, gs, feedback) {
    _background(ctx, w, h);
    _lanes(ctx, w, gs.lanes);
    _castle(ctx, h, gs.castleHealth, gs.lanes);
    gs.units.forEach(u => u.draw(ctx));
    gs.enemies.forEach(e => e.draw(ctx));
    _hud(ctx, w, h, gs);
    _patternDisplay(ctx, w, gs);
    if (feedback.timer > 0) _feedback(ctx, w, h, feedback);
    if (gs.pendingMatches.length > 0) _unitSelectOverlay(ctx, w, h, gs);
}

// ── Layer 1: Background ───────────────────────────────────────────────────────

function _background(ctx, w, h) {
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    ctx.beginPath();
    for (let x = 0; x < w; x += gridSpacing) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y < h; y += gridSpacing) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
}

// ── Layer 2: Lanes ────────────────────────────────────────────────────────────

function _lanes(ctx, w, lanes) {
    if (!lanes || lanes.length === 0) return;

    const castleX = LAYOUT.CASTLE_X_OFFSET;

    lanes.forEach((lane, i) => {
        // Alternating lane tint
        if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.fillRect(castleX, Math.round(lane.top), w - castleX, Math.round(lane.height));
        }
        // Lane separator
        if (i > 0) {
            ctx.strokeStyle = '#1e2a3a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(castleX, Math.round(lane.top) + 0.5);
            ctx.lineTo(w, Math.round(lane.top) + 0.5);
            ctx.stroke();
        }
        // Lane number
        ctx.fillStyle = '#1e3a2a';
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`L${i + 1}`, castleX + 4, Math.round(lane.centerY));
    });
}

// ── Layer 3: Castle ───────────────────────────────────────────────────────────

function _castle(ctx, h, castleHealth, lanes) {
    const cx     = LAYOUT.CASTLE_X_OFFSET;
    const top    = lanes.length > 0 ? lanes[0].top : LAYOUT.HUD_HEIGHT + LAYOUT.PLAYABLE_TOP_PADDING;
    const bottom = lanes.length > 0 ? lanes[lanes.length - 1].bottom : h - LAYOUT.INPUT_AREA_HEIGHT - LAYOUT.PLAYABLE_BOTTOM_PADDING;
    const cw     = cx;
    const ch     = bottom - top;

    // Castle body
    ctx.fillStyle = COLORS.CASTLE;
    ctx.fillRect(0, Math.round(top), cw, Math.round(ch));

    // Castle battlements (simple pixel art)
    ctx.fillStyle = '#7799dd';
    const merlonW = 8, merlonH = 10, gap = 6;
    for (let y = top; y < bottom - merlonH; y += merlonH + gap) {
        ctx.fillRect(cw - merlonW, Math.round(y), merlonW, merlonH);
    }

    // Castle label
    ctx.fillStyle = '#ddeeff';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬛', cx / 2, (top + bottom) / 2);

    // Castle health bar (below battlements, full-width)
    const hpFraction = castleHealth / CASTLE.MAX_HEALTH;
    const barY  = Math.round(bottom) + 4;
    const barW  = cx - 4;
    ctx.fillStyle = '#222';
    ctx.fillRect(2, barY, barW, 6);
    ctx.fillStyle = hpFraction > 0.5 ? '#44ff44' : hpFraction > 0.25 ? '#ffdd00' : '#ff4444';
    ctx.fillRect(2, barY, Math.round(barW * hpFraction), 6);

    // HP text
    ctx.fillStyle = hpFraction > 0.25 ? COLORS.PRIMARY_UI : COLORS.HEALTH;
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${castleHealth}`, cx / 2, barY + 14);
}

// ── Layer 8: HUD ──────────────────────────────────────────────────────────────

function _hud(ctx, w, h, gs) {
    const barH = LAYOUT.HUD_HEIGHT;

    // HUD background
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, w, barH);
    ctx.strokeStyle = COLORS.UI_SHADOW;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barH - 0.5);
    ctx.lineTo(w, barH - 0.5);
    ctx.stroke();

    const cy = barH / 2;

    // Wave
    ctx.fillStyle = COLORS.WAVE;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`WAVE ${gs.waveNumber}`, 10, cy);

    // Score
    ctx.fillStyle = COLORS.SCORE;
    ctx.textAlign = 'center';
    ctx.fillText(`${gs.score}`, w / 2, cy);

    // Combo (only show if > 1)
    if (gs.combo > 1) {
        ctx.fillStyle = COLORS.COMBO;
        ctx.fillText(`x${gs.combo}`, w / 2 + 80, cy);
    }

    // Castle HP on the right (redundant with the castle bar but useful at a glance)
    const hpFraction = gs.castleHealth / CASTLE.MAX_HEALTH;
    ctx.fillStyle = hpFraction > 0.25 ? COLORS.HEALTH : '#ff0000';
    ctx.textAlign = 'right';
    ctx.fillText(`HP ${gs.castleHealth}/${CASTLE.MAX_HEALTH}`, w - 10, cy);
}

// ── Pattern Display (below HUD) ───────────────────────────────────────────────

function _patternDisplay(ctx, w, gs) {
    if (!gs.unlockedUnits || gs.unlockedUnits.length === 0) return;

    const y = LAYOUT.HUD_HEIGHT + 12;
    ctx.font = '10px "Courier New", monospace';
    ctx.textBaseline = 'top';

    const colW = Math.floor((w - LAYOUT.CASTLE_X_OFFSET - 10) / gs.unlockedUnits.length);
    gs.unlockedUnits.forEach((type, i) => {
        const x = LAYOUT.CASTLE_X_OFFSET + 10 + i * colW;
        ctx.fillStyle = COLORS[type] || COLORS.PRIMARY_UI;
        ctx.textAlign = 'left';
        ctx.fillText(`${type[0]}:${getActiveDescription(type)}`, x, y);
    });
}

// ── Feedback Message ──────────────────────────────────────────────────────────

function _feedback(ctx, w, h, fb) {
    const alpha = Math.min(1, fb.timer / 0.4); // fade out in last 0.4s
    ctx.globalAlpha = alpha;

    ctx.fillStyle    = fb.isError ? COLORS.HEALTH : COLORS.PRIMARY_UI;
    ctx.font         = 'bold 16px "Courier New", monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fb.message, w / 2, h - LAYOUT.INPUT_AREA_HEIGHT - 10);

    ctx.globalAlpha = 1;
}

// ── UNIT_SELECT Overlay ───────────────────────────────────────────────────────

function _unitSelectOverlay(ctx, w, h, gs) {
    if (gs.pendingMatches.length === 0) return;

    const overlayH = 60;
    const y        = h - LAYOUT.INPUT_AREA_HEIGHT - overlayH - 10;
    const boxW     = Math.min(180, (w - 40) / gs.pendingMatches.length);

    // Dim background
    ctx.fillStyle = 'rgba(5,8,16,0.85)';
    ctx.fillRect(20, y - 4, w - 40, overlayH + 8);

    ctx.strokeStyle = COLORS.SCORE;
    ctx.lineWidth = 1;
    ctx.strokeRect(20, y - 4, w - 40, overlayH + 8);

    // Header
    ctx.fillStyle    = COLORS.SCORE;
    ctx.font         = 'bold 11px "Courier New", monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`SELECT UNIT: "${gs.pendingWord.toUpperCase()}"  (Press 1–${gs.pendingMatches.length})`, w / 2, y);

    // Unit cards
    gs.pendingMatches.forEach((type, i) => {
        const cx = 30 + (i + 0.5) * boxW;

        ctx.fillStyle = COLORS[type] || COLORS.MILITIA;
        ctx.font      = 'bold 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`[${i + 1}] ${type}`, cx, y + 30);
    });
}
