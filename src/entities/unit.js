// src/entities/unit.js — Unit entity. Spawns at the castle, engages enemies in its lane.
// Handles melee (advance + contact) and ranged (hold position + shoot) combat archetypes.

import { Entity }    from './entity.js';
import { UNITS, MILITIA_PROMOTIONS, SPEED_SCALE, COLORS, TIERS } from '../config.js';

// Unit draw sizes (half-width, half-height)
const DRAW_SIZE = {
    WARRIOR:  { w: 9,  h: 11 },
    ARCHER:   { w: 7,  h: 9  },
    CAVALRY:  { w: 10, h: 8  },
    DEFENDER: { w: 12, h: 14 },
    SIEGE:    { w: 11, h: 10 },
    MAGE:     { w: 8,  h: 12 },
    HEALER:   { w: 8,  h: 10 },
    SCOUT:    { w: 6,  h: 7  },
    MILITIA:  { w: 6,  h: 7  },
};

export class Unit extends Entity {
    /**
     * @param {object} opts
     * @param {string} opts.unitType  — key from UNITS or 'MILITIA'
     * @param {string} opts.word      — the word that spawned this unit (for echo/display)
     * @param {string} opts.tier      — 'COMMON'|'STRONG'|'ELITE'|'LEGENDARY'|'MYTHIC'
     * @param {number} opts.laneIndex
     * @param {number} opts.x
     * @param {number} opts.y
     */
    constructor({ unitType, word, tier, laneIndex, x, y }) {
        const cfg    = _statsFor(unitType);
        const tierCfg = TIERS[tier] || TIERS.COMMON;

        const health = Math.round(cfg.health * (1 + tierCfg.healthBonus));
        const ds     = DRAW_SIZE[unitType] || { w: 8, h: 10 };

        super({ x, y, laneIndex, health, size: Math.max(ds.w, ds.h) * 2 });

        this.unitType    = unitType;
        this.word        = word;
        this.tier        = tier;
        this.drawW       = ds.w;
        this.drawH       = ds.h;

        // Combat stats (apply tier damage bonus)
        this.damage      = cfg.damage * (1 + tierCfg.damageBonus);
        this.speed       = cfg.speed * SPEED_SCALE;  // px/s
        this.attackRange = cfg.range;
        this.attackRate  = cfg.attackRate;            // attacks/second
        this.attackCooldown = 0;

        this.isMelee     = cfg.isMelee;
        this.isRanged    = cfg.isRanged;
        this.isHealer    = cfg.isHealer;

        // Ranged units hold their spawn position
        this.spawnX      = x;

        // Elite tier: start with a 2-second damage shield
        this.shieldTimer = (tier === 'ELITE') ? 2 : 0;
    }

    /**
     * @param {number}  dt
     * @param {Enemy[]} enemies  — all live enemies (unit filters by laneIndex)
     */
    update(dt, enemies) {
        if (this.dead) return;

        // Tick shield
        if (this.shieldTimer > 0) this.shieldTimer -= dt;

        // Tick attack cooldown
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        const target = this._findTarget(enemies);

        if (this.isMelee) {
            this._updateMelee(dt, target);
        } else if (this.isRanged) {
            this._updateRanged(dt, target);
        }
        // Healer / Siege / Mage stubs — basic ranged for now
    }

    _updateMelee(dt, target) {
        if (!target) {
            // Patrol slightly right of spawn, don't wander too far
            if (this.x < this.spawnX + 40) this.x += this.speed * dt;
            return;
        }

        const dx = target.x - this.x;
        if (Math.abs(dx) <= this.attackRange + target.size / 2) {
            // In attack range: stop and fight
            target.inCombat = true;
            this._attack(target, dt);
        } else if (dx > 0) {
            // Advance toward the enemy
            this.x += this.speed * dt;
        }
    }

    _updateRanged(dt, target) {
        // Ranged units hold their spawn column
        this.x = this.spawnX;
        if (!target) return;
        this._attack(target, dt);
    }

    _attack(target, dt) {
        // Melee units also take contact DPS while engaged
        if (this.isMelee && this.shieldTimer <= 0) {
            this.takeDamage(target.contactDPS * dt);
        }
        // Deal damage when cooldown expires
        if (this.attackCooldown <= 0) {
            target.takeDamage(this.damage);
            this.attackCooldown = 1 / this.attackRate;
        }
    }

    /** Find the most dangerous enemy (smallest x = closest to castle) in this lane. */
    _findTarget(enemies) {
        let best = null;
        for (const e of enemies) {
            if (e.isDead() || e.laneIndex !== this.laneIndex) continue;
            if (!best || e.x < best.x) best = e;
        }
        return best;
    }

    draw(ctx) {
        if (this.dead) return;

        const hw = this.drawW;
        const hh = this.drawH;
        const x  = Math.round(this.x);
        const y  = Math.round(this.y);

        // Shield glow
        if (this.shieldTimer > 0) {
            ctx.fillStyle = 'rgba(100,200,255,0.25)';
            ctx.fillRect(x - hw - 4, y - hh - 4, (hw + 4) * 2, (hh + 4) * 2);
        }

        // Body
        ctx.fillStyle = COLORS[this.unitType] || COLORS.MILITIA;
        ctx.fillRect(x - hw, y - hh, hw * 2, hh * 2);

        // Tier indicator dot (top-right corner, color-coded)
        if (this.tier !== 'COMMON') {
            ctx.fillStyle = _tierColor(this.tier);
            ctx.fillRect(x + hw - 4, y - hh, 4, 4);
        }

        // Health bar
        _drawHealthBar(ctx, x, y - hh - 6, hw * 2, this.health / this.maxHealth);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _statsFor(unitType) {
    if (unitType === 'MILITIA') {
        return {
            health: MILITIA_PROMOTIONS.BASE.health,
            damage: MILITIA_PROMOTIONS.BASE.damage,
            speed:  MILITIA_PROMOTIONS.BASE.speedMult * 0.3,
            range:  25,
            attackRate: 0.8,
            isMelee: true, isRanged: false, isHealer: false,
        };
    }
    const cfg = UNITS[unitType];
    if (!cfg) throw new Error(`Unknown unit type: ${unitType}`);
    return cfg;
}

function _tierColor(tier) {
    switch (tier) {
        case 'STRONG':    return '#aaffaa';
        case 'ELITE':     return '#44ccff';
        case 'LEGENDARY': return '#ffdd44';
        case 'MYTHIC':    return '#ff44ff';
        default:          return '#ffffff';
    }
}

function _drawHealthBar(ctx, cx, topY, width, fraction) {
    const h = 3;
    const x = Math.round(cx - width / 2);
    ctx.fillStyle = '#333';
    ctx.fillRect(x, Math.round(topY), width, h);
    ctx.fillStyle = fraction > 0.5 ? '#44ff44' : fraction > 0.25 ? '#ffdd00' : '#ff4444';
    ctx.fillRect(x, Math.round(topY), Math.round(width * Math.max(0, fraction)), h);
}
