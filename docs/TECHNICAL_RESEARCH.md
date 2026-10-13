# Technical Research: PokéSurvivor Automation Feasibility

**Target Game**: PokéSurvivor ([pokesurvivor.com](https://pokesurvivor.com/))  
**Source Repository**: [JPTER78/pokesurvivor](https://github.com/JPTER78/pokesurvivor)  
**Date**: October 2026  

---

## 1. Executive Summary

PokéSurvivor is an open-source, client-side fan game built with **vanilla HTML5 Canvas 2D and JavaScript (ES2020)** without heavy frontend or game engine frameworks.

Crucially for automation:
1. **Full internal game state is accessible via `window.G`** (`G.Game`, `G.Player`, `G.EnemyMgr`, `G.Pickups`, `G.DB`, etc.).
2. **There are zero anti-bot / CAPTCHA protections** (no Cloudflare Turnstile, no canvas fingerprinting, no bot detection).
3. **Attacking and targeting are automatic** by the game engine; automation only needs to handle directional movement, upgrade card selection (keys `1`, `2`, `3`), and menu navigation.
4. Production on `pokesurvivor.com` is hosted directly from GitHub Pages and matches the repository code (`js/app.min.js`), preserving the `window.G` global namespace.

---

## 2. Game Architecture & Stack

| Component | Implementation | Notes |
| :--- | :--- | :--- |
| **Engine** | Vanilla Canvas 2D (`<canvas id="game">`) | No Phaser, Pixi, or React |
| **State Container** | `window.G` global namespace | Instantiated in `js/main.js` and preserved in `app.min.js` |
| **Audio** | Custom Web Audio synthesizer | Dynamic sound synthesis |
| **Networking** | WebRTC + Firebase Realtime Relay | Used only for multiplayer co-op |
| **Cloud Storage** | Firebase Auth + Cloud Firestore (`pokesurvivor-free`) | Throttled sync (`PUSH_GAP = 30m`, `PUSH_GAP_URGENT = 3m`) |

---

## 3. Observable State via `window.G`

Through Electron's `webContents.executeJavaScript()`, the bot can read:

- **Loop State (`G.Game.state`)**:
  - `'ui'`: In menus (login, starter select, main hub)
  - `'playing'`: Active run in progress
  - `'levelup'`: Level-up card selection dialog active
  - `'choice'`: Item or bond selection dialog
  - `'paused'`: Game paused
  - `'over'`: Game over screen / results
- **Player State (`G.Game.pl` / `G.Game.player`)**:
  - `hp`, `maxHp`, `lvl`, `xp`, `xpNext`
  - Position `(x, y)`
  - Active moves, cooldowns, stats, buffs
- **Enemy State (`G.EnemyMgr`)**:
  - Active enemies array and spatial hash grid
  - Coordinates `(x, y)`, tier, HP, boss status
- **Level-Up Cards (`G.LevelUp.offer`)**:
  - Offered cards during `'levelup'` state
- **Account & Currencies (`G.DB.save`)**:
  - `coins`: Current coin balance
  - `tickets`: Gacha tickets
  - `partner`: Current active Pokémon Dex ID
  - `owned`, `shiny`: Collection unlock registries

---

## 4. Input & Control Verification

- **Movement**: Standard WASD or Arrow Keys.
- **Level-Up Card Selection**: Keys `1`, `2`, `3` pick the respective card; `R` rerolls (if unlocked).
- **In-Game Action Buttons**: HUD buttons and screens are toggleable via keyboard or synthetic DOM clicks.
- **Restarting**: Clicking the restart button or triggering `G.Flow.play()`.

---

## 5. Security & Account Rules

- **Authentication**: Users log in manually via the embedded website view (`scr-login`). Sessions persist via Electron's `persist:pokesurvivor` partition.
- **Bot/TOS Policy**: There are no bans or restrictions on offline/personal automation. To preserve account and leaderboard integrity, the bot:
  1. Does not modify Firestore or save data directly.
  2. Does not submit falsified leaderboard records.
  3. Relies exclusively on normal gameplay inputs.
