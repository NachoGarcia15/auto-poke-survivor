# AutoPokeSurvivor Architecture

## 1. System Overview

AutoPokeSurvivor is an autonomous Electron + TypeScript desktop application engineered for reliable, unattended automation of PokéSurvivor gameplay.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                           │
│                                                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────────────┐  │
│  │ GameObserver │────>│DecisionEngine│────>│    InputController     │  │
│  └──────────────┘     └──────┬───────┘     └───────────┬────────────┘  │
│         ▲                    │                         │               │
│         │ (Reads window.G)   ▼                         │               │
│         │             ┌──────────────┐                 │               │
│         │             │UpgradeSelect │                 │               │
│         │             └──────────────┘                 │ (Synthetic    │
│  ┌──────────────┐                                      │  Keystrokes)  │
│  │ BrowserView  │<─────────────────────────────────────┘               │
│  │(PokeSurvivor)│                                                      │
│  └──────┬───────┘                                                      │
│         │                                                              │
│         ▼                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────────────┐  │
│  │  RunManager  │────>│ StatsManager │<────│    AutomationEngine    │  │
│  └──────────────┘     └──────────────┘     └────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (Secure Preload Bridge)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Renderer UI (HTML5 / CSS3)                      │
│  - Control Panel (Start, Stop, Emergency Stop)                         │
│  - Real-time Game HUD (HP, Level, Kills, Coins, Screen State)          │
│  - Historical Farming Analytics (Coins/hr, Duration, Averages)         │
│  - Live Diagnostic Event Log                                           │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Modules Decomposition

1. **`GameObserver`** (`src/main/game-observer.ts`):
   - Queries `window.G` in the game webContents context with low overhead.
   - Extracts player coordinates, HP, level, active moves, enemies, level-up cards, and currencies.
   - Marks verified values with `Confidence.VERIFIED` and falls back gracefully to DOM detection.

2. **`InputController`** (`src/main/input-controller.ts`):
   - Emits synthetic keystrokes (`sendInputEvent`) for directional movement (`WASD`), level-up cards (`1`, `2`, `3`), and start/restart controls.
   - Maintains an `activeKeys` registry to guarantee that all keys are released on pause, stop, or application shutdown.

3. **`DecisionEngine`** (`src/main/decision-engine.ts`):
   - Pure, deterministic state-to-action mapper.
   - Computes dynamic evasion vectors relative to surrounding enemy coordinates (kiting).
   - Coordinates with `UpgradeSelector` during level-up states.

4. **`UpgradeSelector`** (`src/main/upgrade-selector.ts`):
   - Prioritizes attack evolutions (e.g. Ember → Fire Blast) and essential passives (Síntesis HP regen, Vigor, Imán magnet).
   - Evaluates custom user priority keywords and defaults to rarity hierarchies (`Legendary` > `Epic` > `Rare` > `Uncommon` > `Common`).

5. **`RunManager`** (`src/main/run-manager.ts`):
   - Oversees the run lifecycle: transitions from menu into `PLAYING`, run metric accumulation, and game-over detection.
   - Calculates verified progression deltas (`currencyAfter - currencyBefore`) and enforces run execution caps.

6. **`AutomationEngine`** (`src/main/automation-engine.ts`):
   - Orchestrates the observation-decision-action loop at configurable intervals.
   - Includes watchdog timers to detect stalled screens and implements error-count circuit breakers.

7. **`StatsManager`** (`src/main/stats-manager.ts`):
   - Persists run metadata to `userData/run-history.json`.
   - Computes aggregated progression metrics: average kills, level, survival time, and coins per hour.

8. **`ConfigManager`** (`src/main/config.ts`):
   - Persists user preferences and strategy profiles in `userData/config.json`.
