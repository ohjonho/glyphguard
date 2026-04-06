// src/state.js — Game state machine.
// Centralizes all state transitions so no module changes state behind the scenes.

import { STATE } from './config.js';

let _current = STATE.MENU;

// Map of state → array of listener functions called on entry.
const _onEnterListeners = {};

// Map of state → array of listener functions called on exit.
const _onExitListeners = {};

// ── Transition ───────────────────────────────────────────────────────────────

/**
 * Transition to a new state.
 * Fires all onExit listeners for the old state, then onEnter listeners for the new state.
 */
export function setState(newState) {
    if (!Object.values(STATE).includes(newState)) {
        console.warn(`[state] Unknown state: "${newState}"`);
        return;
    }
    if (newState === _current) return;

    const prev = _current;
    _current = newState;

    (_onExitListeners[prev]       || []).forEach(fn => fn(newState));
    (_onEnterListeners[newState]  || []).forEach(fn => fn(prev));
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function getState()     { return _current; }
export function is(state)      { return _current === state; }

export function isMenu()         { return _current === STATE.MENU; }
export function isPlaying()      { return _current === STATE.PLAYING; }
export function isPaused()       { return _current === STATE.PAUSED; }
export function isWaveComplete() { return _current === STATE.WAVE_COMPLETE; }
export function isArmory()       { return _current === STATE.ARMORY; }
export function isUnitSelect()   { return _current === STATE.UNIT_SELECT; }
export function isGameOver()     { return _current === STATE.GAME_OVER; }

// ── Subscriptions ────────────────────────────────────────────────────────────

/** Call fn(prevState) when entering `state`. */
export function onEnter(state, fn) {
    if (!_onEnterListeners[state]) _onEnterListeners[state] = [];
    _onEnterListeners[state].push(fn);
}

/** Call fn(nextState) when leaving `state`. */
export function onExit(state, fn) {
    if (!_onExitListeners[state]) _onExitListeners[state] = [];
    _onExitListeners[state].push(fn);
}

// ── Convenience Transitions ──────────────────────────────────────────────────
// Keep transition rules here so callers don't hard-code target states.

export function startGame()        { setState(STATE.PLAYING); }
export function pauseGame()        { setState(STATE.PAUSED); }
export function resumeGame()       { setState(STATE.PLAYING); }
export function endWave()          { setState(STATE.WAVE_COMPLETE); }
export function openArmory()       { setState(STATE.ARMORY); }
export function openModifier()     { setState(STATE.MODIFIER_CHOICE); }
export function openUnitSelect()   { setState(STATE.UNIT_SELECT); }
export function closeUnitSelect()  { setState(STATE.PLAYING); }
export function triggerGameOver()  { setState(STATE.GAME_OVER); }
export function goToLeaderboard()  { setState(STATE.LEADERBOARD); }
export function goToMenu()         { setState(STATE.MENU); }
export function beginNextWave()    { setState(STATE.PLAYING); }
