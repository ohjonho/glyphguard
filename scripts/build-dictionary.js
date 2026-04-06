// scripts/build-dictionary.js
// Downloads dwyl/english-words, applies the build-time filter pipeline,
// and writes the result to data/dictionary.txt.
//
// Run once before building:
//   node scripts/build-dictionary.js

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const { pipeline } = require('stream/promises');

const SOURCE_URL = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';
const OUT_PATH   = path.join(__dirname, '..', 'data', 'dictionary.txt');
const MIN_LENGTH = 4;

// ── Filter Pipeline (mirrors Section 2 of ARCHITECTURE.md) ───────────────────

function isValidEntry(word) {
    if (word.length < MIN_LENGTH)      return false;
    if (!/^[a-z]+$/.test(word))        return false; // non-alpha (hyphens, apostrophes, spaces)
    if (/^(.)\1+$/.test(word))         return false; // single repeated char (aaaa, bbbb)
    return true;
}

// ── Download & Filter ─────────────────────────────────────────────────────────

async function download(url) {
    return new Promise((resolve, reject) => {
        let data = '';
        https.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end',  () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    console.log(`Downloading from ${SOURCE_URL}...`);
    const raw = await download(SOURCE_URL);

    const lines   = raw.split('\n');
    const results = [];

    for (let line of lines) {
        const word = line.trim().toLowerCase();
        if (isValidEntry(word)) results.push(word);
    }

    console.log(`Filtered: ${results.length.toLocaleString()} words kept from ${lines.length.toLocaleString()} raw entries`);

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, results.join('\n'), 'utf8');

    const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
    console.log(`Written to ${OUT_PATH} (${sizeKB} KB)`);
}

main().catch(err => {
    console.error('Build failed:', err.message);
    process.exit(1);
});
