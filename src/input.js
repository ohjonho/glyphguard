// src/input.js — Keyboard capture, word buffer, Enter-to-submit, feedback display.
// Only processes word input when the game state is PLAYING.
// UNIT_SELECT number-key interception is handled in main.js.

import { is } from './state.js';
import { STATE } from './config.js';

let _inputEl     = null;
let _onSubmit    = null;    // fn(word: string)
let _feedback    = { message: '', timer: 0, isError: false };

const FEEDBACK_DURATION = 2.0; // seconds

// ── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {function} onSubmit  — called with the trimmed word string on Enter
 */
export function initInput(onSubmit) {
    _onSubmit = onSubmit;
    _inputEl  = document.getElementById('word-input');

    if (!_inputEl) {
        console.warn('[input] #word-input not found');
        return;
    }

    _inputEl.addEventListener('keydown', _handleKeydown);

    // Keep input letter-only (strip anything non-alpha as it's typed)
    _inputEl.addEventListener('input', () => {
        _inputEl.value = _inputEl.value.replace(/[^a-zA-Z]/g, '');
    });
}

function _handleKeydown(e) {
    // Only process word input while PLAYING
    if (!is(STATE.PLAYING)) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        const word = _inputEl.value.trim();
        if (word.length > 0 && _onSubmit) {
            _onSubmit(word);
        }
        _inputEl.value = '';
    }
}

// ── Enable / Disable ──────────────────────────────────────────────────────────

/** Focus the input so the player can type immediately. */
export function enableInput() {
    if (_inputEl) {
        _inputEl.disabled = false;
        _inputEl.focus();
    }
}

/** Blur and disable so key events don't reach the input during overlays. */
export function disableInput() {
    if (_inputEl) {
        _inputEl.blur();
        _inputEl.disabled = true;
        _inputEl.value = '';
    }
}

/** Clear the word buffer without submitting (e.g. after UNIT_SELECT resolves). */
export function clearInput() {
    if (_inputEl) _inputEl.value = '';
}

// ── Feedback Messages ─────────────────────────────────────────────────────────

/**
 * Display a short feedback message on the canvas.
 * @param {string}  message
 * @param {boolean} isError  — true = red, false = green
 */
export function setFeedback(message, isError = true) {
    _feedback = { message, timer: FEEDBACK_DURATION, isError };
}

/** Tick down the feedback timer. Call once per frame. */
export function updateFeedback(dt) {
    if (_feedback.timer > 0) _feedback.timer -= dt;
}

/** Returns the current feedback object { message, timer, isError }. */
export function getFeedback() {
    return _feedback;
}
