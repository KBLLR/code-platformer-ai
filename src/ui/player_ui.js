export function initPlayerUI(players) {
  if (!Array.isArray(players)) players = [];
  document.getElementById("player-hud").style.display = "block";
  for (let i = 0; i < 4; i++) {
    const ui = document.getElementById(`player-${i}-ui`);
    ui.style.display = i < players.length ? "flex" : "none";
  }
  updatePlayerUI(players);
}

export function updatePlayerUI(players) {
  if (!Array.isArray(players)) players = [];
  for (let i = 0; i < 4; i++) {
    const ui = document.getElementById(`player-${i}-ui`);
    if (!ui) continue;
    const player = players[i];
    if (!player) {
      ui.style.display = "none";
      continue;
    }
    ui.style.display = "flex";
    ui.className = "player-ui";
    if (player.dead || player.health <= 0) ui.classList.add("dead");
    if (player.hasMoney) ui.classList.add("carrier");

    ui.innerHTML = `
      <div class="player-head">
        <img src="${player.headImg || "/assets/images/player_head/player_head_" + i + ".png"}" alt="P${i + 1}" />
      </div>
      <div style="flex:1">
        <div class="player-score">$${player.money || 0}</div>
        <div class="player-health-bar">
          <div class="player-health-bar-inner" style="width:${Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100))}%;"></div>
        </div>
      </div>
      <div class="player-money">
        ${player.hasMoney ? `<img src="/assets/images/diverse/money.png" alt="Money" />` : ""}
      </div>
      <div class="player-weapon">
        <img src="${player.currentWeapon ? `/assets/images/${player.currentWeapon.type}/${player.currentWeapon.type}_0.png` : "/assets/images/diverse/coffee_cup.png"}" alt="Weapon" />
      </div>
    `;
  }
}
