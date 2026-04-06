// src/systems/lanes.js — Lane management, threat calculation, unit auto-assignment.
// Wraps canvas.js lane geometry and adds game-specific logic.

import { computeLanes, onResize } from '../canvas.js';
import { LANES, LAYOUT } from '../config.js';

let _lanes           = [];
let _activeLaneCount = LANES.INITIAL_COUNT;

// ── Init / Resize ─────────────────────────────────────────────────────────────

export function initLanes(count = LANES.INITIAL_COUNT) {
    _activeLaneCount = count;
    _lanes = computeLanes(_activeLaneCount);
    // Recalculate whenever the canvas resizes
    onResize(() => { _lanes = computeLanes(_activeLaneCount); });
}

/** Expand lane count (called every 2 waves, max LANES.MAX_COUNT). */
export function addLane() {
    if (_activeLaneCount >= LANES.MAX_COUNT) return;
    _activeLaneCount++;
    _lanes = computeLanes(_activeLaneCount);
}

export function getLanes()           { return _lanes; }
export function getActiveLaneCount() { return _activeLaneCount; }

// ── Threat Calculation ────────────────────────────────────────────────────────
//
// Threat score = enemies in lane × 10
//              + (enemyCount − unitCount) × 5   (positive if outnumbered)
//              + proximity bonus (1000 / nearestEnemyX; higher = enemy closer to castle)
//
// The lane with the HIGHEST score gets the next unit.

function threatScore(laneIndex, enemies, units, castleX) {
    const laneEnemies = enemies.filter(e => !e.isDead() && e.laneIndex === laneIndex);
    const laneUnits   = units.filter(u => !u.isDead()   && u.laneIndex === laneIndex);

    const enemyScore   = laneEnemies.length * 10;
    const deficit      = Math.max(0, laneEnemies.length - laneUnits.length) * 5;

    const nearestX     = laneEnemies.length > 0
        ? Math.min(...laneEnemies.map(e => e.x))
        : Infinity;
    const proximity    = nearestX < Infinity ? 1000 / Math.max(1, nearestX - castleX) : 0;

    return enemyScore + deficit + proximity;
}

/**
 * Return the index of the most threatened active lane.
 * Falls back to lane 0 if there are no enemies anywhere.
 *
 * @param {Enemy[]} enemies
 * @param {Unit[]}  units
 * @param {number}  castleX
 */
export function getMostThreatenedLane(enemies, units, castleX) {
    let bestLane  = 0;
    let bestScore = -1;
    for (let i = 0; i < _activeLaneCount; i++) {
        const score = threatScore(i, enemies, units, castleX);
        if (score > bestScore) {
            bestScore = score;
            bestLane  = i;
        }
    }
    return bestLane;
}
