// scripts/build-dictionary.js
// Downloads dwyl/english-words words_alpha.txt, applies the build-time filter
// pipeline, and writes the result to data/dictionary.txt.
//
// Run once (or whenever you want to refresh the word list):
//   node scripts/build-dictionary.js
//
// NOTE ON MINIMUM LENGTH:
//   The dictionary file contains words of ALL lengths, including 1-3 letter words.
//   This is intentional: isLikelyPlural() needs short stems in the Set to detect
//   plurals like CATS (stem: CAT) and BOXES (stem: BOX).
//   The 4-letter minimum for GAMEPLAY is enforced at runtime in validateWord(),
//   not in this file.

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SOURCE_URL = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';
const OUT_PATH   = path.join(__dirname, '..', 'data', 'dictionary.txt');

// ── Build-time filter pipeline (Section 2) ────────────────────────────────────
// We keep ALL valid alpha words (no minimum length) so stem lookups work.
// Plurals are NOT removed — stems like 'cat' must exist to reject 'cats'.

function isValidEntry(word) {
    if (word.length < 1)        return false;
    if (!/^[a-z]+$/.test(word)) return false; // hyphens, apostrophes, digits, spaces
    if (/^(.)\1+$/.test(word))  return false; // single repeated char: aaaa, bbbb, cc
    return true;
}

// ── Download with redirect following ─────────────────────────────────────────

function download(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirectsLeft === 0) { reject(new Error('Too many redirects')); return; }
                resolve(download(res.headers.location, redirectsLeft - 1));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const t0 = Date.now();
    console.log(`Downloading ${SOURCE_URL} …`);

    const raw   = await download(SOURCE_URL);
    const lines = raw.split('\n');
    console.log(`  Raw entries: ${lines.length.toLocaleString()}`);

    const results = [];
    let tooShort = 0, nonAlpha = 0, junk = 0;

    for (const line of lines) {
        const word = line.trim().toLowerCase();
        if (!word) continue;
        if (word.length < 1)        { continue; }
        if (!/^[a-z]+$/.test(word)) { nonAlpha++; continue; }
        if (/^(.)\1+$/.test(word))  { junk++; continue; }
        results.push(word);
    }

    // Separate stats: how many are playable (4+ letters)?
    const playable = results.filter(w => w.length >= 4).length;
    const stems    = results.length - playable;

    console.log(`  Non-alpha removed:     ${nonAlpha.toLocaleString()}`);
    console.log(`  Junk removed:          ${junk.toLocaleString()}`);
    console.log(`  Total kept:            ${results.length.toLocaleString()}`);
    console.log(`    Playable (4+ letters): ${playable.toLocaleString()}`);
    console.log(`    Stem-only (1-3 letters): ${stems.toLocaleString()} (for plural detection only)`);

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, results.join('\n'), 'utf8');

    const sizeKB = Math.round(fs.statSync(OUT_PATH).size / 1024);
    console.log(`  Written to ${OUT_PATH} (${sizeKB} KB) in ${Date.now() - t0}ms`);
}

main().catch(err => {
    console.error('build-dictionary failed:', err.message);
    process.exit(1);
});
