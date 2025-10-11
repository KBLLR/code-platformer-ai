import "./styles/index.css";
import { initGame } from "@/Game.js";
import { GetUrlParam } from "@/util.js";
import { Mainmenu, LvlSelect, CharSelect } from "@/menus.js";
import { loadGameConfig } from "@/game_config.js";
import { Sounds } from "@/sounds.js"; // <--- NEW: Import Sounds
import { Onboarding } from "@/onboarding.js"; // <--- NEW: Import Onboarding

console.log(`[main.js] Started game in '${import.meta.env.MODE}' mode`);

const canvas = document.getElementById("game-canvas");
const gameHud = document.getElementById("game-hud");

let selectedLevel = 0;
let selectedCharacterCount = 0;

async function startGame(lvl = 0, characterCount = 0, humanPlayerCount = 1) {
  console.log(
    `[main.js] startGame called with level: ${lvl}, character count: ${characterCount}, human players: ${humanPlayerCount}`,
  );
  await loadGameConfig();
  console.log("[main.js] Game config loaded.");

  // Hide UI containers
  const uiContainer = document.getElementById("ui-container");
  if (uiContainer) {
    // Only hide if you want the canvas to be the primary view
    // Or manage specific menu/HUD visibility through their classes.
    // For now, let's just make sure gameHud is visible
    if (gameHud) gameHud.classList.remove("hidden");
  }

  // Initialize audio context and load sounds
  try {
    // Create audio context on user interaction
    const initAudio = () => {
      if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Resume audio context if suspended
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        console.log("[main.js] Audio context initialized:", audioContext.state);
      }
    };
    
    // Initialize audio on first user interaction
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    
    // Load and play background music
    await Sounds.LoadSounds(() => {
      console.log("[main.js] All sounds initialized.");
      try {
        Sounds.Play("theme", { loop: true, volume: 0.15 });
      } catch (error) {
        console.warn("[main.js] Could not play background music:", error);
      }
    });
  } catch (error) {
    console.warn("[main.js] Sound system failed to initialize:", error);
  }

  initGame(canvas, { 
    lvl, 
    character: characterCount > 0 ? characterCount : 1,
    humanPlayers: humanPlayerCount || 1
  });
  console.log("[main.js] initGame initiated.");
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  console.log("[main.js] DOM ready, initializing app...");
  
  // Check URL state first
  const state = GetUrlParam("state");
  
  if (state === "game") {
    console.log("[main.js] URL param 'state=game' detected. Bypassing menus.");
    const lvlPar = GetUrlParam("lvl");
    let lvl = lvlPar ? parseInt(lvlPar) : 0;
    if (isNaN(lvl)) lvl = 0;
    startGame(lvl, 1); // Start with 1 player by default if bypassing menus
  } else if (state === "onboarding") {
    console.log("[main.js] Onboarding state detected.");
    setupOnboardingFlow();
  } else {
    // Check authentication and onboarding status
    if (!Onboarding.isLoggedIn()) {
      console.log("[main.js] User not logged in, redirecting to landing page.");
      window.location.href = 'landing.html';
      return;
    }
    
    if (!Onboarding.hasCompletedOnboarding()) {
      console.log("[main.js] User logged in but hasn't completed onboarding.");
      setupOnboardingFlow();
    } else {
      console.log("[main.js] User authenticated and onboarded, starting menu flow.");
      setupMenuFlow();
    }
  }
}

async function setupOnboardingFlow() {
  console.log("[main.js] Setting up onboarding flow...");
  
  const onboarding = new Onboarding();
  window.onboarding = onboarding; // Make globally accessible for button clicks
  
  await onboarding.Show();
  
  onboarding.OnComplete((startMode) => {
    console.log(`[main.js] Onboarding completed with mode: ${startMode}`);
    
    if (startMode === 'practice') {
      // Start practice game directly
      startGame(0, 1, 1); // Level 0, 1 character, 1 human player
    } else {
      // Show menu flow for multiplayer
      setupMenuFlow();
    }
  });
}

async function setupMenuFlow() {
  const mainmenu = new Mainmenu();
  await mainmenu.Show(); // Will set menu-wrap to 'block'
  console.log("[main.js] Mainmenu.Show() called.");

  mainmenu.OnButton("start", async () => {
    console.log("[main.js] Mainmenu 'start' button clicked. Hiding main menu.");
    // mainmenu.Hide() is called by OnButton internally

    const lvlSelect = new LvlSelect();
    await lvlSelect.Show(); // Will set lvl-select-wrap to 'block' and load assets
    console.log("[main.js] LvlSelect.Show() called.");

    lvlSelect.OnLvlSelect(async (lvl) => {
      selectedLevel = lvl;
      console.log(
        `[main.js] Level selected: ${selectedLevel}. Hiding level select.`,
      );
      // lvlSelect.Hide() is called by OnLvlSelect internally

      const charSelect = new CharSelect();
      await charSelect.Show(); // Will set character-select to 'flex' and load assets
      console.log("[main.js] CharSelect.Show() called.");

      charSelect.OnStartGame(() => {
        // This callback now explicitly receives the character count.
        // It's up to CharSelect to manage how this count is determined (e.g., from UI selection).
        // For debugging, we'll hardcode it for now.
        selectedCharacterCount = 2; // Hardcode 2 players for testing via menu flow
        console.log(
          `[main.js] CharSelect 'START' button clicked. Starting game with level ${selectedLevel}, characters ${selectedCharacterCount}.`,
        );
        startGame(selectedLevel, selectedCharacterCount);
      });
    });
  });
}
