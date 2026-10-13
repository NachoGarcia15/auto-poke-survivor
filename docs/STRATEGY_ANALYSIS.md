# Strategy Analysis & Optimization Guide

This document presents the strategic and empirical trade-offs evaluated for AutoPokeSurvivor's automated farming engine.

---

## 1. Movement Strategies Comparison

The `DecisionEngine` implements three movement algorithms: `kite`, `circle`, and `random`.

| Strategy | Mechanics | Survival Rate | XP Collection | CPU Overhead | Recommendation |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`kite`** (Default) | Dynamically computes the vector difference from the nearest enemy cluster and flees in the opposite heading. Rotates periodically when unthreatened. | **High** (avoids swarms and chargers) | **High** (smooth orbits around mob herds) | Very Low (evaluates top 50 enemies) | **Recommended for long runs and boss encounters.** |
| **`circle`** | Rotates movement angle by 45° every 2 seconds, producing an octagonal circular loop. | **Medium** (can run into incoming surges) | **High** (gathers dense central gem piles) | Minimal | Suitable for early-game grinding in open arenas. |
| **`random`** | Selects a random angle vector every 2 seconds. | **Low** (frequently gets trapped against corners or mob walls) | **Low** (scatters movement without purpose) | Minimal | Baseline control reference only. |

---

## 2. Upgrade Prioritization Strategy

In PokéSurvivor, runs scale exponentially with elapsed time (`scale(t)` increases enemy HP by `1 + t/95` and damage by `1 + t/420`). Surviving past the 3-minute, 6-minute, and 9-minute boss marks requires specific synergies:

### Priority Tiers

1. **Move Evolution (`evo`) [Highest Priority]**:
   - Attacks evolve into massive AoE forms (e.g., Flamethrower/Fire Blast, Surf, Thunderbolt) once the move reaches level 5 and its required passive is equipped.
   - Guaranteed gold cards that should always be selected immediately.

2. **Survival & Sustained Regeneration (`síntesis`, `coraza`, `vigor`)**:
   - PokéSurvivor has no potions; HP only recovers via passive regen (`síntesis` +0.9 HP/s) or Zidra Berries.
   - Without early HP regen, chip damage from swarms terminates runs prematurely.

3. **Collection Efficiency (`imán`)**:
   - Magnet radius increases XP gem pull distance. A higher magnet radius allows the player to collect XP without entering dangerous melee range.

4. **Damage Scaling (`potencia`, `reflejos`)**:
   - +10% Attack power and -8% Cooldown reduction allow weapons to clear enemy caps before the 85% density threshold converts spawns into elites.

---

## 3. Performance & Memory Optimization

1. **Low Polling Overhead**:
   - Observation occurs at 200ms intervals, avoiding high CPU loads while providing responsive 5Hz decision cycles.
2. **Selective State Extraction**:
   - Only the active player, nearest 50 enemies, and relevant HUD numbers are extracted per frame, avoiding expensive full-DOM deep clones.
3. **Session Memory Cleanup**:
   - Run logs and diagnostic events are capped at 1,000 entries in memory and auto-pruned to avoid Electron renderer leaks during multi-hour unattended farming.
