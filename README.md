# Sky Patrol Prototype

First playable browser pass for a portrait-oriented aircraft shooter inspired by classic vertical airplane action, built with original placeholder visuals and no copyrighted reference assets.

## Included in this pass

- Title screen with start button
- Pointer and touch-friendly aircraft steering
- Automatic player firing
- Enemy wave pacing with telegraphed spawns and escalating patterns
- Bullet and player collision handling
- Temporary spread-shot power-up drops from heavy enemies
- Stronger hit feedback with flashes, screen shake, and larger explosions
- Score, HP, best-score tracking
- Game over screen with restart loop
- Mobile-friendly single-canvas layout
- Simple file structure that can be reused later in a WebView or wrapper app

## Files

- `index.html`: game shell and UI overlays
- `styles.css`: portrait/mobile-first styling
- `src/main.js`: canvas game loop, state handling, spawning, and collisions
- `ASSET_PLAN.md`: replacement asset plan for later art/audio production

## Run locally

1. Open `index.html` in a modern browser.
2. If your browser blocks module loading from the file system, run a tiny local static server in this folder instead.
3. Press **Start Mission** and drag or move your pointer/finger inside the game area to steer.

## Notes for future packaging

- The code is browser-first and dependency-free.
- Game logic lives in a single JS module for easy extraction into a WebView container.
- Art, sound, and progression systems are intentionally placeholder-level for quick iteration.
