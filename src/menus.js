// src/menus.js
import { LoaderManager } from "./LoaderManager.js";

class Menu {
  static loader = new LoaderManager();

  constructor() {
    this._wrap = null;
  }

  async Show() {
    throw new Error("Menu.Show() must be implemented by subclasses.");
  }

  Hide() {
    if (this._wrap) {
      this._wrap.style.display = "none";
      console.log(
        `[menus.js] Hiding menu: ${this._wrap.className || this._wrap.id}`,
      );
    }
  }

  OnButton(bt_class, callback) {
    console.log(`[menus.js] OnButton called for class: ${bt_class}`);
    console.log(`[menus.js] Menu wrap:`, this._wrap);
    
    const bt = this._wrap?.getElementsByClassName(bt_class)[0];
    console.log(`[menus.js] Found button:`, bt);
    
    if (!bt) {
      console.error(
        `[menus.js] Menu: Button with class "${bt_class}" not found in menu wrap.`,
      );
      console.log(`[menus.js] Available elements in wrap:`, this._wrap?.innerHTML);
      return;
    }
    
    console.log(`[menus.js] Adding click event to button with class: ${bt_class}`);
    
    bt.addEventListener("click", (e) => {
      console.log(`[menus.js] Button clicked: ${bt_class}`, e);
      this.Hide();
      callback();
    });
    

  }
}

class Mainmenu extends Menu {
  constructor() {
    super();
    this._wrap = document.getElementsByClassName("menu-wrap")[0];
    if (!this._wrap) {
      console.error("Mainmenu: '.menu-wrap' element not found!");
    }
  }

  async Show() {
    console.log("[menus.js] Mainmenu Show() called");
    if (!this._wrap) {
      console.error("[menus.js] Mainmenu _wrap is null!");
      return;
    }
    
    this._wrap.style.display = "block";
    this._wrap.style.pointerEvents = "auto";
    console.log("[menus.js] Mainmenu shown and pointer events enabled.");
    


    // Ensure other menus are hidden explicitly
    const lvlSelectWrap = document.getElementsByClassName("lvl-select-wrap")[0];
    const charSelect = document.getElementById("character-select");
    
    if (lvlSelectWrap) lvlSelectWrap.style.display = "none";
    if (charSelect) {
      charSelect.classList.add("hidden");
      charSelect.style.display = "none";
    }
    

  }
}

class LvlSelect extends Menu {
  constructor() {
    super();
    this._wrap = document.getElementsByClassName("lvl-select-wrap")[0];
    if (!this._wrap) {
      console.error("LvlSelect: '.lvl-select-wrap' element not found!");
    }
    this._levelFrames = null;
    this._logoElement = null;
  }

