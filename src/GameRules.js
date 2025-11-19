// src/GameRules.js
// Game Rules, Victory Conditions, and Match Management

import { game_config } from "./game_config.js";

export class GameRules {
  constructor() {
    this.matchStartTime = 0;
    this.matchDuration = 0; // in seconds, 0 = no time limit
    this.gameState = "waiting"; // waiting, playing, paused, ended
    this.winner = null;
    this.victoryCondition = "money"; // money, elimination, time, kills
    this.killCounts = {}; // Track kills per player
    this.deathCounts = {}; // Track deaths per player
    this.respawnQueue = []; // Players waiting to respawn
  }

  /**
   * Start the match
   */
  startMatch(players) {
    this.matchStartTime = performance.now();
    this.gameState = "playing";
    this.winner = null;
    this.killCounts = {};
    this.deathCounts = {};

    // Initialize kill/death tracking
    players.forEach((player, index) => {
      this.killCounts[index] = 0;
      this.deathCounts[index] = 0;
    });

    console.log("[GameRules] Match started!");
  }

  /**
   * Check victory conditions every frame
   * @param {Array} players - Array of player objects
   * @returns {Object|null} Winner info or null if no winner yet
   */
  checkVictory(players) {
    if (this.gameState !== "playing") return null;

    // Victory by money (default: $10,000)
    if (this.victoryCondition === "money") {
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (player.money >= game_config.win) {
          return this.declareWinner(player, i, "money");
        }
      }
    }

