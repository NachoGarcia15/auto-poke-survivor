# AutoPokeSurvivor Architecture

## 1. Overview

AutoPokeSurvivor is an Electron + TypeScript desktop application engineered for reliable, unattended automation of PokéSurvivor gameplay.

```
┌────────────────────────────────────────────────────────┐
│                   Electron Main Process                │
│                                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌────────┐  │
│  │ GameObserver │────>│DecisionEngine│────>│ Input  │  │
│  └──────────────┘     └──────────────┘     │Control │  │
│         ▲                                  └────────┘  │
│         │ (Inspects window.G)                   │      │
│         │                                       ▼      │
│  ┌──────────────┐                          ┌────────┐  │
│  │ BrowserView  │<─────────────────────────│Events  │  │
│  │(PokeSurvivor)│                          └────────┘  │
│  └──────────────┘                                      │
│         │                                              │
│  ┌──────────────┐     ┌──────────────┐                 │
│  │ StatsManager │<────│  Automation  │                 │
│  └──────────────┘     │    Engine    │                 │
│                       └──────────────┘                 │
└───────────────────────────────┬────────────────────────┘
                                │ IPC (Context Isolation)
                                ▼
┌────────────────────────────────────────────────────────┐
│                   Renderer UI (HTML/CSS)               │
│  - Control Panel (Start, Stop, Emergency Stop)         │
│  - Real-time Game HUD (HP, Level, Kills, Currency)     │
│  - Run History & Farming Efficiency (Coins/hr)         │
│  - Live Diagnostic Event Log                           │
└────────────────────────────────────────────────────────┘
```

## 2. Core Modules

1. **`GameObserver`** (`src/main/game-observer.ts`):
   - Queries `window.G` in the game webContents.
   - Translates raw internal objects into typed `GameState` structures with confidence ratings.

2. **`InputController`** (`src/main/input-controller.ts`):
   - Emits synthetic keystrokes (`sendInputEvent`) for WASD movement, `1`/`2`/`3` upgrade picks, and navigation.
   - Guarantees key release on pause, stop, or application shutdown.

3. **`DecisionEngine`** (`src/main/decision-engine.ts`):
   - Pure, deterministic state-to-action mapper.
   - Evaluates kiting vectors relative to surrounding enemies.
   - Ranks level-up cards based on configurable priority lists and rarity tiers.

4. **`AutomationEngine`** (`src/main/automation-engine.ts`):
   - Orchestrates the observation-decision-action loop at configurable intervals.
   - Monitors state transitions, run lifecycles, and stall conditions.

5. **`StatsManager`** (`src/main/stats-manager.ts`):
   - Persists run metadata and calculates efficiency metrics (kills/min, coins/hr, survival duration).

6. **`ConfigManager`** (`src/main/config.ts`):
   - Handles persistent configuration (intervals, movement strategies, upgrade priorities) in `userData`.
