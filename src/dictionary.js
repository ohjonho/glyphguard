// src/dictionary.js — Dictionary loading, validation pipeline, plural detection.
//
// Loading strategy:
//   Production:   window.__GLYPHGUARD_DICT__ injected by build.js (zero network cost)
//   Development:  fetch('data/dictionary.txt') served by the esbuild dev server
//
// Runtime structure: a single Set for O(1) word lookup.
//
// NOTE ON DICTIONARY CONTENTS:
//   The Set contains words of ALL lengths (including 1–3 letter stems).
//   This is necessary so isLikelyPlural() can find stems like 'cat' (to reject 'cats').
//   The 4-letter minimum for gameplay is enforced by validateWord(), not by the Set.

import { VALIDATION } from './config.js';

let _dictionary = new Set();
let _loaded     = false;

// ── Loading ───────────────────────────────────────────────────────────────────

/**
 * Build the dictionary Set from a raw newline-delimited string.
 * Accepts words of any length — short words are needed as stems for plural detection.
 */
export function loadDictionary(rawText) {
    _dictionary = new Set();
    const lines = rawText.split('\n');
    for (const line of lines) {
        const word = line.trim().toLowerCase();
        if (_isValidEntry(word)) _dictionary.add(word);
    }
    _loaded = true;
    const playable = [..._dictionary].filter(w => w.length >= VALIDATION.MIN_LENGTH).length;
    console.log(`[dictionary] Loaded ${_dictionary.size.toLocaleString()} words (${playable.toLocaleString()} playable)`);
    return _dictionary.size;
}

/**
 * Load from whatever source is available:
 *   1. Production: window.__GLYPHGUARD_DICT__ injected by build.js
 *   2. Development: fetch from the esbuild dev server
 */
export async function fetchAndLoadDictionary(url = 'data/dictionary.txt') {
    // Production path — build.js inlines the dictionary as a window global
    if (typeof window !== 'undefined' && window.__GLYPHGUARD_DICT__) {
        console.log('[dictionary] Using inlined dictionary');
        return loadDictionary(window.__GLYPHGUARD_DICT__);
    }
    // Development path — fetch from the dev server
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return loadDictionary(text);
    } catch (err) {
        console.warn(`[dictionary] Load failed (${err.message}) — run "npm run build:dict" to generate data/dictionary.txt`);
        _loaded = true;
        return 0;
    }
}

// Entry is valid if it is a non-empty string of only [a-z] characters, and not
// a single character repeated (e.g. "aaaa"). No minimum length — short words
// are kept for stem lookup even though players can't type them.
function _isValidEntry(word) {
    if (!word)                      return false;
    if (!/^[a-z]+$/.test(word))     return false;
    if (/^(.)\1+$/.test(word))      return false; // aaaa, bbb, cc
    return true;
}

export function isDictionaryLoaded() { return _loaded; }
export function getDictionarySize()  { return _dictionary.size; }

// ── Smart Plural Detection (Section 2) ───────────────────────────────────────
//
// Heuristic: a word ending in 's' is "likely a plural" if removing the 's'
// (and applying standard English morphology) produces a stem that exists in
// the dictionary.
//
// Correctly ALLOWS (returns false):
//   GRASS, ACROSS, CHAOS, PLUS, BONUS, NERVOUS, DARKNESS, ALWAYS, COMPASS,
//   COSMOS, ALIAS, FOCUS, CACTUS, BASIS, OASIS
//
// Correctly REJECTS (returns true):
//   CATS (→ CAT), BOXES (→ BOX), BERRIES (→ BERRY), STONES (→ STONE)
//
// Known edge cases handled by PLURAL_EXCEPTIONS below.

// Words where an archaic or obscure stem happens to exist in the dwyl corpus,
// making the heuristic produce a false positive. Each entry is accompanied by
// the stem that caused the false detection.
// Words where an archaic/obscure stem happens to exist in the dwyl corpus,
// making the heuristic produce a false positive. Verified against the full
// dwyl words_alpha.txt list. Extend here if playtesting reveals more.
const PLURAL_EXCEPTIONS = new Set([
    'chaos',   // stem 'chao'  (archaic rope)    — chaos is Greek for void/disorder
    'always',  // stem 'alway' (archaic adverb)  — always is not its plural
    'cosmos',  // stem 'cosmo' (prefix/cocktail) — cosmos is a Greek mass noun
    'alias',   // stem 'alia'  (Latin pl.)       — alias is a Latin word, not plural of alia
    'news',    // stem 'new'   (3-letter adj.)   — news is an uncountable noun
    'lens',    // stem 'len'   (archaic: 'lend') — lens is a singular noun
]);

export function isLikelyPlural(word) {
    if (!word.endsWith('s'))   return false;
    if (PLURAL_EXCEPTIONS.has(word)) return false; // explicit allowlist

    if (word.endsWith('ss'))   return false; // GRASS, BOSS, MOSS
    if (word.endsWith('us'))   return false; // CACTUS, FOCUS, BONUS
    if (word.endsWith('is'))   return false; // BASIS, OASIS
    if (word.endsWith('ous'))  return false; // FAMOUS, NERVOUS
    if (word.endsWith('ness')) return false; // DARKNESS, KINDNESS
    if (word.endsWith('less')) return false; // CARELESS

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

// ── Used-Word Tracking ────────────────────────────────────────────────────────

const _usedWords = new Set();

export function resetUsedWords()  { _usedWords.clear(); }
export function getUsedWords()    { return _usedWords; }
export function markUsed(word)    { _usedWords.add(word); }

// ── Validation Pipeline ───────────────────────────────────────────────────────

export const REJECT = {
    TOO_SHORT:    'Too short',
    ALREADY_USED: 'Already used',
    PLURAL:       'Plural detected',
    NOT_IN_DICT:  'Not in dictionary',
};

/**
 * Run a raw word through the full validation pipeline.
 * Returns { valid: true, word } on success, or { valid: false, reason } on rejection.
 * Does NOT mark the word as used — call markUsed(word) only after the unit spawns.
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
