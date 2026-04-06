// src/entities/enemy.js — Enemy entity. Moves left along its lane toward the castle.

import { Entity }    from './entity.js';
import { ENEMIES, SPEED_SCALE, COLORS, DIFFICULTY } from '../config.js';

export class Enemy extends Entity {
    /**
     * @param {object} opts
     * @param {string} opts.type        — 'BASIC' | 'FAST' | 'TANK' | 'ELITE' | 'BOSS'
     * @param {number} opts.laneIndex
     * @param {number} opts.x           — spawn x (typically canvas right edge)
     * @param {number} opts.y           — lane centerY
     * @param {number} opts.waveNumber  — used to scale HP per difficulty formula
     */
    constructor({ type, laneIndex, x, y, waveNumber = 1 }) {
        const cfg = ENEMIES[type];
        if (!cfg) throw new Error(`Unknown enemy type: ${type}`);

        const hpMult = 1 + (waveNumber - 1) * DIFFICULTY.HEALTH_SCALE_PER_WAVE;
        const health = Math.ceil(cfg.health * hpMult);

        super({ x, y, laneIndex, health, size: cfg.size });

        this.type        = type;
        this.speed       = cfg.speed * SPEED_SCALE; // pixels / second
        this.reward      = cfg.reward;
        this.contactDPS  = cfg.contactDPS;
        this.castleDamage = cfg.castleDamage;
        this.inCombat    = false; // true while a melee unit is engaging this enemy
    }

    /**
     * Move left. Returns castleDamage if this enemy has reached the castle edge,
     * 0 otherwise. Caller removes dead/reached enemies from the array.
     * @param {number} dt
     * @param {number} castleX  — x threshold; reaching this counts as castle hit
     * @returns {number}
     */
    update(dt, castleX) {
        if (this.dead) return 0;
        if (!this.inCombat) {
            this.x -= this.speed * dt;
        }
        if (this.x <= castleX) {
            this.dead = true;
            return this.castleDamage;
        }
        return 0;
    }

    draw(ctx) {
        if (this.dead) return;

        const s  = this.size;
        const hs = s / 2;

        // Body
        ctx.fillStyle = _colorForType(this.type);
        ctx.fillRect(Math.round(this.x - hs), Math.round(this.y - hs), s, s);

        // Health bar
        _drawHealthBar(ctx, this.x, this.y - hs - 6, s, this.health / this.maxHealth);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _colorForType(type) {
    switch (type) {
        case 'BASIC': return '#cc2222';
        case 'FAST':  return '#dd6600';
        case 'TANK':  return '#882222';
        case 'ELITE': return '#ff0066';
        case 'BOSS':  return '#ff00ff';
        default:      return '#ff4444';
    }
}

function _drawHealthBar(ctx, cx, topY, width, fraction) {
    const h = 3;
    const x = Math.round(cx - width / 2);
    ctx.fillStyle = '#333';
    ctx.fillRect(x, Math.round(topY), width, h);
    ctx.fillStyle = fraction > 0.5 ? '#44ff44' : fraction > 0.25 ? '#ffdd00' : '#ff4444';
    ctx.fillRect(x, Math.round(topY), Math.round(width * fraction), h);
}
