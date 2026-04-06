# GlyphGuard v2 — Architecture Document
### Roguelike Typing Defense Game
**Status:** Final — Ready for Build  
**Platform:** Modular JavaScript (ES modules), bundled to single file for deployment  
**Hosting:** Static site (GitHub Pages / Vercel / Netlify) + Supabase for leaderboard  
**Target:** 60fps, responsive (800–1600px), persistent online leaderboard  
**Dev Tool:** Claude Code (primary), Claude Chat (design/planning), GitHub (version control)

---

## 1. CORE GAME LOOP (unchanged from v1, refined)

```
Player types a word
  → Validation pipeline (length ≥ 4, not used before, not a plural, in dictionary, matches a pattern)
  → If multiple unit patterns match: quick selection UI appears (player picks one)
  → ONE unit spawns on the battlefield with stats based on word length tier
  → If NO pattern matches (but word is valid): a weak generic "Militia" unit spawns instead
  → Unit auto-assigned to most threatened lane
  → Unit automatically engages enemies marching toward the castle
  → Enemies killed = score + gold
  → Survive 30-second waves → surviving units carry to next wave at 50% HP
  → Every 2 waves: Armory (choose 1 of 3 upgrades)
  → Every 5 waves: Boss wave
  → Every 3rd boss (waves 15, 30, 45...): Player chooses 1 of 2 Difficulty Modifiers (permanent)
  → Game ends when castle health = 0
  → Score submitted to persistent shared leaderboard
```

---

## 2. DICTIONARY SYSTEM

### Source
dwyl/english-words (`words_alpha.txt`) — ~479,000 raw entries.

### Filtering Pipeline (applied at build time)
1. Strip whitespace, normalize to lowercase
2. Remove entries shorter than 4 letters
3. Remove entries containing non-alpha characters (hyphens, apostrophes, spaces)
4. Remove obvious junk (single repeated chars like "aaaa", abbreviations)
5. No maximum length cap — all valid 4+ letter words are kept

**Estimated result: ~270,000–350,000 words** (the bulk of the list is 4+ letters already).

### Smart Plural Detection (runtime)
Instead of blanket-rejecting words ending in 's', we apply a simple heuristic:

```
function isLikelyPlural(word, dictionary) {
    if (!word.endsWith('s')) return false;
    if (word.endsWith('ss')) return false;       // GRASS, BOSS, MOSS — not plurals
    if (word.endsWith('us')) return false;        // CACTUS, FOCUS, BONUS — not plurals
    if (word.endsWith('is')) return false;        // BASIS, OASIS — not plurals
    if (word.endsWith('ous')) return false;       // FAMOUS, NERVOUS — adjectives
    if (word.endsWith('ness')) return false;      // DARKNESS, KINDNESS — nouns
    if (word.endsWith('less')) return false;      // CARELESS — adjectives
    if (word.endsWith('ies')) {
        // BERRIES → BERRY (ies → y replacement)
        const stem = word.slice(0, -3) + 'y';
        return dictionary.has(stem);
    }
    if (word.endsWith('es')) {
        // BOXES → BOX, WISHES → WISH
        const stem1 = word.slice(0, -2);          // remove 'es'
        const stem2 = word.slice(0, -1);          // remove just 's' (CAUSES → CAUSE)
        return dictionary.has(stem1) || dictionary.has(stem2);
    }
    // Default: CATS → CAT
    const stem = word.slice(0, -1);
    return dictionary.has(stem);
}
```

This correctly allows: GRASS, ACROSS, CHAOS, PLUS, BONUS, NERVOUS, DARKNESS, ALWAYS, COMPASS.  
This correctly rejects: CATS (CAT exists), BOXES (BOX exists), BERRIES (BERRY exists).

### Embedding Strategy
The dictionary gets baked directly into the HTML file as a compressed JavaScript string. At ~7 characters average per word × 300k words = ~2.1MB of raw text. Approaches to keep file size manageable:

**Option A — Full Embed (~2.1MB raw, ~2.5MB in HTML):** Simple, zero network dependency. The browser handles it fine — a 3MB HTML file loads in under a second on any modern connection. The `Set` constructor from a split string is fast (~200ms).

**Option B — Curated Subset (80k words, ~600KB):** Hand-pick the most recognizable/common words. Smaller file, but risks frustrating players who type a valid word and get rejected.

**Recommendation: Option A.** File size is a one-time load cost, and rejecting valid words is the #1 frustration in word games. We go with the full dictionary.

### Runtime Structure
```javascript
// On game load (once):
const DICTIONARY = new Set(RAW_WORDS.split('\n'));  // O(n) build, O(1) lookup

// Validation (~0.1ms per word):
function validateWord(word) { return DICTIONARY.has(word.toLowerCase()); }
```

---

## 3. WORD LENGTH TIERS

Since we've removed the 8-letter max, longer words should feel meaningfully more powerful. However, because a single word can only ever summon ONE unit (see Section 4), the tier system is purely about making that one unit stronger — not about spawning armies.

This creates a real-time strategic tradeoff: typing "BARK" takes 1 second and gives you a baseline Warrior immediately, while typing "CONSTELLATION" takes 4–5 seconds but produces a significantly buffed unit. Under wave pressure, fast short words may save you more than one slow powerhouse.

| Tier | Length | Effect | Example |
|------|--------|--------|---------|
| **Common** | 4–5 letters | Standard unit, base stats | BARK, FLAME |
| **Strong** | 6–7 letters | +15% damage, +15% health | BRIDGE, CAPTAIN |
| **Elite** | 8–9 letters | +30% stats, unit spawns with a 2-second damage shield | MOUNTAIN, CHAMPION |
| **Legendary** | 10–11 letters | +50% stats | REVOLUTION, BLACKSMITH |
| **Mythic** | 12+ letters | +70% stats, small AoE damage pulse on spawn | CONSTELLATION, EXTRAORDINARY |

