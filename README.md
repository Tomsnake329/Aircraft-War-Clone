# Sky Patrol Prototype

First playable browser pass for a portrait-oriented aircraft shooter inspired by classic vertical airplane action, now using integrated local art assets for the in-game presentation and UI.

## Included in this pass

- Title screen with start button
- Pointer and touch-friendly aircraft steering
- Automatic player firing
- Enemy wave pacing with telegraphed spawns and escalating patterns
- Bullet and player collision handling
- Spread / rapid weapon pickups
- Stronger hit feedback with flashes, screen shake, and larger explosions
- Boss enemy appearance at higher threat levels
- Score, HP, best-score tracking
- Game over screen with restart loop
- Mobile-friendly single-canvas layout
- Local art integrated into gameplay, HUD, title, and game-over presentation

## Files

- `index.html`: game shell and UI overlays
- `styles.css`: portrait/mobile-first styling
- `src/main.js`: canvas game loop, state handling, spawning, and collisions
- `assets/images/`: normalized imported art and runtime-used assets
- `assets/images/processed/`: current in-use gameplay sprite set
- `art/`: original source art dropped in for project integration
- `ASSET_PLAN.md`: replacement asset plan for later art/audio production

## Run locally

1. Open `index.html` in a modern browser.
2. If your browser blocks module loading from the file system, run a tiny local static server in this folder instead.
3. Press **Start Mission** and drag or move your pointer/finger inside the game area to steer.

### Quick playtest via local server

```powershell
cd "C:\Users\User\Downloads\哥\BOT遊戲專屬區\Aircraft War Clone"
python -m http.server 8080
```

Then open:
- `http://127.0.0.1:8080/`

## Notes for future packaging

- The code is browser-first and dependency-free.
- Game logic lives in a single JS module for easy extraction into a WebView container.
- Current art integration is suitable for iterative browser playtesting and can be swapped later without changing the core loop structure.
