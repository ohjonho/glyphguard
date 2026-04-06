// src/main.js — GlyphGuard entry point. Initializes all systems and runs the game loop.

import { initCanvas, getCtx, getWidth, getHeight } from './canvas.js';
import { getState, setState, is, onEnter, onExit } from './state.js';
import { fetchAndLoadDictionary, validateWord, markUsed, resetUsedWords } from './dictionary.js';
import { selectVariants, matchPatterns, getTier } from './patterns.js';
import { initLanes, getLanes, getActiveLaneCount, getMostThreatenedLane } from './systems/lanes.js';
import { startWave, stopWave, resumeWave, updateWaves, hasRemainingSpawns } from './systems/waves.js';
import { initInput, enableInput, disableInput, setFeedback, updateFeedback, getFeedback } from './input.js';
import { render } from './renderer.js';
import { Unit } from './entities/unit.js';
import { STATE, COLORS, CASTLE, LAYOUT, COMBO, LANES } from './config.js';

// ── Game State ────────────────────────────────────────────────────────────────

const gs = {
    units:          [],
    enemies:        [],

    castleHealth:   CASTLE.MAX_HEALTH,
    waveNumber:     1,
    score:          0,
    combo:          0,
    comboTimer:     0,

    activeLaneCount: LANES.INITIAL_COUNT,
    lanes:          [],   // kept in sync with lanes.js

    // All unit types the player has unlocked (starts with just these two)
    unlockedUnits:  ['WARRIOR', 'ARCHER'],

    // Active pattern variants (set at game start by selectVariants())
    activeVariants: {},

    // UNIT_SELECT state
    pendingMatches: [],
    pendingWord:    '',
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    initCanvas();
    initLanes(LANES.INITIAL_COUNT);
    gs.lanes = getLanes();

    // Keep gs.lanes in sync when canvas resizes
    window.addEventListener('resize', () => { gs.lanes = getLanes(); });

    // Non-blocking dictionary load; game is still playable on MENU while it loads
    fetchAndLoadDictionary('data/dictionary.txt').then(count => {
        if (count === 0) setFeedback('Dictionary not found — run npm run build:dict', false);
    });

    initInput(_onWordSubmit);

    // ── State transition hooks ────────────────────────────────────────────────

    onEnter(STATE.PLAYING, () => {
        enableInput();
        resumeWave();
    });

    onExit(STATE.PLAYING, () => {
        disableInput();
        stopWave();
    });

    onEnter(STATE.UNIT_SELECT, () => {
        disableInput();
        // Wave timer pauses (stopWave() called via PLAYING onExit)
    });

    onEnter(STATE.GAME_OVER, () => {
        disableInput();
    });

    onEnter(STATE.MENU, () => {
        disableInput();
    });

    // ── Keyboard: UNIT_SELECT number keys ─────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (is(STATE.UNIT_SELECT)) {
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= gs.pendingMatches.length) {
                _resolveUnitSelect(n - 1);
            }
            return;
        }
        if (e.key === 'Escape') {
            if (is(STATE.PLAYING)) setState(STATE.PAUSED);
            else if (is(STATE.PAUSED)) { setState(STATE.PLAYING); }
        }
        if (e.key === 'Enter') {
            if (is(STATE.MENU))      _startGame();
            if (is(STATE.GAME_OVER)) { setState(STATE.MENU); }
            if (is(STATE.PAUSED))    setState(STATE.PLAYING);
        }
    });

    setState(STATE.MENU);
    requestAnimationFrame(_loop);
}

// ── Game Lifecycle ────────────────────────────────────────────────────────────

function _startGame() {
    // Reset state
    gs.units          = [];
    gs.enemies        = [];
    gs.castleHealth   = CASTLE.MAX_HEALTH;
    gs.waveNumber     = 1;
    gs.score          = 0;
    gs.combo          = 0;
    gs.comboTimer     = 0;
    gs.pendingMatches = [];
    gs.pendingWord    = '';
    resetUsedWords();

    gs.activeVariants = selectVariants();
    initLanes(LANES.INITIAL_COUNT);
    gs.lanes = getLanes();

    startWave(gs.waveNumber);
    setState(STATE.PLAYING);
}

// ── Word Submission ───────────────────────────────────────────────────────────

function _onWordSubmit(raw) {
    const result = validateWord(raw);

    if (!result.valid) {
        setFeedback(result.reason, true);
        _breakCombo();
        return;
    }

    const word    = result.word;
    const matches = matchPatterns(word, gs.unlockedUnits);

    if (matches.length === 0) {
        // Valid word but no pattern match — spawn a Militia
        _spawnUnit('MILITIA', word);
        markUsed(word);
        _incrementCombo();
        setFeedback(`Militia! "${word.toUpperCase()}"`, false);
        return;
    }

    if (matches.length === 1) {
        // Exactly one match — spawn immediately
        _spawnUnit(matches[0], word);
        markUsed(word);
        _incrementCombo();
        setFeedback(`${matches[0]}! "${word.toUpperCase()}"`, false);
        return;
    }

    // Multiple matches — enter UNIT_SELECT
    gs.pendingMatches = matches;
    gs.pendingWord    = word;
    setState(STATE.UNIT_SELECT);
}

// ── UNIT_SELECT Resolution ────────────────────────────────────────────────────

