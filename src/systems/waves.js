// src/systems/waves.js — Enemy spawn scheduling for Phase 1.
// Spawns Basic enemies at intervals defined by the difficulty curve (Section 8).

import { Enemy }      from '../entities/enemy.js';
import { getWidth }   from '../canvas.js';
import { getLanes, getActiveLaneCount } from './lanes.js';
import { DIFFICULTY, ENEMIES } from '../config.js';

// Internal wave state (reset each wave)
let _spawnTimer       = 0;
let _spawnInterval    = DIFFICULTY.BASE_SPAWN_INTERVAL;
let _enemiesRemaining = 0;
let _waveNumber       = 1;
let _active           = false;

// ── Public API ────────────────────────────────────────────────────────────────

/** Start spawning for waveNumber. Call when entering PLAYING after wave preview. */
export function startWave(waveNumber) {
    _waveNumber       = waveNumber;
    _spawnTimer       = 0;
    _spawnInterval    = Math.max(
        DIFFICULTY.MIN_SPAWN_INTERVAL,
        DIFFICULTY.BASE_SPAWN_INTERVAL - (waveNumber - 1) * DIFFICULTY.SPAWN_INTERVAL_REDUCTION
    );
    _enemiesRemaining = Math.floor(
        DIFFICULTY.BASE_ENEMIES + waveNumber * DIFFICULTY.ENEMIES_PER_WAVE
    );
    _active = true;
}

/** Stop spawning (e.g. wave over, game paused). */
export function stopWave() {
    _active = false;
}

/** Resume spawning (e.g. un-pause). */
export function resumeWave() {
    _active = true;
}

/** True if there are still enemies left to spawn this wave. */
export function hasRemainingSpawns() {
    return _enemiesRemaining > 0;
}

export function getRemainingSpawns() {
    return _enemiesRemaining;
}

/**
 * Update spawn timer. Pushes new Enemy objects into the provided array.
 * @param {number}  dt
 * @param {Enemy[]} enemies  — game enemy array (mutated in-place)
 */
export function updateWaves(dt, enemies) {
    if (!_active || _enemiesRemaining <= 0) return;

    _spawnTimer += dt;
    if (_spawnTimer >= _spawnInterval) {
        _spawnTimer -= _spawnInterval;
        _spawnEnemy(enemies);
    }
}

// ── Spawn Logic ───────────────────────────────────────────────────────────────

function _spawnEnemy(enemies) {
    const lanes     = getLanes();
    const laneCount = getActiveLaneCount();
    if (lanes.length === 0) return;

    // Pick a random active lane
    const laneIndex = Math.floor(Math.random() * laneCount);
    const lane      = lanes[laneIndex];
    const spawnX    = getWidth() + ENEMIES.BASIC.size;  // just off right edge

    enemies.push(new Enemy({
        type:        'BASIC',
        laneIndex,
        x:           spawnX,
        y:           lane.centerY,
        waveNumber:  _waveNumber,
    }));

    _enemiesRemaining--;
}
