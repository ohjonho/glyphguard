// src/config.js — Single source of truth for all tunable constants.
// Never hardcode balance numbers elsewhere — edit here for playtesting.

// ── Canvas ───────────────────────────────────────────────────────────────────

export const CANVAS = {
    MIN_WIDTH:    800,
    MAX_WIDTH:    1600,
    MIN_HEIGHT:   500,
    MAX_HEIGHT:   900,
    HEIGHT_RATIO: 0.7,   // fraction of window height
    MARGIN:       40,    // pixels subtracted from window width
};

// ── Layout (pixel measurements at logical resolution) ────────────────────────

export const LAYOUT = {
    HUD_HEIGHT:               50,
    INPUT_AREA_HEIGHT:        70,
    PLAYABLE_TOP_PADDING:     60,  // gap below HUD bar
    PLAYABLE_BOTTOM_PADDING:  80,  // gap above word input
    CASTLE_X_OFFSET:          60,  // pixels from left edge to castle
};

// ── Lane System ──────────────────────────────────────────────────────────────

export const LANES = {
    INITIAL_COUNT:             2,
    MAX_COUNT:                 6,
    ADD_EVERY_N_WAVES:         2,   // new lane added every 2 waves
    INTERPOLATION_DURATION:    0.5, // seconds for entities to slide to new lane positions
};

// ── State Names ──────────────────────────────────────────────────────────────

export const STATE = {
    MENU:             'MENU',
    PLAYING:          'PLAYING',
    PAUSED:           'PAUSED',
    WAVE_COMPLETE:    'WAVE_COMPLETE',
    ARMORY:           'ARMORY',
    MODIFIER_CHOICE:  'MODIFIER_CHOICE',
    UNIT_SELECT:      'UNIT_SELECT',
    GAME_OVER:        'GAME_OVER',
    LEADERBOARD:      'LEADERBOARD',
};

// ── Color Palette ────────────────────────────────────────────────────────────

export const COLORS = {
    BACKGROUND:  '#0a0e1a',
    PRIMARY_UI:  '#00ff41',
    UI_SHADOW:   '#008f11',
    HEALTH:      '#ff4444',
    SCORE:       '#ffdd44',
    WAVE:        '#44ffaa',
    COMBO:       '#ff8844',
    CASTLE:      '#6688cc',

    // Unit type colors (distinct, high-contrast on dark background)
    WARRIOR:   '#ff6644',
    ARCHER:    '#44ddff',
    CAVALRY:   '#ffdd00',
    DEFENDER:  '#8888ff',
    SIEGE:     '#ff44aa',
    MAGE:      '#cc44ff',
    HEALER:    '#44ff88',
    SCOUT:     '#ffaa44',
    MILITIA:   '#aaaaaa',
};

// ── Word Length Tiers ────────────────────────────────────────────────────────

export const TIERS = {
    COMMON:    { min: 4,  max: 5,        label: 'Common',    damageBonus: 0,    healthBonus: 0,    shield: false, aoe: false },
    STRONG:    { min: 6,  max: 7,        label: 'Strong',    damageBonus: 0.15, healthBonus: 0.15, shield: false, aoe: false },
    ELITE:     { min: 8,  max: 9,        label: 'Elite',     damageBonus: 0.30, healthBonus: 0.30, shield: true,  aoe: false },
    LEGENDARY: { min: 10, max: 11,       label: 'Legendary', damageBonus: 0.50, healthBonus: 0.50, shield: false, aoe: false },
    MYTHIC:    { min: 12, max: Infinity, label: 'Mythic',    damageBonus: 0.70, healthBonus: 0.70, shield: false, aoe: true  },
};

// ── Unit Base Stats ──────────────────────────────────────────────────────────

export const UNITS = {
    WARRIOR:  { health: 8,  damage: 2,   speed: 0.6, range: 30,  attackRate: 1.0, isMelee: true,  isRanged: false, isArea: false, isHealer: false },
    ARCHER:   { health: 5,  damage: 2.5, speed: 0.3, range: 300, attackRate: 1.2, isMelee: false, isRanged: true,  isArea: false, isHealer: false },
    CAVALRY:  { health: 6,  damage: 4,   speed: 1.1, range: 30,  attackRate: 0.8, isMelee: true,  isRanged: false, isArea: false, isHealer: false },
    DEFENDER: { health: 20, damage: 1.5, speed: 0.3, range: 30,  attackRate: 0.7, isMelee: true,  isRanged: false, isArea: false, isHealer: false },
    SIEGE:    { health: 6,  damage: 6,   speed: 0.2, range: 400, attackRate: 0.4, isMelee: false, isRanged: false, isArea: true,  isHealer: false, blastRadius: 50 },
    MAGE:     { health: 5,  damage: 5,   speed: 0.3, range: 350, attackRate: 0.6, isMelee: false, isRanged: false, isArea: true,  isHealer: false, blastRadius: 70 },
    HEALER:   { health: 5,  damage: 0,   speed: 0.3, range: 200, attackRate: 0.8, isMelee: false, isRanged: false, isArea: false, isHealer: true,  healAmount: 2 },
    SCOUT:    { health: 3,  damage: 1.5, speed: 1.8, range: 30,  attackRate: 1.5, isMelee: true,  isRanged: false, isArea: false, isHealer: false },
    MILITIA:  { health: 1,  damage: 1,   speed: 0.3, range: 25,  attackRate: 0.8, isMelee: true,  isRanged: false, isArea: false, isHealer: false },
};

