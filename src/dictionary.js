// src/dictionary.js — Dictionary loading, validation pipeline, plural detection.
//
// Loading strategy:
//   Development:  fetch('data/dictionary.txt') — file served alongside index.html
//   Production:   build.js inlines the dictionary as a JS string constant;
//                 main.js calls loadDictionary(RAW_WORDS) directly.
//
// Runtime structure: a single Set for O(1) word lookup.

import { VALIDATION } from './config.js';

let _dictionary = new Set();
let _loaded     = false;

// ── Loading ──────────────────────────────────────────────────────────────────

/**
 * Build the dictionary Set from a raw newline-delimited string.
 * Applies the same filters as the build-time pipeline (Section 2).
 */
export function loadDictionary(rawText) {
    _dictionary = new Set();
    const lines = rawText.split('\n');
    for (let line of lines) {
        const word = line.trim().toLowerCase();
        if (_isValidEntry(word)) _dictionary.add(word);
    }
    _loaded = true;
    console.log(`[dictionary] Loaded ${_dictionary.size.toLocaleString()} words`);
    return _dictionary.size;
}

/**
 * Fetch dictionary.txt from a URL and call loadDictionary().
 * Fails silently so the game can still run (with an empty dictionary).
 */
export async function fetchAndLoadDictionary(url = 'data/dictionary.txt') {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return loadDictionary(text);
    } catch (err) {
        console.warn(`[dictionary] Load failed (${err.message}) — game will run with empty dictionary`);
        _loaded = true;
        return 0;
    }
}

// Build-time filter: applied to every entry when constructing the Set.
function _isValidEntry(word) {
    if (word.length < VALIDATION.MIN_LENGTH) return false;
    if (!/^[a-z]+$/.test(word))             return false; // no hyphens, digits, spaces
    if (/^(.)\1+$/.test(word))              return false; // repeated single char (aaaa)
    return true;
}

export function isDictionaryLoaded() { return _loaded; }
export function getDictionarySize()  { return _dictionary.size; }

// ── Smart Plural Detection (Section 2) ───────────────────────────────────────
//
//   Correctly allows:  GRASS, ACROSS, CHAOS, PLUS, BONUS, NERVOUS, DARKNESS, ALWAYS, COMPASS
//   Correctly rejects: CATS (CAT exists), BOXES (BOX exists), BERRIES (BERRY exists)

export function isLikelyPlural(word) {
    if (!word.endsWith('s'))    return false;
    if (word.endsWith('ss'))    return false; // GRASS, BOSS, MOSS
    if (word.endsWith('us'))    return false; // CACTUS, FOCUS, BONUS
    if (word.endsWith('is'))    return false; // BASIS, OASIS
    if (word.endsWith('ous'))   return false; // FAMOUS, NERVOUS
    if (word.endsWith('ness'))  return false; // DARKNESS, KINDNESS
    if (word.endsWith('less'))  return false; // CARELESS

    if (word.endsWith('ies')) {
        const stem = word.slice(0, -3) + 'y'; // BERRIES → BERRY
        return _dictionary.has(stem);
    }
    if (word.endsWith('es')) {
        const stem1 = word.slice(0, -2); // BOXES → BOX
        const stem2 = word.slice(0, -1); // CAUSES → CAUSE
        return _dictionary.has(stem1) || _dictionary.has(stem2);
    }
    // Default: CATS → CAT
    const stem = word.slice(0, -1);
    return _dictionary.has(stem);
}

// ── Used-Word Tracking ───────────────────────────────────────────────────────

const _usedWords = new Set();

export function resetUsedWords()  { _usedWords.clear(); }
export function getUsedWords()    { return _usedWords; }
export function markUsed(word)    { _usedWords.add(word); }

// ── Validation Pipeline ──────────────────────────────────────────────────────

export const REJECT = {
    TOO_SHORT:    'Too short',
    ALREADY_USED: 'Already used',
    PLURAL:       'Plural detected',
    NOT_IN_DICT:  'Not in dictionary',
};

/**
 * Validate a raw word input through the full pipeline.
 * Returns { valid: true, word } on success, or { valid: false, reason } on failure.
 * Does NOT mark the word as used — call markUsed(word) after the unit spawns.
 */
export function validateWord(rawInput) {
    const word = rawInput.trim().toLowerCase();

    if (word.length < VALIDATION.MIN_LENGTH) {
        return { valid: false, reason: REJECT.TOO_SHORT };
    }
    if (_usedWords.has(word)) {
        return { valid: false, reason: REJECT.ALREADY_USED };
    }
    if (isLikelyPlural(word)) {
        return { valid: false, reason: REJECT.PLURAL };
    }
    if (!_dictionary.has(word)) {
        return { valid: false, reason: REJECT.NOT_IN_DICT };
    }

    return { valid: true, word };
}
