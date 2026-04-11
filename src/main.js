import "./styles/index.css";
import { ToyboxArenaApp } from "./app/ToyboxArenaApp.js";

async function boot() {
  const canvas = document.getElementById("game-canvas");
  const uiContainer = document.getElementById("ui-container");
  if (!canvas || !uiContainer) {
    throw new Error("Toybox Arena boot failed: missing root DOM nodes");
  }

  const app = new ToyboxArenaApp({ canvas, uiContainer });
  await app.init();
  app.start();

  window.__toyboxApp = app;
  window.render_game_to_text = () => app.renderGameToText();
  window.advanceTime = (ms) => app.advanceTime(ms);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
} else {
  void boot();
}
