# AutoPokeSurvivor ⚡

Desktop companion and automated gameplay assistant for [PokéSurvivor](https://pokesurvivor.com/).

## Overview

AutoPokeSurvivor is an autonomous Electron + TypeScript desktop application engineered to safely run and assist gameplay on the official PokéSurvivor game. It enables unattended farming runs, optimal upgrade card choices, deterministic avoidance/kiting movement, and accurate session statistics (kills/min, coins/hr, survival duration).

## Key Features

- **Embedded Official Game Client**: Runs the official live web application in a sandboxed, isolated `BrowserView` with persistent cookies and account storage.
- **Direct Engine Observation**: Leverages the official game's state container (`window.G`) for verified, low-latency state extraction (`hp`, `level`, `kills`, `coins`, `enemies`, `cards`).
- **Deterministic Decision Engine**:
  - Distance-weighted kiting movement algorithm avoiding local enemy clusters.
  - Priority and rarity-driven level-up card selection.
  - Automatic restart on game over.
- **Safety & Emergency Controls**:
  - One-click Emergency Stop immediately halts automation and releases all active keystrokes.
  - Anti-stall watchdogs detect abnormal or hung screen states.
- **Progress & Metrics Dashboard**:
  - Live HUD tracking HP, kills, coins, and timer.
  - Historical farming efficiency analytics (coins/hour, average run time).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module decomposition, IPC bridge contracts, and state flow diagrams.  
See [docs/TECHNICAL_RESEARCH.md](docs/TECHNICAL_RESEARCH.md) for game engine feasibility and internal verification.

## Getting Started

### Prerequisites

- Node.js >= 20 (Node v22 recommended)
- npm >= 10

### Installation

```bash
git clone <repo-url>
cd auto-poke-survivor
npm install
```

### Running the Application

```bash
# Build TypeScript and copy renderer assets
npm run build

# Launch the desktop app
npm start
```

### Running Tests

```bash
# Run test suite with Vitest
npm test

# Run TypeScript type check
npm run typecheck
```

## Security & Legitimacy Guidelines

- **No Credential Access**: The application never prompts for, stores, or transmits your PokéSurvivor password. You authenticate directly through the official website embedded in the desktop window.
- **Legitimate Gameplay**: Actions are executed strictly through synthetic keyboard inputs (`WASD`, `1`/`2`/`3`) without injecting false scores, illegitimate currency increments, or manipulated network packets.