  async Show() {
    console.log("[menus.js] LvlSelect Show() called");
    if (!this._wrap) {
      console.error("[menus.js] LvlSelect _wrap is null!");
      return;
    }
    
    this._wrap.style.display = "block";
    this._wrap.style.pointerEvents = "auto";
    console.log("[menus.js] LvlSelect shown. Starting asset load...");

    // Ensure other menus are hidden explicitly
    const mainMenu = document.getElementsByClassName("menu-wrap")[0];
    const charSelect = document.getElementById("character-select");
    
    if (mainMenu) mainMenu.style.display = "none";
    if (charSelect) {
      charSelect.classList.add("hidden");
      charSelect.style.display = "none";
    }

    this._logoElement = this._wrap.getElementsByClassName("logo")[0];
    this._levelFrames = this._wrap.getElementsByClassName("lvl-select-frame");

    await Menu.loader.loadManifest();
    console.log("[menus.js] LvlSelect: Manifest loaded.");

    if (this._logoElement) {
      try {
        const logoPath = "mainmenu/logo.png";
        const logoIndex = Menu.loader.manifest.mainmenu.indexOf(logoPath);
        if (logoIndex > -1) {
          const logoTexture = await Menu.loader.loadMainMenuImage(logoIndex);
          this._logoElement.style.backgroundImage = `url(${logoTexture.image.src})`;
          this._logoElement.style.backgroundSize = "contain";
          this._logoElement.style.backgroundRepeat = "no-repeat";
          this._logoElement.style.backgroundPosition = "center";
          console.log(`[menus.js] LvlSelect: Logo loaded for ${logoPath}.`);
        } else {
          console.warn(
            `[menus.js] LvlSelect: logo path '${logoPath}' not found in assets.json mainmenu.`,
          );
        }
      } catch (error) {
        console.error(
          "[menus.js] LvlSelect: Failed to load logo texture:",
          error,
        );
      }

      setTimeout(() => {
        this._logoElement.style.top = "34vh";
        this._logoElement.style.left = "52vw";
        this._logoElement.style.transform =
          "translateX(-50%) translateY(-20%) scaleX(0.6) scaleY(0.6)";
        this._logoElement.style.transition =
          "top 0.5s ease-out, left 0.5s ease-out, transform 0.5s ease-out";
        console.log("[menus.js] LvlSelect: Logo animation triggered.");
      }, 100);
    }

    if (this._levelFrames && this._levelFrames.length > 0) {
      for (let i = 0; i < this._levelFrames.length; i++) {
        const frame = this._levelFrames[i];
        try {
          const lvlTitlePath = `mainmenu/lvl_${i}_title.png`;
          const lvlTitleIndex =
            Menu.loader.manifest.mainmenu.indexOf(lvlTitlePath);

          if (lvlTitleIndex > -1) {
            const lvlTitleTexture =
              await Menu.loader.loadMainMenuImage(lvlTitleIndex);
            frame.style.backgroundImage = `url(${lvlTitleTexture.image.src})`;
            frame.style.backgroundSize = "contain";
            frame.style.backgroundRepeat = "no-repeat";
            frame.style.backgroundPosition = "center";
            frame.textContent = "";
            console.log(
              `[menus.js] LvlSelect: Level title ${i} loaded for ${lvlTitlePath}.`,
            );
          } else {
            console.warn(
              `[menus.js] LvlSelect: Level title path '${lvlTitlePath}' not found in assets.json mainmenu. Keeping default text.`,
            );
          }
        } catch (error) {
          console.error(
            `[menus.js] LvlSelect: Failed to load level title texture for level ${i}:`,
            error,
          );
        }
      }
    }
    console.log("[menus.js] LvlSelect assets loading complete.");
  }

  OnLvlSelect(callback) {
    console.log("[menus.js] OnLvlSelect called");
    console.log("[menus.js] Level frames:", this._levelFrames);
    
    if (!this._levelFrames) {
      console.error("[menus.js] No level frames found!");
      return;
    }

    for (let i = 0; i < this._levelFrames.length; i++) {
      const frame = this._levelFrames[i];
      console.log(`[menus.js] Setting up level frame ${i}:`, frame);
      
      frame.style.pointerEvents = "auto";
      
      frame.addEventListener("click", (e) => {
        console.log(`[menus.js] Level frame ${i} clicked!`, e);
        this.Hide();
        const lvlIndex = parseInt(frame.dataset.lvl, 10);
        const finalIndex = isNaN(lvlIndex) ? i : lvlIndex;
        console.log(`[menus.js] Calling callback with level index: ${finalIndex}`);
        callback(finalIndex);
      });
      

    }
  }
}

class CharSelect extends Menu {
  constructor() {
    super();
    this._wrap = document.getElementById("character-select");
    if (!this._wrap) {
      console.error("CharSelect: '#character-select' element not found!");
    }
    this._characterGrid = document.getElementById("character-grid");
    this._startGameButton = document.getElementById("start-game");
    this._selectedPlayerCount = 2; // Default to 2 players
  }