    // Victory by elimination (last player standing)
    if (this.victoryCondition === "elimination" || this.victoryCondition === "battle") {
      const alivePlayers = players.filter(p => p.health > 0 && !p.dead);
      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        const index = players.indexOf(winner);
        return this.declareWinner(winner, index, "elimination");
      } else if (alivePlayers.length === 0) {
        // Draw - everyone died at once
        return this.declareWinner(null, -1, "draw");
      }
    }

    // Victory by time limit
    if (this.matchDuration > 0) {
      const elapsed = (performance.now() - this.matchStartTime) / 1000;
      if (elapsed >= this.matchDuration) {
        // Winner is player with most money
        let leadPlayer = players[0];
        let leadIndex = 0;
        for (let i = 1; i < players.length; i++) {
          if (players[i].money > leadPlayer.money) {
            leadPlayer = players[i];
            leadIndex = i;
          }
        }
        return this.declareWinner(leadPlayer, leadIndex, "time");
      }
    }

    // Victory by kill count
    if (this.victoryCondition === "kills") {
      const killLimit = game_config.killLimit || 10;
      for (let i = 0; i < players.length; i++) {
        if (this.killCounts[i] >= killLimit) {
          return this.declareWinner(players[i], i, "kills");
        }
      }
    }

    return null; // No winner yet
  }

  /**
   * Declare a winner and end the game
   */
  declareWinner(player, playerIndex, reason) {
    this.gameState = "ended";
    this.winner = {
      player: player,
      playerIndex: playerIndex,
      reason: reason,
      stats: {
        money: player ? player.money : 0,
        kills: this.killCounts[playerIndex] || 0,
        deaths: this.deathCounts[playerIndex] || 0,
        health: player ? player.health : 0
      }
    };

    console.log(`[GameRules] Winner: Player ${playerIndex + 1} (${reason})`);
    return this.winner;
  }

  /**
   * Handle player death and respawn
   */
  handlePlayerDeath(player, playerIndex, killerIndex = -1) {
    if (player.dead) return; // Already dead

    player.dead = true;
    player.health = 0;
    this.deathCounts[playerIndex] = (this.deathCounts[playerIndex] || 0) + 1;

    if (killerIndex >= 0) {
      this.killCounts[killerIndex] = (this.killCounts[killerIndex] || 0) + 1;
    }

    // Queue for respawn
    const respawnTime = performance.now() + game_config.respawn_time;
    this.respawnQueue.push({
      player: player,
      playerIndex: playerIndex,
      respawnTime: respawnTime
    });

    console.log(`[GameRules] Player ${playerIndex + 1} died. Respawning in ${game_config.respawn_time}ms`);
  }

  /**
   * Update respawn queue and revive players
   */
  updateRespawns(players, level) {
    const now = performance.now();

    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const entry = this.respawnQueue[i];

      if (now >= entry.respawnTime) {
        this.respawnPlayer(entry.player, entry.playerIndex, level);
        this.respawnQueue.splice(i, 1);
      }
    }
  }

  /**
   * Respawn a player at a spawn point
   */
  respawnPlayer(player, playerIndex, level) {
    // Reset player stats
    player.dead = false;
    player.health = player.maxHealth || game_config.player_hp;
    player.velocity.set(0, 0, 0);
    player.velocityX = 0;
    player.velocityY = 0;

    // Move to spawn point
    if (level && level.playerSpawns && level.playerSpawns.length > 0) {
      const spawnIndex = playerIndex % level.playerSpawns.length;
      const spawn = level.playerSpawns[spawnIndex];
      player.mesh.position.copy(spawn);
      player.mesh.position.y += 1; // Slightly above ground
    }

    console.log(`[GameRules] Player ${playerIndex + 1} respawned`);
  }

  /**
   * Get match statistics
   */
  getMatchStats(players) {
    const elapsed = (performance.now() - this.matchStartTime) / 1000;

    return {
      duration: elapsed,
      gameState: this.gameState,
      players: players.map((p, i) => ({
        index: i,
        health: p.health,
        money: p.money,
        kills: this.killCounts[i] || 0,
        deaths: this.deathCounts[i] || 0,
        alive: !p.dead && p.health > 0
      }))
    };
  }

  /**
   * Pause the match
   */
  pause() {
    if (this.gameState === "playing") {
      this.gameState = "paused";
      console.log("[GameRules] Match paused");
    }
  }

  /**
   * Resume the match
   */
  resume() {
    if (this.gameState === "paused") {
      this.gameState = "playing";
      console.log("[GameRules] Match resumed");
    }
  }

  /**
   * End the match manually
   */
  endMatch() {
    this.gameState = "ended";
    console.log("[GameRules] Match ended manually");
  }

  /**
   * Reset for a new match
   */
  reset() {
    this.matchStartTime = 0;
    this.gameState = "waiting";
    this.winner = null;
    this.killCounts = {};
    this.deathCounts = {};
    this.respawnQueue = [];
    console.log("[GameRules] Game rules reset");
  }

  /**
   * Display victory screen (UI integration point)
   */
  showVictoryScreen() {
    if (!this.winner) return;

    const victoryScreen = document.getElementById("victory-screen");
    if (victoryScreen) {
      victoryScreen.style.display = "flex";

      const winnerText = document.getElementById("winner-text");
      if (winnerText) {
        if (this.winner.playerIndex === -1) {
          winnerText.textContent = "Draw!";
        } else {
          winnerText.textContent = `Player ${this.winner.playerIndex + 1} Wins!`;
        }
      }

      const reasonText = document.getElementById("victory-reason");
      if (reasonText) {
        const reasons = {
          money: `Reached $${game_config.win}!`,
          elimination: "Last player standing!",
          time: "Most money at time limit!",
          kills: `${this.winner.stats.kills} kills!`,
          draw: "Everyone eliminated!"
        };
        reasonText.textContent = reasons[this.winner.reason] || "";
      }

      const statsDiv = document.getElementById("victory-stats");
      if (statsDiv && this.winner.player) {
        statsDiv.innerHTML = `
          <div>Money: $${this.winner.stats.money}</div>
          <div>Kills: ${this.winner.stats.kills}</div>
          <div>Deaths: ${this.winner.stats.deaths}</div>
        `;
      }
    }

    console.log("[GameRules] Victory screen displayed");
  }

  /**
   * Hide victory screen
   */
  hideVictoryScreen() {
    const victoryScreen = document.getElementById("victory-screen");
    if (victoryScreen) {
      victoryScreen.style.display = "none";
    }
  }
}

export default GameRules;
