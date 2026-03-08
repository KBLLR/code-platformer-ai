---
description: Boot a seeded battle royale match and verify lifecycle events
---

# Battle Royale Match Smoke Test

Verifies that a seeded match can boot, run, and complete with correct
status events emitted through the A2A event bus.

## Steps

1. **Start dev server**

   ```bash
   cd /Users/davidcaballero/core-x-kbllr_0/houses/code-platformer-AI
   npm run dev
   ```

2. **Open match with seed**
   Navigate to `http://localhost:5173/?state=game&seed=42`

3. **Verify lobby skip**
   - Scene should skip lobby and go directly to MatchScene.
   - Console should log: `[MatchScene] Match ... initialized. 12 players.`

4. **Verify match lifecycle**
   - HUD shows 12 ALIVE, phase WARMUP.
   - After ~5s, phase transitions to ACTIVE.
   - Safe zone ring begins shrinking after ~60s.
   - Bots fight and eliminate each other.
   - Match ends with VICTORY ROYALE! or DEFEATED screen.

5. **Verify A2A events** (if event-bus is running)
   - Console logs `[A2A] Registered house "code-platformer-ai"`.
   - Match status events are sent at each phase transition.

6. **Verify back-to-lobby**
   - Click "BACK TO LOBBY" on win screen.
   - Scene transitions cleanly to LobbyScene.

## Pass Criteria

- [ ] Match boots with 12 players (1 human + 11 bots)
- [ ] Safe zone shrinks on schedule
- [ ] Match ends with a winner
- [ ] No console errors