  async Show() {
    console.log("[menus.js] CharSelect Show() called");
    if (!this._wrap) {
      console.error("[menus.js] CharSelect _wrap is null!");
      return;
    }
    
    this._wrap.style.display = "flex"; // Use flex as per Tailwind classes
    this._wrap.style.pointerEvents = "auto";
    this._wrap.classList.remove("hidden"); // Remove 'hidden' class
    console.log("[menus.js] CharSelect shown. Starting asset load...");

    // Ensure other menus are hidden explicitly
    const mainMenu = document.getElementsByClassName("menu-wrap")[0];
    const lvlSelect = document.getElementsByClassName("lvl-select-wrap")[0];
    
    if (mainMenu) mainMenu.style.display = "none";
    if (lvlSelect) lvlSelect.style.display = "none";

    await Menu.loader.loadManifest(); // Ensure manifest is loaded for player heads
    console.log("[menus.js] CharSelect: Manifest loaded for player heads.");

    // Create player count selector
    const playerCountContainer = document.createElement("div");
    playerCountContainer.className = "mb-8 text-center";
    playerCountContainer.innerHTML = `
      <h2 class="text-2xl mb-4 text-white">How many players?</h2>
      <div class="flex justify-center gap-4">
        ${[1, 2, 3, 4].map(count => `
          <button class="player-count-btn px-4 py-2 rounded-lg border-2 transition ${count === 2 ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-gray-700 border-gray-500 text-gray-300'}" 
                  data-count="${count}">
            ${count} Player${count > 1 ? 's' : ''}
          </button>
        `).join('')}
      </div>
    `;
    
    this._wrap.insertBefore(playerCountContainer, this._characterGrid);
    
    // Add player count button event listeners
    const countButtons = playerCountContainer.querySelectorAll('.player-count-btn');
    countButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectedPlayerCount = parseInt(btn.dataset.count);
        
        // Update button styles
        countButtons.forEach(b => {
          b.className = 'player-count-btn px-4 py-2 rounded-lg border-2 transition bg-gray-700 border-gray-500 text-gray-300';
        });
        btn.className = 'player-count-btn px-4 py-2 rounded-lg border-2 transition bg-yellow-600 border-yellow-400 text-white';
        
        // Update character grid
        this.updateCharacterGrid();
      });
    });

    this.updateCharacterGrid();
  }
  
  async updateCharacterGrid() {
    if (!this._characterGrid) return;
    
    this._characterGrid.innerHTML = "";
    
    for (let i = 0; i < 4; i++) {
      const isHuman = i < this._selectedPlayerCount;
      const charDiv = document.createElement("div");
      charDiv.className = `character-slot p-4 rounded-lg text-white text-center transition ${
        isHuman 
          ? 'bg-blue-800 border-2 border-blue-400 cursor-pointer hover:bg-blue-700' 
          : 'bg-gray-800 border-2 border-gray-600'
      }`;
      charDiv.dataset.charIndex = i;
      charDiv.style.pointerEvents = "auto";

      // Load player head image dynamically
      let imgSrc = "";
      try {
        const playerHeadTexture = await Menu.loader.loadTexture(
          "player_head",
          null,
          i,
        );
        imgSrc = playerHeadTexture.image.src;
        console.log(`[menus.js] CharSelect: Player head ${i} loaded.`);
      } catch (error) {
        console.warn(
          `[menus.js] CharSelect: Failed to load player head ${i}, using placeholder.`,
          error,
        );
        imgSrc = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
      }

      charDiv.innerHTML = `
        <img src="${imgSrc}" alt="Player ${i + 1}" class="w-full h-auto mb-2 object-contain ${!isHuman ? 'opacity-50' : ''}">
        <p class="font-bold">${isHuman ? '👤 HUMAN' : '🤖 AI'}</p>
        <p class="text-sm">Player ${i + 1}</p>
        ${!isHuman ? '<p class="text-xs text-gray-400 mt-1">Computer Controlled</p>' : '<p class="text-xs text-blue-300 mt-1">You Control This</p>'}
      `;
      
      if (isHuman) {
        charDiv.addEventListener("click", () => {
          console.log(`[menus.js] Selected human player slot ${i + 1}`);
          // Could add character customization here
        });
      }
      
      this._characterGrid.appendChild(charDiv);
    }
    console.log("[menus.js] CharSelect assets loading complete.");
  }

  OnStartGame(callback) {
    console.log("[menus.js] OnStartGame called");
    
    if (this._startGameButton) {
      this._startGameButton.style.pointerEvents = "auto";
      
      // Update start button text based on player count
      this._startGameButton.textContent = `START GAME (${this._selectedPlayerCount} Players)`;
      
      this._startGameButton.addEventListener("click", (e) => {
        console.log("[menus.js] Start game button clicked!", e);
        console.log(`[menus.js] Starting game with ${this._selectedPlayerCount} players`);
        this.Hide();
        callback(this._selectedPlayerCount);
      });
      
      console.log("[menus.js] Start game button event listener added");
    } else {
      console.warn("CharSelect: '#start-game' button not found.");
    }
  }
}

export { Mainmenu, LvlSelect, CharSelect };
