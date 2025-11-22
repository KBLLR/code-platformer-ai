// src/ui/ModernGameHUD.js
// Modern, clean HUD for VIVERSE 3D Arena

export class ModernGameHUD {
  constructor(containerId = "game-hud") {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error("[ModernGameHUD] Container not found:", containerId);
      return;
    }

    this.playerPanels = [];
    this.initialized = false;
  }

  initialize(players) {
    if (this.initialized) return;

    // Clear container
    this.container.innerHTML = "";
    this.container.className = "fixed inset-0 pointer-events-none z-50";
    this.container.style.display = "block";

    // Create modern HUD layout
    const hudWrapper = document.createElement("div");
    hudWrapper.className = "w-full h-full flex flex-col";
    hudWrapper.innerHTML = `
      <!-- Top Bar: Player Stats -->
      <div class="flex justify-between items-start p-4 gap-4">
        <div id="player-panels-left" class="flex flex-col gap-3"></div>
        <div id="player-panels-right" class="flex flex-col gap-3"></div>
      </div>

      <!-- Bottom Center: Controls Info -->
      <div class="mt-auto mb-6 flex justify-center">
        <div id="controls-info" class="bg-black bg-opacity-60 backdrop-blur-sm px-6 py-3 rounded-full border border-white border-opacity-20">
          <div class="text-white text-sm font-mono flex gap-6">
            <span><span class="text-blue-400">WASD</span> Move</span>
            <span><span class="text-green-400">SPACE</span> Jump</span>
            <span><span class="text-yellow-400">F</span> Attack</span>
          </div>
        </div>
      </div>

      <!-- Top Center: Game Status -->
      <div id="game-status" class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 backdrop-blur-sm px-8 py-3 rounded-2xl border border-white border-opacity-30">
        <div class="text-white text-center">
          <div class="text-2xl font-bold text-yellow-400">3D BATTLE ARENA</div>
          <div class="text-sm text-gray-300 mt-1">VIVERSE POWERED</div>
        </div>
      </div>
    `;

    this.container.appendChild(hudWrapper);

    // Create player panels
    this.createPlayerPanels(players);

    this.initialized = true;
    console.log("[ModernGameHUD] Initialized with", players.length, "players");
  }

  createPlayerPanels(players) {
    const leftContainer = document.getElementById("player-panels-left");
    const rightContainer = document.getElementById("player-panels-right");

    if (!leftContainer || !rightContainer) {
      console.error("[ModernGameHUD] Panel containers not found");
      return;
    }

    this.playerPanels = [];

    players.forEach((player, index) => {
      const panel = this.createPlayerPanel(player, index);
      this.playerPanels.push(panel);

      // Players 0,2 on left, 1,3 on right
      if (index % 2 === 0) {
        leftContainer.appendChild(panel.element);
      } else {
        rightContainer.appendChild(panel.element);
      }
    });
  }

  createPlayerPanel(player, index) {
    const panel = document.createElement("div");
    const isAI = player.isAI || false;
    const playerColors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"]; // blue, red, green, yellow
    const color = playerColors[index % 4];

    panel.className = "bg-black bg-opacity-70 backdrop-blur-sm rounded-xl p-4 border-2 transition-all duration-300";
    panel.style.borderColor = color;
    panel.style.minWidth = "280px";

    panel.innerHTML = `
      <div class="flex items-center gap-3">
        <!-- Player Avatar -->
        <div class="w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-gray-700 to-gray-900"
             style="border-color: ${color}; color: ${color}">
          P${index + 1}
        </div>

        <!-- Player Info -->
        <div class="flex-1">
          <!-- Name & Status -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-white font-bold text-lg">Player ${index + 1}</span>
              ${isAI ? '<span class="text-xs bg-purple-600 px-2 py-0.5 rounded-full text-white">🤖 AI</span>' : '<span class="text-xs bg-blue-600 px-2 py-0.5 rounded-full text-white">👤 YOU</span>'}
            </div>
            <div id="player-${index}-trophy" class="text-2xl hidden">🏆</div>
          </div>

          <!-- Health Bar -->
          <div class="mb-2">
            <div class="flex justify-between text-xs text-gray-400 mb-1">
              <span>Health</span>
              <span id="player-${index}-health-text">100/100</span>
            </div>
            <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div id="player-${index}-health-bar"
                   class="h-full transition-all duration-300 rounded-full"
                   style="width: 100%; background: linear-gradient(90deg, ${color}, ${this.lightenColor(color)})">
              </div>
            </div>
          </div>

          <!-- Score & Weapon -->
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-yellow-400 text-lg font-bold">💰</span>
              <span id="player-${index}-score" class="text-yellow-400 font-mono font-bold text-lg">0</span>
            </div>
            <div id="player-${index}-weapon" class="text-gray-400 text-sm font-mono">
              ${player.currentWeapon?.constructor?.name || "No Weapon"}
            </div>
          </div>

          <!-- Status Messages -->
          <div id="player-${index}-status" class="text-xs text-gray-400 mt-2 h-4"></div>
        </div>
      </div>
    `;

    return {
      element: panel,
      playerIndex: index,
      healthBar: null, // Will be set after element is added to DOM
      healthText: null,
      scoreText: null,
      weaponText: null,
      trophyIcon: null,
      statusText: null,
    };
  }

  lightenColor(color) {
    // Simple color lightening for gradient
    const hex = color.replace("#", "");
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 40);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 40);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 40);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  update(players) {
    if (!this.initialized) {
      this.initialize(players);
      return;
    }

    players.forEach((player, index) => {
      if (index >= this.playerPanels.length) return;

      const panel = this.playerPanels[index];
      const element = panel.element;

      // Get elements
      const healthBar = element.querySelector(`#player-${index}-health-bar`);
      const healthText = element.querySelector(`#player-${index}-health-text`);
      const scoreText = element.querySelector(`#player-${index}-score`);
      const weaponText = element.querySelector(`#player-${index}-weapon`);
      const trophyIcon = element.querySelector(`#player-${index}-trophy`);
      const statusText = element.querySelector(`#player-${index}-status`);

      if (!healthBar || !healthText || !scoreText || !weaponText || !trophyIcon || !statusText) {
        return;
      }

      // Update health
      const healthPercent = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
      healthBar.style.width = `${healthPercent}%`;
      healthText.textContent = `${Math.round(player.health)}/${player.maxHealth}`;

      // Update health bar color based on health
      const playerColors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"];
      const color = playerColors[index % 4];
      if (healthPercent < 30) {
        healthBar.style.background = "linear-gradient(90deg, #dc2626, #ef4444)"; // Red
      } else if (healthPercent < 60) {
        healthBar.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)"; // Orange
      } else {
        healthBar.style.background = `linear-gradient(90deg, ${color}, ${this.lightenColor(color)})`;
      }

      // Update score
      scoreText.textContent = Math.round(player.score || 0).toLocaleString();

      // Update weapon
      if (player.currentWeapon) {
        weaponText.textContent = player.currentWeapon.constructor.name;
      } else {
        weaponText.textContent = "No Weapon";
      }

      // Update trophy indicator
      if (player.hasMoney) {
        trophyIcon.classList.remove("hidden");
        element.classList.add("ring-4", "ring-yellow-400", "ring-opacity-50");
        element.style.transform = "scale(1.02)";
      } else {
        trophyIcon.classList.add("hidden");
        element.classList.remove("ring-4", "ring-yellow-400", "ring-opacity-50");
        element.style.transform = "scale(1)";
      }

      // Update status
      if (player.dead) {
        element.style.opacity = "0.5";
        element.style.borderColor = "#6b7280"; // gray
        statusText.textContent = "💀 ELIMINATED";
        statusText.className = "text-xs text-red-400 mt-2 h-4 font-bold";
      } else if (player.invulnerable) {
        statusText.textContent = "⚡ INVULNERABLE";
        statusText.className = "text-xs text-blue-400 mt-2 h-4 animate-pulse";
        element.style.opacity = "1";
      } else {
        element.style.opacity = "1";
        statusText.textContent = "";
      }

      // Show winner
      if (player.justWon) {
        this.showWinner(index);
      }
    });
  }

  showWinner(playerIndex) {
    const winnerOverlay = document.createElement("div");
    winnerOverlay.className = "fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80 backdrop-blur-sm animate-fade-in";
    winnerOverlay.innerHTML = `
      <div class="text-center animate-scale-in">
        <div class="text-8xl mb-4">🏆</div>
        <div class="text-6xl font-bold text-yellow-400 mb-4">VICTORY!</div>
        <div class="text-3xl text-white mb-8">Player ${playerIndex + 1} Wins!</div>
        <div class="text-xl text-gray-400">Press R to restart</div>
      </div>
    `;

    this.container.appendChild(winnerOverlay);

    // Listen for restart
    const handleRestart = (e) => {
      if (e.key === "r" || e.key === "R") {
        window.location.reload();
      }
    };
    window.addEventListener("keydown", handleRestart, { once: true });

    console.log("[ModernGameHUD] Player", playerIndex + 1, "won!");
  }

  hide() {
    if (this.container) {
      this.container.style.display = "none";
    }
  }

  show() {
    if (this.container) {
      this.container.style.display = "block";
    }
  }
}
