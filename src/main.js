// GlyphGuard — Main Entry Point
// This file will import and initialize all game systems.

console.log('GlyphGuard loaded successfully.');

// Placeholder: verify the canvas exists
const canvas = document.getElementById('game-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 500;

    // Draw a test message to confirm everything is wired up
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = '#00ff41';
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GLYPHGUARD', 400, 230);
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('Engine initialized. Ready to build.', 400, 270);
}