// ── Militia Promotion Tiers ──────────────────────────────────────────────────

export const MILITIA_PROMOTIONS = {
    BASE:      { health: 1,  damage: 1,   speedMult: 1.00, label: 'Militia'   },
    CONSCRIPT: { health: 3,  damage: 1.5, speedMult: 1.20, label: 'Conscript' },
    FOOTMAN:   { health: 5,  damage: 2,   speedMult: 1.00, label: 'Footman'   },
    // WARRIOR uses the full WARRIOR unit stats — see UNITS.WARRIOR
};

// ── Speed Scale ──────────────────────────────────────────────────────────────
// Converts the fractional speed values in UNITS/ENEMIES to pixels-per-second.
// Tune this to adjust overall game pace without touching individual unit speeds.
export const SPEED_SCALE = 150;

// ── Enemy Base Stats ─────────────────────────────────────────────────────────
// contactDPS: damage dealt to a melee unit while in contact with this enemy.
// castleDamage: HP removed from castle when this enemy reaches the left edge.

export const ENEMIES = {
    BASIC:  { health: 6,  speed: 0.25, reward: 10,  size: 18, firstWave: 1, contactDPS: 1.0, castleDamage: 1 },
    FAST:   { health: 3,  speed: 0.50, reward: 15,  size: 14, firstWave: 2, contactDPS: 0.8, castleDamage: 1 },
    TANK:   { health: 12, speed: 0.15, reward: 25,  size: 24, firstWave: 4, contactDPS: 2.0, castleDamage: 2 },
    ELITE:  { health: 18, speed: 0.20, reward: 50,  size: 26, firstWave: 7, contactDPS: 2.5, castleDamage: 3 },
    BOSS:   { baseHealth: 40, healthPerBoss: 15, speed: 0.10, reward: 100, size: 35, contactDPS: 3.0, castleDamage: 5 },
};

// ── Wave Difficulty Scaling ──────────────────────────────────────────────────

export const DIFFICULTY = {
    BASE_ENEMIES:               3,
    ENEMIES_PER_WAVE:           1.5,
    BASE_SPAWN_INTERVAL:        4.0,   // seconds
    MIN_SPAWN_INTERVAL:         0.8,   // seconds
    SPAWN_INTERVAL_REDUCTION:   0.15,  // seconds per wave
    HEALTH_SCALE_PER_WAVE:      0.08,  // +8% HP per wave
};

// ── Wave Structure ───────────────────────────────────────────────────────────

export const WAVES = {
    DURATION:               30,  // seconds
    PREVIEW_DURATION:       2,   // seconds for wave preview overlay
    BOSS_INTERVAL:          5,   // boss every Nth wave
    ARMORY_INTERVAL:        2,   // armory every Nth completed wave
    MODIFIER_BOSS_INTERVAL: 3,   // modifier choice every 3rd boss (waves 15, 30, 45...)
};

// ── Combo Chain ──────────────────────────────────────────────────────────────

export const COMBO = {
    BREAK_TIMEOUT: 4, // seconds before combo resets
    TIERS: [
        { min: 1,  max: 2,        label: 'x1',  damageBonus: 0,    speedBonus: 0,    militiaBonus: 0,    tempPromotion: false },
        { min: 3,  max: 4,        label: 'x3',  damageBonus: 0.10, speedBonus: 0,    militiaBonus: 0,    tempPromotion: false },
        { min: 5,  max: 7,        label: 'x5',  damageBonus: 0.20, speedBonus: 0.15, militiaBonus: 0.25, tempPromotion: false },
        { min: 8,  max: 9,        label: 'x8',  damageBonus: 0.30, speedBonus: 0.25, militiaBonus: 0.40, tempPromotion: false },
        { min: 10, max: Infinity, label: 'x10', damageBonus: 0.40, speedBonus: 0.30, militiaBonus: 0,    tempPromotion: true  },
    ],
};

// ── Castle ───────────────────────────────────────────────────────────────────

export const CASTLE = {
    MAX_HEALTH:              20,
    PANIC_THRESHOLD:         0.25,   // below 25% = panic mode
    PANIC_SPEED_BONUS:       0.15,
    PANIC_ATTACK_SPEED_BONUS: 0.10,
    PANIC_SCORE_MULTIPLIER:  1.5,
};

// ── Word Validation ──────────────────────────────────────────────────────────

export const VALIDATION = {
    MIN_LENGTH: 4,
};

// ── Scoring ──────────────────────────────────────────────────────────────────

export const SCORING = {
    BASE_KILL_MULTIPLIER: 1,   // multiplied by enemy.reward
    COMBO_SCORE_BONUS:    0.1, // +10% score per combo level above 1
};
