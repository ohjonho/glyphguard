// build.js — Production build: bundles JS + inlines dictionary into a single
// self-contained dist/index.html that needs no server or network at runtime.
//
// Usage:
//   node scripts/build-dictionary.js   # fetch + filter dictionary (once)
//   npx esbuild src/main.js --bundle --minify --outfile=dist/bundle.js
//   node build.js                      # inline both into dist/index.html
//
// Or via package.json shortcut:
//   npm run build:prod

const fs   = require('fs');
const path = require('path');

const PATHS = {
    template:   path.join(__dirname, 'index.html'),
    bundle:     path.join(__dirname, 'dist', 'bundle.js'),
    dictionary: path.join(__dirname, 'data', 'dictionary.txt'),
    out:        path.join(__dirname, 'dist', 'index.html'),
};

function requireFile(p, label) {
    if (!fs.existsSync(p)) {
        console.error(`Missing ${label}: ${p}`);
        console.error('Run the following first:');
        if (label === 'dictionary') console.error('  node scripts/build-dictionary.js');
        if (label === 'bundle')     console.error('  npx esbuild src/main.js --bundle --minify --outfile=dist/bundle.js');
        process.exit(1);
    }
    return fs.readFileSync(p, 'utf8');
}

function main() {
    const t0         = Date.now();
    const template   = requireFile(PATHS.template,   'index.html template');
    const bundle     = requireFile(PATHS.bundle,     'bundle');
    const dictionary = requireFile(PATHS.dictionary, 'dictionary');

    const wordCount = dictionary.split('\n').filter(w => w.trim()).length;
    const dictKB    = Math.round(Buffer.byteLength(dictionary, 'utf8') / 1024);
    console.log(`Dictionary: ${wordCount.toLocaleString()} words, ${dictKB} KB`);

    // Inline the dictionary as a window global ahead of the bundle.
    // JSON.stringify turns the newline-delimited string into a valid JS string literal.
    const dictScript = `<script>window.__GLYPHGUARD_DICT__=${JSON.stringify(dictionary)};</script>`;

    // Wrap the bundle in an inline <script> tag.
    const bundleScript = `<script>${bundle}</script>`;

    // Replace the external bundle reference with inline versions.
    // Template uses: <script src="dist/bundle.js"></script>
    let html = template.replace(
        '<script src="dist/bundle.js"></script>',
        `${dictScript}\n    ${bundleScript}`
    );

    fs.mkdirSync(path.dirname(PATHS.out), { recursive: true });
    fs.writeFileSync(PATHS.out, html, 'utf8');

    const outKB = Math.round(fs.statSync(PATHS.out).size / 1024);
    console.log(`Output: ${PATHS.out} (${outKB} KB) — built in ${Date.now() - t0}ms`);
    console.log('Deploy the single dist/index.html file to any static host.');
}

main();
