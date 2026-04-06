// src/patterns.js — All 56 unit patterns (8 units × 7 variants), variant selection,
// pattern matching, and tier detection. See Section 4 of ARCHITECTURE.md.

import { TIERS } from './config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VOWEL_SET = new Set(['a', 'e', 'i', 'o', 'u']);

function isVowel(c)     { return VOWEL_SET.has(c); }
function isConsonant(c) { return /[a-z]/.test(c) && !VOWEL_SET.has(c); }

function vowels(w)     { return w.split('').filter(isVowel); }
function consonants(w) { return w.split('').filter(isConsonant); }
function unique(arr)   { return new Set(arr); }

// ── Pattern Definitions ───────────────────────────────────────────────────────
// Each array has exactly 7 functions (variants 0–6).
// A function receives the lowercase word string and returns boolean.

export const UNIT_PATTERNS = {

    WARRIOR: [
        // 0: Starts with a consonant
        w => isConsonant(w[0]),
        // 1: Contains R or L
        w => /[rl]/.test(w),
        // 2: Contains B, T, or K
        w => /[btk]/.test(w),
        // 3: Has exactly 2 vowels
        w => vowels(w).length === 2,
        // 4: Contains a double letter (ee, ll, tt, ...)
        w => /(.)\1/.test(w),
        // 5: Ends with a consonant
        w => isConsonant(w[w.length - 1]),
        // 6: First letter is in A–M
        w => w[0] >= 'a' && w[0] <= 'm',
    ],

    ARCHER: [
        // 0: Contains at least 3 vowels
        w => vowels(w).length >= 3,
        // 1: Starts with a vowel
        w => isVowel(w[0]),
        // 2: Contains TH, SH, or CH
        w => /th|sh|ch/.test(w),
        // 3: Has 5+ unique letters
        w => unique(w.split('')).size >= 5,
        // 4: Ends with E
        w => w.endsWith('e'),
        // 5: Contains N adjacent to a vowel (NA/NE/NI/NO/NU or AN/EN/IN/ON/UN)
        w => /n[aeiou]|[aeiou]n/.test(w),
        // 6: Second letter is a vowel
        w => w.length >= 2 && isVowel(w[1]),
    ],

    CAVALRY: [
        // 0: 4–6 letters only
        w => w.length >= 4 && w.length <= 6,
        // 1: No repeated letters
        w => unique(w.split('')).size === w.length,
        // 2: Contains a rare letter (Q, X, Z, J, or V)
        w => /[qxzjv]/.test(w),
        // 3: Starts and ends with same letter type (both vowels OR both consonants)
        w => (isVowel(w[0]) && isVowel(w[w.length - 1])) ||
             (isConsonant(w[0]) && isConsonant(w[w.length - 1])),
        // 4: All vowels are the same letter (e.g. "blast" → only A)
        w => { const v = vowels(w); return v.length > 0 && unique(v).size === 1; },
        // 5: Contains exactly 1 vowel
        w => vowels(w).length === 1,
        // 6: Strictly alternates vowel/consonant (or consonant/vowel) throughout
        w => {
            for (let i = 0; i < w.length - 1; i++) {
                if (isVowel(w[i]) === isVowel(w[i + 1])) return false;
            }
            return true;
        },
    ],

    DEFENDER: [
        // 0: 6+ letters
        w => w.length >= 6,
        // 1: Contains W or D
        w => /[wd]/.test(w),
        // 2: Starts with B, D, F, G, or H
        w => /^[bdfgh]/.test(w),
        // 3: Contains 3+ consonants in a row
        w => {
            let run = 0;
            for (const c of w) { if (isConsonant(c)) { if (++run >= 3) return true; } else run = 0; }
            return false;
        },
        // 4: Ends with ND, RD, LD, or TH
        w => /(?:nd|rd|ld|th)$/.test(w),
        // 5: First letter comes before last letter alphabetically
        w => w[0] < w[w.length - 1],
        // 6: Contains a vowel pair (two adjacent vowels) AND word is 5+ letters
        w => w.length >= 5 && /[aeiou]{2}/.test(w),
    ],

    SIEGE: [
        // 0: 7+ letters
        w => w.length >= 7,
        // 1: Contains at least 4 vowels
        w => vowels(w).length >= 4,
        // 2: Starts with S, C, or P
        w => /^[scp]/.test(w),
        // 3: Contains both R and S
        w => /r/.test(w) && /s/.test(w),
        // 4: 8+ letters
        w => w.length >= 8,
        // 5: Contains a 3+ letter all-consonant substring
        w => {
            let run = 0;
            for (const c of w) { if (isConsonant(c)) { if (++run >= 3) return true; } else run = 0; }
            return false;
        },
        // 6: Has at least 3 distinct vowel types present (e.g. A, E, and O all appear)
        w => unique(vowels(w)).size >= 3,
    ],

    MAGE: [
        // 0: Contains X, Z, Q, or the digraph PH
        w => /[xzq]|ph/.test(w),
        // 1: Starts with a vowel AND ends with a vowel
        w => isVowel(w[0]) && isVowel(w[w.length - 1]),
        // 2: More vowels than consonants
        w => vowels(w).length > consonants(w).length,
        // 3: Contains Y
        w => w.includes('y'),
        // 4: No letter appears more than once (complete uniqueness)
        w => unique(w.split('')).size === w.length,
        // 5: At least 3 of the 5 vowels (A, E, I, O, U) are present
        w => unique(vowels(w)).size >= 3,
        // 6: Even number of letters
        w => w.length % 2 === 0,
    ],

    HEALER: [
        // 0: Contains a vowel pair EA, OU, AI, EI, or OA
        w => /ea|ou|ai|ei|oa/.test(w),
        // 1: Vowel count equals consonant count (within ±1)
        w => Math.abs(vowels(w).length - consonants(w).length) <= 1,
        // 2: Starts with H, L, M, or W
        w => /^[hlmw]/.test(w),
        // 3: Every vowel in the word is the same letter (all A's, all E's, etc.)
        w => { const v = vowels(w); return v.length > 0 && unique(v).size === 1; },
        // 4: Contains exactly 2 distinct vowel types
        w => unique(vowels(w)).size === 2,
        // 5: Ends with a vowel
        w => isVowel(w[w.length - 1]),
        // 6: 5–7 letters
        w => w.length >= 5 && w.length <= 7,
    ],

    SCOUT: [
        // 0: 4–5 letters only
        w => w.length >= 4 && w.length <= 5,
        // 1: Contains none of E, T, A, or S (4 most common English letters)
        w => !/[etas]/.test(w),
        // 2: All letters unique, no repeats
        w => unique(w.split('')).size === w.length,
        // 3: Starts with N–Z (second half of alphabet)
        w => w[0] >= 'n' && w[0] <= 'z',
        // 4: More consonants than vowels by 2 or more
        w => consonants(w).length - vowels(w).length >= 2,
        // 5: Contains W, V, or K
        w => /[wvk]/.test(w),
        // 6: Exactly 4 letters
        w => w.length === 4,
    ],
};