function _resolveUnitSelect(chosenIndex) {
    const word    = gs.pendingWord;
    const matches = gs.pendingMatches;

    // Spawn main unit
    _spawnUnit(matches[chosenIndex], word);

    // Spawn Militia for each additional match
    for (let i = 0; i < matches.length; i++) {
        if (i !== chosenIndex) _spawnUnit('MILITIA', word);
    }

    markUsed(word);
    _incrementCombo();
    setFeedback(`${matches[chosenIndex]}! +${matches.length - 1} Militia`, false);

    gs.pendingMatches = [];
    gs.pendingWord    = '';
    setState(STATE.PLAYING);
}

// ── Unit Spawning ─────────────────────────────────────────────────────────────

function _spawnUnit(unitType, word) {
    const tier      = unitType === 'MILITIA' ? 'COMMON' : getTier(word);
    const castleX   = LAYOUT.CASTLE_X_OFFSET;
    const laneIndex = getMostThreatenedLane(gs.enemies, gs.units, castleX);
    const lane      = gs.lanes[laneIndex];
    if (!lane) return;

    gs.units.push(new Unit({
        unitType,
        word,
        tier,
        laneIndex,
        x: castleX + 30,
        y: lane.centerY,
    }));
}

// ── Combo ─────────────────────────────────────────────────────────────────────

function _incrementCombo() {
    gs.combo++;
    gs.comboTimer = COMBO.BREAK_TIMEOUT;
}

function _breakCombo() {
    gs.combo      = 0;
    gs.comboTimer = 0;
}

// ── Game Loop ─────────────────────────────────────────────────────────────────

let _lastTime = 0;

function _loop(timestamp) {
    const dt = Math.min((timestamp - _lastTime) / 1000, 0.05);
    _lastTime = timestamp;

    _update(dt);
    _render();
    requestAnimationFrame(_loop);
}

function _update(dt) {
    const state = getState();

    // Feedback timer always ticks
    updateFeedback(dt);

    if (state === STATE.PLAYING) {
        _updatePlaying(dt);
    } else if (state === STATE.PAUSED || state === STATE.UNIT_SELECT) {
        // No simulation update; wave timer paused via stopWave()
    }
}

function _updatePlaying(dt) {
    // Combo timeout
    if (gs.combo > 0) {
        gs.comboTimer -= dt;
        if (gs.comboTimer <= 0) _breakCombo();
    }

    // Spawn enemies
    updateWaves(dt, gs.enemies);

    // Update enemies
    const castleX = LAYOUT.CASTLE_X_OFFSET;
    for (const enemy of gs.enemies) {
        const dmg = enemy.update(dt, castleX);
        if (dmg > 0) {
            gs.castleHealth -= dmg;
            if (gs.castleHealth <= 0) {
                gs.castleHealth = 0;
                setState(STATE.GAME_OVER);
                return;
            }
        }
    }

    // Update units
    for (const unit of gs.units) {
        unit.update(dt, gs.enemies);
    }

    // Collect score for killed enemies, reset inCombat flag
    let scored = false;
    for (const enemy of gs.enemies) {
        enemy.inCombat = false; // reset each frame; units set it true if engaging
        if (enemy.isDead()) {
            gs.score += enemy.reward;
            scored = true;
        }
    }

    // Purge dead entities
    gs.enemies = gs.enemies.filter(e => !e.isDead());
    gs.units   = gs.units.filter(u => !u.isDead());
}

function _render() {
    const ctx = getCtx();
    const w   = getWidth();
    const h   = getHeight();
    const state = getState();

    if (state === STATE.MENU) {
        _renderMenu(ctx, w, h);
        return;
    }
    if (state === STATE.GAME_OVER) {
        _renderGameOver(ctx, w, h);
        return;
    }

    // PLAYING, PAUSED, UNIT_SELECT — all show the battlefield
    render(ctx, w, h, gs, getFeedback());

    if (state === STATE.PAUSED) _renderPauseOverlay(ctx, w, h);
}

// ── Simple screen renderers (menu / game-over / pause) ───────────────────────

function _renderMenu(ctx, w, h) {
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.PRIMARY_UI;
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GLYPHGUARD', w / 2, h / 2 - 50);
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = COLORS.UI_SHADOW;
    ctx.fillText('Roguelike Typing Defense', w / 2, h / 2 - 14);
    ctx.fillStyle = COLORS.SCORE;
    ctx.fillText('[ ENTER to Start ]', w / 2, h / 2 + 28);
}

function _renderGameOver(ctx, w, h) {
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.HEALTH;
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', w / 2, h / 2 - 50);
    ctx.fillStyle = COLORS.SCORE;
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText(`Score: ${gs.score}`, w / 2, h / 2);
    ctx.fillStyle = COLORS.WAVE;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(`Reached Wave ${gs.waveNumber}`, w / 2, h / 2 + 30);
    ctx.fillStyle = COLORS.PRIMARY_UI;
    ctx.fillText('[ ENTER to return to menu ]', w / 2, h / 2 + 62);
}

function _renderPauseOverlay(ctx, w, h) {
    ctx.fillStyle = 'rgba(5,8,16,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COLORS.COMBO;
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', w / 2, h / 2 - 20);
    ctx.fillStyle = COLORS.PRIMARY_UI;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('[ ESC or ENTER to resume ]', w / 2, h / 2 + 20);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