Note: A Mythic word that matches 4 different unit patterns summons **one** main unit at Mythic tier (player's choice) **plus 3 Militia** as bonus spawns. The advantage of matching multiple patterns is both *flexibility* (choosing the best unit for the situation) and *quantity* (bonus Militia escorts). This makes long, versatile words feel genuinely epic without producing multiple elite units from a single keystroke.

---

## 4. PATTERN VARIANT SYSTEM (7 variants × 8 units = 56 patterns)

At game start, one variant is randomly selected per unit type. The player discovers each unit's current pattern the first time they unlock it (shown in Armory + HUD). This is the core roguelike element — every run demands a different vocabulary strategy.

### CRITICAL RULE: One Word = One Main Unit + Bonus Militia
Each valid word summons exactly ONE main unit of the player's choice. Additionally, every *other* pattern the word matched spawns a Militia unit as a bonus. This makes vocabulary breadth tangibly powerful — a long versatile word that matches 4 patterns produces 1 elite unit + 3 Militia escorts.

- If the word matches exactly one unlocked unit's pattern → that unit spawns instantly. No Militia bonus.
- If the word matches 2+ patterns → a quick selection bar appears showing the matching unit icons. Player picks one as the main summon (receives full word-tier bonuses). Each remaining match spawns one Militia unit (base Militia stats, no word-tier bonus — but affected by Militia Promotions and combo buffs, see Sections 6 and 7). Wave timer PAUSES during selection.
- If the word matches zero patterns but IS a valid dictionary word → a single Militia unit spawns (no selection needed).
- Invalid words (not in dictionary, too short, plural, already used) → rejection message, no unit.

### Design Principles for Patterns
- Every pattern must have **at least 5,000+ valid words** in the dictionary (ensures playability)
- Patterns should be **intuitively describable** in a short phrase ("starts with a vowel")
- Patterns should vary in **what dimension of the word they constrain** (starting letter, internal structure, length, letter frequency, etc.)
- Some patterns should be broadly easy, others narrowly hard — this creates natural difficulty variance between runs

### Unit Patterns

**WARRIOR** (melee, medium stats — the reliable frontliner)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | Starts with a consonant | Broadest — huge word pool |
| 2 | Contains R or L | Liquid consonants — very common |
| 3 | Contains B, T, or K | Plosive consonants |
| 4 | Has exactly 2 vowels | Forces moderate-length words |
| 5 | Contains a double letter (ee, ll, tt...) | Repeated characters |
| 6 | Ends with a consonant | Very broad |
| 7 | First letter is in A–M | First half of alphabet |

**ARCHER** (ranged, moderate — the versatile damage dealer)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | Contains at least 3 vowels | Vowel-rich words |
| 2 | Starts with a vowel | A, E, I, O, U openers |
| 3 | Contains TH, SH, or CH | Common digraphs |
| 4 | Has 5+ unique letters | Letter diversity |
| 5 | Ends with E | Very common English ending |
| 6 | Contains N and a vowel next to each other | AN, EN, IN, ON, UN patterns |
| 7 | Second letter is a vowel | Structural constraint |

**CAVALRY** (fast melee, high damage — the glass cannon rusher)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | 4–6 letters only | Short words = fast units |
| 2 | No repeated letters anywhere | Every letter unique |
| 3 | Contains a rare letter (Q, X, Z, J, or V) | Unusual vocabulary |
| 4 | Starts and ends with the same letter type (both vowels or both consonants) | Structural symmetry |
| 5 | All vowels are the same letter (e.g., "blast" = only A) | Vowel monotone |
| 6 | Contains exactly 1 vowel | Consonant-heavy words |
| 7 | Alternates vowel/consonant or consonant/vowel throughout | Perfect alternation |

**DEFENDER** (tank, very high HP — the wall)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | 6+ letters | Longer = sturdier |
| 2 | Contains W or D | "Wall"/"Defense" letters |
| 3 | Starts with B, D, F, G, or H | Hard-onset sounds |
| 4 | Contains 3+ consonants in a row | Consonant clusters (STRENGTH) |
| 5 | Ends with ND, RD, LD, or TH | Strong ending clusters |
| 6 | First letter comes before last letter in alphabet | Alphabetical framing |
| 7 | Contains both a vowel pair (two vowels adjacent) and 5+ letters | Structural complexity |

**SIEGE** (artillery, area damage — the slow powerhouse)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | 7+ letters | Big words for big damage |
| 2 | Contains at least 4 vowels | Vowel-saturated |
| 3 | Starts with S, C, or P | Siege-class initials |
| 4 | Contains both R and S | Dual-consonant requirement |
| 5 | 8+ letters | Even bigger requirement |
| 6 | Contains a 3+ letter substring that's all consonants | Cluster power |
| 7 | Has at least 3 distinct vowels (e.g., A, E, and O all present) | Vowel diversity |

**MAGE** (magic caster, area spells — the exotic spellcaster)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | Contains X, Z, Q, or PH | Rare/arcane letter combos |
| 2 | Starts with a vowel AND ends with a vowel | Vowel bookends |
| 3 | More vowels than consonants | Vowel-dominant |
| 4 | Contains Y | The mystical letter |
| 5 | No letter appears more than once | Complete uniqueness |
| 6 | Has at least 3 of the 5 vowels (A, E, I, O, U) present | Poly-vowel |
| 7 | Even number of letters | Numerical symmetry |

**HEALER** (support, heals allies — the sustain engine)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | Contains a vowel pair: EA, OU, AI, EI, or OA | Harmonious vowel combos |
| 2 | Vowel count equals consonant count (±1) | Balance/harmony |
| 3 | Starts with H, L, M, or W | Soft-onset sounds |
| 4 | Every vowel in the word is the same (all A's, all E's, etc.) | Vowel purity |
| 5 | Contains exactly 2 distinct vowel types | Controlled vowel palette |
| 6 | Ends with a vowel | Open-ended sound |
| 7 | 5–7 letters | Moderate, balanced length |

**SCOUT** (ultra-fast recon — the speedster)
| # | Pattern | Description |
|---|---------|-------------|
| 1 | 4–5 letters only | Ultra-short = ultra-fast |
| 2 | No E, T, A, or S (the 4 most common letters) | Avoids common letters |
| 3 | All letters unique, no repeats | Clean efficiency |
| 4 | Starts with N–Z | Second half of alphabet |
| 5 | More consonants than vowels by 2+ | Consonant-heavy |
| 6 | Contains W, V, or K | Uncommon consonants |
| 7 | 4 letters exactly | Shortest possible |

---

## 5. DIFFICULTY MODIFIER SYSTEM (Player Choice)

After every 3rd boss wave (waves 15, 30, 45, 60...), the game pauses and presents **two** randomly drawn modifiers. The player **chooses one** to activate permanently. This transforms difficulty escalation from something that happens *to* you into a strategic decision — players who know their vocabulary strengths can play around them.

### Modifier Choice UI
The screen dims, two modifier cards appear side by side (similar to Armory layout). Each card shows: icon, name, one-line description of the effect, and a severity indicator (Medium / High). The player clicks one. It activates immediately and is permanently shown in the HUD for the rest of the run. Active modifiers **stack** with previously chosen ones.

### Modifier Pool (two are randomly drawn each time; player picks one)

| Modifier | Effect | Severity |
|----------|--------|----------|
| **Vowel Lockout** | A randomly chosen vowel (A, E, I, O, or U) is banned — any word containing it is rejected | High |
| **Double Trouble** | Words with any repeated letter are rejected (LETTER has two T's → rejected) | High |
| **Short Fuse** | Maximum word length drops by 2 (first application: max becomes 12, stacks further) | Medium |
| **Ghost Letters** | 2 random consonants are "dead" — they're ignored during pattern matching (if your Warrior needs "contains R" and R is ghosted, you need to match without it) | Medium |
| **Alphabet Decay** | A random 3-letter consecutive span is banned entirely (e.g., J-K-L — any word containing J, K, or L is rejected) | High |
| **Consonant Drought** | Words must contain at least 40% vowels (rounded up) | Medium |
| **Stale Words** | Words sharing 3+ letters with the previous word you typed are rejected (forces dramatic vocabulary shifts) | Medium |
| **Reverse Pressure** | Words must be typed in under 5 seconds from first keystroke to Enter, or they fizzle (adds time pressure to longer words) | High |

### Modifier Selection Rules
- Two unique modifiers are drawn from the remaining pool each time
- The unchosen modifier goes back into the pool (it may appear again later)
- Vowel Lockout can only be chosen once (removed from pool after selection — a second lockout could make the game impossible)
- Alphabet Decay can stack but never overlap letter ranges with a previously active Alphabet Decay
- Maximum 5 active modifiers total (after 5, no further modifier choices are offered — the game is hard enough)
- Each modifier has a unique pixel-art icon and color for HUD display

---

## 6. ARMORY SYSTEM

Every 2 completed waves (starting after wave 2), the game pauses and presents the Armory screen. The player chooses 1 of 3 randomly offered upgrades.

### Upgrade Categories

**Unit Unlocks** (offered until all 8 units are unlocked)
- "Unlock Cavalry" / "Unlock Defender" / etc.
- Prioritized early — at least 1 unlock option appears if units remain locked

**Stat Boosts** (always available)
- +15% damage to all [unit type]
- +20% health to all [unit type]
- +10% attack speed to all [unit type]
- +15% movement speed to all [unit type]

**Militia Promotions** (appears after wave 6, sequential upgrades)
- **Militia → Conscript:** All Militia permanently upgraded to Conscript (3 HP, 1.5 damage, +20% speed). Appears first.
- **Conscript → Footman:** All Militia permanently upgraded to Footman (5 HP, 2 damage, equivalent to Common-tier Warrior). Appears only after Conscript promotion is taken.
- **Warrior Conversion:** All Militia permanently replaced by full Warrior units (uses current Warrior stats). This is the jackpot — extremely rare, only appears after Footman promotion is taken AND after wave 20. Appears at most once per run. Once taken, all future bonus Militia spawns from multi-match words are Warriors instead.

**Global Perks** (rarer, more impactful)
- **Thick Walls:** +5 castle max health (and heals 5)
- **Vocabulary Surge:** Next 5 words summon an extra Militia alongside whatever they normally produce
- **Clean Slate:** Resets the used-words list entirely — every word becomes available again. Appears at most ONCE per run. Extremely powerful in late-game when difficulty modifiers are squeezing the available word pool. Weighted very low (~5% chance per slot when eligible).
- **Combo Starter:** Next combo chain starts at x3 instead of x1
- **Fortify Lane:** One random lane gets a permanent slow field (enemies in that lane move 30% slower)

### Offer Logic
- Always show 3 options
- If unlockable units remain, at least 1 option is an unlock
- No duplicate offers in the same Armory screen
- Militia Promotions follow strict sequence: Conscript → Footman → Warrior Conversion. Only the next available step can appear.
- Warrior Conversion: requires Footman already taken AND wave 20+ AND has not appeared before. Weight ~8% per slot when eligible.
- Clean Slate: appears at most once per run. Weight ~5% per slot when eligible, minimum wave 8.
- Other global perks: ~15% chance per slot
- Stat boosts fill remaining slots

---

## 7. COMBO CHAIN SYSTEM

Rewards fast, accurate typing with escalating bonuses. The combo system interacts meaningfully with the multi-match Militia system — fast play doesn't just buff your main units, it makes your bonus Militia spawns significantly more dangerous.

```
Combo starts at x1 (every valid word adds +1 to the chain).
Combo breaks if: 4+ seconds pass without a valid word, OR an invalid word is submitted.

Bonuses per combo level:
  x1–x2:   No bonus (building up)
  x3–x4:   +10% damage for all spawned units (main + Militia)
  x5–x7:   +20% damage, +15% speed. Militia spawns get +25% stats on top of their base/promotion tier.
  x8–x9:   +30% damage, +25% speed, trail particles on units. Militia get +40% stats.
  x10+:    +40% damage, +30% speed. Militia automatically spawn one promotion tier higher
            (base Militia → Conscript, Conscript → Footman, Footman → Warrior).
            This is temporary (combo duration only) and stacks with permanent Militia Promotions.
```

Visual feedback: Combo counter in the HUD with escalating glow intensity. At x5+ the counter pulses. At x10+ it catches fire (pixel fire effect).

The combo-Militia interaction creates a powerful feedback loop: skilled fast typing → high combo → stronger Militia from multi-match words → better wave defense → more time to type → higher combo. This rewards the core skill (typing) at every level without requiring any Armory investment.

---

## 8. WAVE & ENEMY SYSTEM

### Wave Structure
- Each wave lasts 30 seconds
- Enemies spawn from the right edge of the canvas within their assigned lane
- Spawn rate accelerates within each wave and across waves
- New lane added every 2 waves (start with 2, max 6 — so 6 lanes by wave 10)

### Wave Preview (2-second overlay)
At the start of each wave, before enemies begin spawning, a brief overlay appears for 2 seconds showing what's coming. The preview shows enemy type icons with counts (e.g., "Wave 7: Basic ×6, Fast ×4, Tank ×2") plus the total enemy count. During the preview, the wave timer has NOT started yet — it begins when the preview disappears. This gives the player a moment to mentally prepare: if they see Tanks incoming, they can start thinking of Siege or Cavalry words. On boss waves, the preview shows the boss archetype name and icon prominently.

### Lane Bounds (CRITICAL — enforced at all times)
All gameplay entities are strictly bounded within the playable area:

```
PLAYABLE_TOP = HUD_HEIGHT + 60px (minimum gap below the top HUD bar)
PLAYABLE_BOTTOM = CANVAS_HEIGHT - INPUT_AREA_HEIGHT - 80px (minimum gap above the word input)
LANE_HEIGHT = (PLAYABLE_BOTTOM - PLAYABLE_TOP) / activeLaneCount
lane[i].centerY = PLAYABLE_TOP + (i × LANE_HEIGHT) + (LANE_HEIGHT / 2)
```

Enforcement rules:
- Enemies spawn at x = CANVAS_WIDTH (right edge), y = their lane's centerY. They NEVER spawn outside the playable area.
- Enemy movement is strictly horizontal (left along their lane). No vertical drift allowed.
- Units spawn at x = CASTLE_X (left side), y = their assigned lane's centerY.
- All entity positions are clamped: `entity.y = clamp(entity.y, PLAYABLE_TOP, PLAYABLE_BOTTOM)` every frame.
- When lanes are added mid-game (every 2 waves), all lane centerY positions are recalculated and existing entities smoothly interpolate to their new lane positions over 0.5 seconds.
- Projectiles are culled when they leave the canvas bounds in any direction.

### Enemy Types

| Type | Health | Speed | Reward | Size | First Appears |
|------|--------|-------|--------|------|---------------|
| Basic | 6 | 0.25 | 10 | 18px | Wave 1 |
| Fast | 3 | 0.50 | 15 | 14px | Wave 2 |
| Tank | 12 | 0.15 | 25 | 24px | Wave 4 |
| Elite | 18 | 0.20 | 50 | 26px | Wave 7 |
| Boss | varies | 0.10 | 100 | 35px | Every 5th wave |

### Boss System (4 Archetypes)
Boss health scales: 40 + (bossNumber × 15). So boss #1 = 55 HP, boss #2 = 70 HP, etc. Each boss wave randomly selects one of four archetypes, each demanding a different tactical response:

**Shield Boss** — Periodically activates a damage-immune barrier for 3 seconds (indicated by a glowing outline), then drops it for 5 seconds. Requires sustained DPS — burst damage is wasted during shield phase. The player needs to time their summons to have units ready when the shield drops. Best countered by: Archer, Siege (sustained ranged pressure).

**Splitter Boss** — When killed, splits into 3 Fast-type minions (each with 50% of a normal Fast enemy's health). If the player dumps everything into killing the boss quickly without reserves, the minions can overwhelm. Rewards having spread-out forces across the lane. Best countered by: Mage (area damage cleans up minions), Defender (tanks the swarm).

**Charger Boss** — Moves at normal boss speed but every 4 seconds performs a dash at 3× speed for 1 second, closing distance rapidly. Melee units caught in the dash path take double damage. Best countered by: Defender (absorbs dash hits), ranged units positioned far back.

**Healer Boss** — Regenerates 2% max HP per second and all non-boss enemies in the same lane gain +25% movement speed while the Healer Boss is alive. Must be focused down quickly before it undoes your damage and its speed aura overwhelms your defenses. Best countered by: Cavalry (fast high-damage to burst it down), Siege (high single-target damage).

### Wave Difficulty Curve
```
enemiesPerWave = floor(3 + waveNumber × 1.5)
spawnInterval = max(0.8, 4.0 - waveNumber × 0.15) seconds
enemyHealthMultiplier = 1 + (waveNumber × 0.08)
```

---

## 9. UNIT COMBAT SYSTEM

### Combat Types

**Melee** (Warrior, Cavalry, Defender): Unit moves toward nearest enemy in its lane. On contact, deals damage at its attack rate. Takes damage from enemy contact.

**Ranged** (Archer): Stays near spawn point, fires projectile at nearest enemy within range. Projectiles travel at fixed speed, deal damage on hit.

**Area** (Siege, Mage): Fires at a target location (nearest enemy cluster). On impact, deals damage to all enemies within blast radius.

**Healing** (Healer): Doesn't attack enemies. Periodically heals the lowest-health allied unit within range. Heal amount scales with word tier.

### Unit Lifecycle
1. Word typed → validation pipeline → pattern matching
2. If multiple patterns match: quick selection bar appears (wave timer pauses). Player picks one unit type.
3. If no pattern matches but word is valid: a **Militia** unit spawns instead (see below)
4. Unit spawns at the castle end of the **most threatened lane** (auto-assigned based on: most enemies / lowest friendly unit count / nearest enemy to castle — weighted formula)
5. Unit moves forward, engages enemies per its combat type
6. Unit dies when health reaches 0 (death particle effect)
7. **Between waves: surviving units persist but lose 50% of their current HP** (rounded down, min 1). This rewards strong play with carryover value but prevents runaway snowballing.

### The Militia Unit (Dual Role: Fallback + Multi-Match Bonus)
Militia units appear in two situations, making them a central part of the game's economy:

**As a fallback:** When a valid dictionary word doesn't match any unlocked unit's pattern, a single Militia spawns. This ensures every valid word *does something*.

**As multi-match bonuses:** When a word matches 2+ unit patterns, the player picks one main unit, and each remaining match spawns one Militia. A word matching 4 patterns = 1 main unit + 3 Militia. This is the primary source of Militia in skilled play.

```
Militia base stats: { health: 1, damage: 1, speed: 0.3, range: 25, isMelee: true }
```

Militia are intentionally fragile at base level — they're expendable escorts and meat shields, not a primary fighting force. However, three systems can dramatically increase their value over the course of a run:

**Militia Promotion tiers** (via Armory upgrades — see Section 6):
  Militia (base)  → Conscript (3 HP, 1.5 dmg, +20% speed)
  Conscript       → Footman (5 HP, 2 dmg, ≈ Common-tier Warrior)
  Footman         → Warrior (full Warrior stats — rare late-game jackpot)

**Combo buffs** (see Section 7): At x5+ combo, Militia get +25% stats. At x10+, Militia temporarily spawn one promotion tier higher.

**Word length tier interaction:** Fallback Militia (no pattern match) DO receive word-tier bonuses (+70% on a Mythic word makes even base Militia somewhat useful). Multi-match bonus Militia do NOT receive word-tier bonuses — they spawn at their current promotion tier's base stats (plus any combo buffs).

This creates a meaningful Armory investment path: a player who types long, versatile words generates many Militia, so investing in Militia Promotions pays dividends. A player who types short, targeted words generates fewer Militia and should invest in stat boosts for their main units instead.

### Rejection Feedback (Category-Level)
When a word fails validation, the input area briefly flashes red and shows a short reason:
- "Too short" (under 4 letters)
- "Already used" (in the used-words set)
- "Plural detected" (smart plural check triggered)
- "Not in dictionary" (not in word list)

These are category-level messages — specific enough to learn from, brief enough not to break typing flow. No pattern-match feedback here because valid-but-no-match words still produce a Militia, so there's no "no pattern match" rejection.

---

## 10. RENDERING SYSTEM

### Canvas Setup
- Responsive sizing: `max(800, min(1600, windowWidth - 40))` × `max(500, min(900, windowHeight × 0.7))`
- devicePixelRatio scaling for retina crispness
- Debounced resize handler

### Visual Layers (drawn back-to-front)
1. **Background** — dark gradient with subtle grid lines (battlefield feel)
2. **Lanes** — horizontal tracks with subtle borders, numbered
3. **Castle** — left side, pixel art with health bar
4. **Units** — colored geometric shapes (v1), with size/color per type
5. **Enemies** — distinct shapes/colors per type, health bars above
6. **Projectiles** — small fast-moving dots/squares
7. **Effects** — particles (damage, death, spawn), screen shake, combo fire
8. **HUD** — top bar: wave counter, timer, score, combo, health, active modifiers
9. **Word Input** — bottom area: current typed word, feedback messages
10. **Word Echo** — floating text above recently spawned units, fading out

### 8-Bit Aesthetic Rules
- No anti-aliasing (use `ctx.imageSmoothingEnabled = false`)
- Sharp 90° geometry only
- Monospace font: `'Courier New', 'Monaco', 'Consolas', monospace`
- Bold + letter-spacing: 2px for retro feel
- High contrast palette on dark background
- Square particles only
- Screen shake on boss hits and castle damage

### Color Palette
```
Background:   #0a0e1a (deep navy-black)
Primary UI:   #00ff41 (terminal green)
UI Shadow:    #008f11 (dark green)
Health:       #ff4444 (red)
Score:        #ffdd44 (gold)
Wave:         #44ffaa (teal-green)
Combo:        #ff8844 (orange, intensifies with level)
Castle:       #6688cc (steel blue)
```

Unit colors: Each unit type gets a distinct bright color for instant recognition.

---

## 11. LEADERBOARD SYSTEM (Supabase Backend)

The leaderboard uses a hosted Supabase Postgres database with REST API, enabling a real cross-player leaderboard accessible from any domain. No custom server code needed — the game's client-side JavaScript communicates directly with Supabase's auto-generated REST endpoints.

### Supabase Setup (one-time)
Create a `scores` table in Supabase with the following schema:

```sql
CREATE TABLE scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name TEXT NOT NULL CHECK (char_length(player_name) BETWEEN 3 AND 12),
    score INTEGER NOT NULL CHECK (score >= 0),
    wave INTEGER NOT NULL CHECK (wave >= 1),
    modifiers_active INTEGER DEFAULT 0,
    words_used INTEGER DEFAULT 0,
    longest_word TEXT DEFAULT '',
    militia_promotions INTEGER DEFAULT 0,     -- tracks how far the player invested in Militia
    boss_archetypes_defeated TEXT DEFAULT '[]', -- JSON array of boss types beaten
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anyone to submit scores (anonymous insert)
CREATE POLICY "Anyone can submit scores"
    ON scores FOR INSERT
    WITH CHECK (true);

-- Allow anyone to read the leaderboard
CREATE POLICY "Anyone can view scores"
    ON scores FOR SELECT
    USING (true);

-- Index for fast leaderboard queries
CREATE INDEX idx_scores_score_desc ON scores (score DESC);
```

### Client-Side Integration
The game communicates with Supabase via its REST API. The Supabase URL and anonymous key are public (they're designed to be — row-level security handles access control).

```javascript
// Configuration (set during project setup, safe to expose in client code)
const SUPABASE_URL = 'https://yourproject.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

// Submit a score after game over
async function submitScore(entry) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                player_name: entry.name,
                score: entry.score,
                wave: entry.wave,
                modifiers_active: entry.modifiers,
                words_used: entry.wordsUsed,
                longest_word: entry.longestWord,
                militia_promotions: entry.militiaPromotions,
                boss_archetypes_defeated: JSON.stringify(entry.bossesDefeated)
            })
        });
        return response.ok;
    } catch (err) {
        console.error('Score submission failed:', err);
        return false;  // Game continues gracefully even if submission fails
    }
}

// Fetch top 20 scores for leaderboard display
async function fetchLeaderboard() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/scores?select=*&order=score.desc&limit=20`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );
        return response.ok ? await response.json() : [];
    } catch (err) {
        console.error('Leaderboard fetch failed:', err);
        return [];  // Show empty leaderboard rather than crashing
    }
}
```

### Leaderboard Display
The leaderboard is shown on the main menu screen and the game-over screen. It displays the top 20 scores sorted by score descending. Each entry shows: rank, player name, score, wave reached, and longest word used. If the current player's score made the top 20, their row is highlighted. If the leaderboard fetch fails (network error, Supabase down), the game shows "Leaderboard unavailable" gracefully rather than blocking gameplay.

### Offline / Fallback Behavior
If the player has no internet connection, scores are cached in localStorage and submitted on the next successful game-over. The game checks for cached scores on load and flushes them if a connection is available. This ensures no score is ever lost, even on flaky connections.

### Future: Anti-Cheat (if needed)
If score manipulation becomes an issue, the migration path is: add a Supabase Edge Function that validates submissions server-side (e.g., "score of 50,000 on wave 8 is impossible — reject"). The client code doesn't change — only the INSERT policy is updated to route through the function. Alternatively, migrate the leaderboard endpoint to a Railway-hosted Express server with full validation logic.

---

## 12. STATE MACHINE

```
MENU ──────────→ PLAYING ──────→ WAVE_COMPLETE
  │                 │  ↑               │
  │                 │  │               ↓
  │                 ↓  │         ARMORY (every 2 waves)
  │              PAUSED │              │
  │                 │   │              ↓
  │                 ↓   │         MODIFIER_CHOICE (every 3rd boss wave)
  │              PLAYING ←─────── or back to PLAYING
  │                 │
  │                 │ (during typing)
  │                 ↓
  │            UNIT_SELECT ──→ PLAYING (brief: multi-match resolution)
  │                 
  │              PLAYING
  │                 │
  │                 ↓
  │            GAME_OVER ──→ LEADERBOARD ──→ MENU
  │                                           ↑
  └── LEADERBOARD ────────────────────────────┘
```

### State Transitions
- MENU → PLAYING: Player clicks "Start Game" (name entry first)
- PLAYING → PAUSED: Player presses Escape
- PLAYING → UNIT_SELECT: Word matches multiple unlocked unit patterns. Wave timer PAUSES. Selection bar appears. Player picks a unit type. Transitions back to PLAYING instantly.
- PLAYING → WAVE_COMPLETE: 30-second timer expires and all remaining enemies are cleared/fled
- WAVE_COMPLETE → ARMORY: Every 2nd wave
- WAVE_COMPLETE → MODIFIER_CHOICE: After every 3rd boss wave (15, 30, 45...), shown AFTER the Armory if both trigger on the same wave
- WAVE_COMPLETE → PLAYING: If neither Armory nor Modifier triggers
- MODIFIER_CHOICE → PLAYING: Player selects one of two modifiers
- PLAYING → GAME_OVER: Castle health ≤ 0
- GAME_OVER → LEADERBOARD: Automatic after score save
- LEADERBOARD → MENU: Player clicks "Play Again" or "Main Menu"

---

## 13. RESOLVED DESIGN DECISIONS

All original design questions have been resolved, plus several additional design changes from collaborative review:

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Q1: Unit Persistence** | Partial persistence — units lose 50% HP between waves | Rewards strong play without enabling runaway snowball armies |
| **Q2: Lane Targeting** | Auto-assign to most threatened lane | Keeps focus on typing; reduces friction. Threat = weighted formula of enemy count, nearest enemy distance, and friendly unit deficit |
| **Q3: Typing Cooldown** | Always active, no cooldown | Speed-typing IS the skill. Combo system already rewards it; no need to throttle. Can revisit in playtesting if it trivializes difficulty |
| **Q4: Rejection Feedback** | Category-level messages ("Already used", "Plural detected", "Too short", "Not in dictionary") | Specific enough to learn from, brief enough not to interrupt flow |
| **Q5: No Pattern Match** | Spawn a weak Militia unit | Every valid word does *something*, which feels better than rejection |

### Additional Design Changes (from collaborative review)

**Multi-Match Militia Rule:** One word summons one main unit (player's choice) PLUS one Militia per additional pattern matched. A word matching 4 patterns = 1 elite unit + 3 Militia. This makes vocabulary breadth produce both flexibility (choosing the best unit) and quantity (bonus escorts), without spawning multiple elite units.

**Difficulty Modifiers as Player Choice:** Changed from random imposition to a choice between two options. Adds strategy to difficulty escalation — players who know their vocabulary strengths can play around them.

**Word Tiers Rebalanced:** Bonuses reduced (max +70% instead of +100%). Multi-unit spawning from tier bonuses removed entirely — tier bonuses only apply to the main unit, not bonus Militia.

**Armory Rework:**
- Removed "Word Recall" (unlocking a single word is negligible in a 300k dictionary) → Replaced with **Clean Slate** (full used-word reset, once per run, very rare).
- Removed "Wild Card" (bypassing pattern matching once is weak when Militia fallback already exists) → Replaced with **Militia Promotion chain** (Militia → Conscript → Footman, plus a rare late-game Warrior Conversion jackpot).

**Wave Preview:** 2-second overlay at wave start showing incoming enemy types and counts. Timer doesn't start until preview ends.

**Boss Variety:** 4 distinct archetypes (Shield, Splitter, Charger, Healer) randomly selected each boss wave, each demanding different tactical responses.

**Enemy Bounds Enforcement:** All entities strictly clamped within the playable area between HUD and input. Lanes computed dynamically with guaranteed padding. No spawning or movement outside canvas bounds.

**Combo-Militia Interaction:** High combo levels buff bonus Militia spawns (+25% at x5, +40% at x8, temporary promotion tier at x10). Creates a feedback loop rewarding fast, accurate typing.

---

## 14. ADAPTIVE TUTORIAL SYSTEM

No separate tutorial mode. Instead, during the first game only (tracked via localStorage), contextual hints appear based on player behavior:

| Trigger | Hint |
|---------|------|
| No input for 5s during wave 1 | "Type a word and press Enter to summon a unit!" |
| First invalid word (too short) | "Words must be at least 4 letters long" |
| First plural rejection | "Plurals aren't allowed — try the singular form" |
| First pattern mismatch | "That word doesn't match any unit's pattern. Check the HUD for current patterns!" |
| First word used twice | "Each word can only be used once per game" |
| First successful summon | "Nice! [UnitType] summoned! It'll fight automatically" |
| Castle takes damage for first time | "Enemies that reach your castle deal damage — keep summoning defenders!" |
| First Armory screen | "Choose an upgrade! Unit unlocks give you more pattern options" |

Hints appear as brief toast notifications (2–3 seconds, non-blocking). After wave 3, hints stop entirely.

---

## 15. PANIC MODE

When castle health drops below 25% of max:
- Screen border pulses red (CSS animation or canvas overlay)
- All currently spawned units get +15% movement speed and +10% attack speed
- Score multiplier increases by 1.5x (rewards clutch play)
- HUD health display flashes
- "CRITICAL" text pulses near the castle

Panic mode deactivates if health is healed above 25% (via Healer units or Armory perks).

---

## 16. WORD ECHO SYSTEM

When a word successfully summons a unit:
1. The word appears as floating pixel text directly above the spawned unit
2. Text uses the unit's color, monospace font, small size
3. Fades out over 2 seconds while drifting slightly upward
4. Multiple echoes can exist simultaneously (one per recent summon)

This creates a satisfying visual trail of words across the battlefield during intense play.

---

## 17. PROJECT STRUCTURE & DEVELOPMENT WORKFLOW

### Repository Structure
```
glyphguard/
├── README.md                   # Project overview, play link, development notes
├── ARCHITECTURE.md             # This document — the complete game spec
├── package.json                # Dependencies: esbuild (bundler only, no runtime deps)
├── build.js                    # Build script: bundle modules → single HTML file
├── index.html                  # Shell HTML (canvas element, input area, minimal markup)
├── src/
│   ├── main.js                 # Entry point: imports all modules, initializes game
│   ├── config.js               # All constants: colors, sizes, unit stats, enemy stats
│   ├── state.js                # State machine: MENU, PLAYING, PAUSED, ARMORY, etc.
│   ├── input.js                # Keyboard capture, word input handling, feedback display
│   ├── dictionary.js           # Dictionary loading, validation pipeline, plural detection
│   ├── patterns.js             # All 56 pattern definitions, matching logic, variant selection
│   ├── canvas.js               # Canvas setup, responsive sizing, retina scaling, resize handler
│   ├── renderer.js             # Main draw loop, visual layers, 8-bit aesthetic enforcement
│   ├── hud.js                  # HUD rendering: score, wave, combo, health, modifiers, patterns
│   ├── entities/
│   │   ├── unit.js             # Unit base class, all 9 unit types (8 + Militia), tier bonuses
│   │   ├── enemy.js            # Enemy types (Basic, Fast, Tank, Elite), movement, lane bounds
│   │   ├── boss.js             # Boss archetypes (Shield, Splitter, Charger, Healer)
│   │   └── projectile.js       # Ranged projectiles, AoE explosions, healing pulses
│   ├── systems/
│   │   ├── combat.js           # Damage calculations, melee/ranged/area/healing logic
│   │   ├── waves.js            # Wave timer, enemy spawn scheduling, wave preview, difficulty curve
│   │   ├── lanes.js            # Lane management, bounds enforcement, threat calculation, auto-assign
│   │   ├── armory.js           # Upgrade generation, offer logic, Militia promotions, Clean Slate
│   │   ├── modifiers.js        # Difficulty modifier pool, stacking logic, word validation hooks
│   │   ├── combo.js            # Combo chain tracking, tier bonuses, Militia buff interaction
│   │   └── scoring.js          # Score calculation, tier multipliers, combo bonuses
│   ├── effects/
│   │   ├── particles.js        # Particle pool, spawn/death/damage effects, square particles only
│   │   ├── screenshake.js      # Screen shake on boss hits, castle damage
│   │   ├── wordecho.js         # Floating word text above spawned units
│   │   └── panic.js            # Panic mode (sub-25% health effects)
│   ├── ui/
│   │   ├── menu.js             # Main menu screen, name entry, leaderboard button
│   │   ├── gameover.js         # Game over screen, score summary, leaderboard display
│   │   ├── armoryui.js         # Armory selection screen (3 upgrade cards)
│   │   ├── modifierui.js       # Modifier choice screen (2 modifier cards)
│   │   ├── unitselectui.js     # Multi-match unit selection bar (inline, during wave)
│   │   └── tutorial.js         # Adaptive tutorial hint system (first game only)
│   └── services/
│       └── leaderboard.js      # Supabase API calls: submit score, fetch leaderboard, offline cache
├── data/
│   └── dictionary.txt          # Raw filtered dictionary (built from dwyl/english-words)
├── scripts/
│   └── build-dictionary.js     # Node script: downloads dwyl words, filters, outputs dictionary.txt
└── dist/                       # Build output (gitignored) — bundled for deployment
    ├── index.html
    └── (inlined JS + dictionary)
```

### Key Architecture Decisions for Modularity
Every module exports clean interfaces and imports only what it needs. The game state is a single shared object passed through function calls — not global variables scattered across files. This means Claude Code can work on `combat.js` without needing to hold `renderer.js` in context, and changes to one system don't silently break others.

The `config.js` file is the single source of truth for all tunable numbers (unit stats, enemy stats, wave timing, combo thresholds, Militia promotion stats, modifier parameters). When balance testing, you only edit this one file. Claude Code should be instructed to never hardcode balance numbers anywhere else.

The `dictionary.txt` file is pre-filtered at build time (not runtime). The build script inlines it as a JavaScript string constant in the final bundle. This keeps the runtime initialization fast (just split + Set construction, ~200ms) and means the deployed file has zero network dependencies for gameplay.

### Build Pipeline
```bash
# Install (one-time)
npm install esbuild

# Development: rebuild on file changes, serve locally
npx esbuild src/main.js --bundle --outfile=dist/bundle.js --watch --servedir=dist

# Production: minified single bundle
npx esbuild src/main.js --bundle --minify --outfile=dist/bundle.js
# Then inline bundle.js + dictionary into dist/index.html via build.js
```

The `build.js` script handles the final step of inlining the JavaScript bundle and the dictionary data into a single self-contained `index.html`. This file is what gets deployed to GitHub Pages (or Vercel/Netlify). It's also the file you can paste into Claude Chat as an artifact for testing.

### Development Workflow with Claude Code
**Session structure:** Each Claude Code session should focus on one build phase or feature from the build order (Section 18). Start the session by telling Claude Code to read `ARCHITECTURE.md` for context, then specify the feature to build.

**Example prompt for Claude Code:**
```
Read ARCHITECTURE.md for the full game spec.
Build Phase 1, Step 6: "Basic unit spawning — Warriors and Archers only, auto-assign to most threatened lane."
The relevant sections are: Section 4 (patterns — just Warrior and Archer for now), Section 9 (unit lifecycle and lane auto-assign), and Section 8 (lane bounds).
Create src/entities/unit.js and src/systems/lanes.js. Make sure all entity positions respect the lane bounds formula in Section 8.
```

**Commit cadence:** Commit after every working feature, not after every session. Use descriptive commit messages tied to the build order (e.g., "Phase 1.6: Basic unit spawning with lane auto-assign"). This gives you clean rollback points.

**Testing approach:** Claude Code can open the game in a browser and test basic functionality. For gameplay balance testing (pattern difficulty, wave pacing, Militia economy), you'll need to play the game yourself — this is inherently human judgment work. Keep a running log of balance observations to feed back into the design.

### Deployment
**Static hosting (game itself):** Push `dist/` to GitHub Pages (free, automatic on push to main) or connect the repo to Vercel/Netlify (also free, with preview deployments on PRs).

**Supabase (leaderboard):** Free tier. Create the project, run the SQL from Section 11, copy the URL + anon key into `src/services/leaderboard.js`. The Supabase project is separate from the game repo — it's a hosted service, not code you deploy.

**Custom domain:** Point your domain's DNS to whichever static host you use. GitHub Pages, Vercel, and Netlify all support custom domains with free HTTPS.

---

## 18. SUGGESTED BUILD ORDER

### Phase 1 — Core Engine (get something playable)
1. Canvas setup (responsive, retina, game loop with deltaTime, lane bounds enforcement)
2. State machine (Menu → Playing → Game Over, with UNIT_SELECT and MODIFIER_CHOICE states stubbed)
3. Dictionary loading and validation pipeline (including smart plural detection)
4. Pattern matching system (all 56 patterns)
5. Word input handling (keyboard capture, display, category-level rejection feedback)
6. Basic unit spawning (Warriors and Archers only, auto-assign to most threatened lane)
7. Basic enemy spawning and movement (Basic type only, strictly within lane bounds)
8. Simple combat (melee contact damage, ranged projectiles)
9. Castle health and game-over condition
10. Wave timer (30 seconds)

### Phase 2 — Full Gameplay Loop
11. All 8 unit types with full combat behaviors (including Healer aura, Siege AoE)
12. All 5 enemy types with proper scaling
13. Lane system (2 → 6 lanes, dynamic recalculation with entity interpolation)
14. Multi-match unit selection UI (UNIT_SELECT state — quick inline bar, wave timer pauses)
15. Multi-match Militia spawning (1 main unit + 1 Militia per extra match)
16. Militia unit type with base stats
17. Word length tier bonuses (applied to main unit only)
18. Armory system (unit unlocks + stat boosts + Militia Promotion chain)
19. Boss waves every 5th wave (4 archetypes: Shield, Splitter, Charger, Healer)
20. Wave preview overlay (2-second pre-wave display)
21. Between-wave unit persistence (50% HP loss for survivors)
22. Scoring system with combo chain (including combo-Militia buff interaction)

### Phase 3 — Roguelike Depth
23. Difficulty modifier choice system (2 options presented, player picks 1, stacking)
24. Global perks in Armory (Clean Slate, Fortify Lane, Vocabulary Surge, Combo Starter)
25. Warrior Conversion jackpot perk (late-game Armory rare)
26. Word Echo visual system
27. Panic Mode (sub-25% health triggers)
28. Adaptive tutorial (contextual hints for first game only)

### Phase 4 — Persistence & Polish
29. Leaderboard (shared persistent storage via window.storage)
30. Particle effects (spawn, death, damage, combo fire, Mythic AoE pulse)
31. Screen shake (boss hits, castle damage)
32. HUD polish (modifier icons, combo counter with fire effect, pattern display, wave preview)
33. Balance pass (playtest all 56 patterns — verify word counts, tune difficulty curve, test Militia economy, verify boss archetype fairness)

### Future (post-launch)
34. Audio system (Web Audio API, 8-bit procedural sounds)
35. More pattern variants (expand from 7 to 10+ per unit)
36. Achievements
37. Daily challenge mode (fixed seed)
38. Used words display panel (toggle-able, shows words + which unit they summoned)

---

## 19. PERFORMANCE BUDGET

### Targets
- 60fps with 50+ entities on screen
- Word validation < 1ms
- Dictionary load < 300ms
- State transitions < 16ms (one frame)
- No memory leaks over 60-minute sessions

### Optimization Strategies
- **Object Pooling:** Pre-allocate pools for particles (200), projectiles (100), floating text (30). Reuse instead of GC.
- **Set-based Dictionary:** O(1) word lookup.
- **Spatial Hashing:** For collision detection if entity count exceeds 100 (lane-based structure naturally partitions space, so this may not be needed).
- **Render Culling:** Don't draw entities outside the visible canvas area.
- **Delta-time normalization:** All movement scales with frame time, not frame count.

---

*End of architecture document. All sections are open for discussion and revision.*