// ── Pattern Descriptions (shown in HUD and Armory) ────────────────────────────

export const PATTERN_DESCRIPTIONS = {
    WARRIOR: [
        'Starts with a consonant',
        'Contains R or L',
        'Contains B, T, or K',
        'Has exactly 2 vowels',
        'Contains a double letter (LL, TT, EE…)',
        'Ends with a consonant',
        'First letter is A through M',
    ],
    ARCHER: [
        'Contains 3+ vowels',
        'Starts with a vowel',
        'Contains TH, SH, or CH',
        '5+ unique letters',
        'Ends with E',
        'Contains N next to a vowel',
        'Second letter is a vowel',
    ],
    CAVALRY: [
        '4–6 letters',
        'No repeated letters',
        'Contains Q, X, Z, J, or V',
        'Starts & ends same type (both vowels or consonants)',
        'All vowels are the same letter',
        'Exactly 1 vowel',
        'Alternates vowel/consonant throughout',
    ],
    DEFENDER: [
        '6+ letters',
        'Contains W or D',
        'Starts with B, D, F, G, or H',
        '3+ consonants in a row',
        'Ends with ND, RD, LD, or TH',
        'First letter alphabetically before last',
        'Has a vowel pair and 5+ letters',
    ],
    SIEGE: [
        '7+ letters',
        '4+ vowels',
        'Starts with S, C, or P',
        'Contains both R and S',
        '8+ letters',
        '3+ consonants in a row',
        '3+ distinct vowel types',
    ],
    MAGE: [
        'Contains X, Z, Q, or PH',
        'Starts and ends with a vowel',
        'More vowels than consonants',
        'Contains Y',
        'No repeated letters',
        '3+ of the 5 vowels present',
        'Even number of letters',
    ],
    HEALER: [
        'Contains EA, OU, AI, EI, or OA',
        'Vowels ≈ consonants (within 1)',
        'Starts with H, L, M, or W',
        'All vowels are the same letter',
        'Exactly 2 distinct vowel types',
        'Ends with a vowel',
        '5–7 letters',
    ],
    SCOUT: [
        '4–5 letters',
        'No E, T, A, or S',
        'All letters unique',
        'Starts with N through Z',
        'Consonants outnumber vowels by 2+',
        'Contains W, V, or K',
        'Exactly 4 letters',
    ],
};

// ── Variant State (one variant per unit, chosen at game start) ────────────────

let _activeVariants = {}; // unitType → variantIndex (0–6)

/** Pick one random variant per unit type. Call once at the start of each run. */
export function selectVariants() {
    _activeVariants = {};
    for (const type of Object.keys(UNIT_PATTERNS)) {
        _activeVariants[type] = Math.floor(Math.random() * 7);
    }
    return { ..._activeVariants };
}

/** Read back current variants (for HUD display). */
export function getActiveVariants() {
    return { ..._activeVariants };
}

/** Get the human-readable description for a unit type's active pattern. */
export function getActiveDescription(unitType) {
    const idx  = _activeVariants[unitType];
    const descs = PATTERN_DESCRIPTIONS[unitType];
    if (idx === undefined || !descs) return '???';
    return descs[idx];
}

// ── Matching ──────────────────────────────────────────────────────────────────

/**
 * Test a word against every unlocked unit's active pattern.
 * Returns an array of unit type strings that match (may be empty).
 *
 * @param {string}   word           — already validated, lowercase
 * @param {string[]} unlockedUnits  — unit types the player has unlocked
 */
export function matchPatterns(word, unlockedUnits) {
    const w = word.toLowerCase();
    const matches = [];
    for (const type of unlockedUnits) {
        const idx = _activeVariants[type];
        if (idx === undefined) continue;
        const fn  = UNIT_PATTERNS[type]?.[idx];
        if (fn && fn(w)) matches.push(type);
    }
    return matches;
}

// ── Tier Detection ────────────────────────────────────────────────────────────

/** Return the tier key ('COMMON' | 'STRONG' | 'ELITE' | 'LEGENDARY' | 'MYTHIC') for a word. */
export function getTier(word) {
    const len = word.length;
    for (const [key, tier] of Object.entries(TIERS)) {
        if (len >= tier.min && len <= tier.max) return key;
    }
    return 'COMMON';
}
