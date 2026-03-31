const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const hpValue = document.getElementById("hpValue");
const bestValue = document.getElementById("bestValue");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverSummary = document.getElementById("gameOverSummary");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const STORAGE_KEY = "sky-patrol-prototype-best-score";
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const game = {
  state: "title",
  lastTime: 0,
  spawnTimer: 0,
  fireTimer: 0,
  score: 0,
  bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
  pointerActive: false,
  stars: createStars(40),
  player: null,
  bullets: [],
  enemies: [],
  explosions: [],
  floatingTexts: [],
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
  },
};

bestValue.textContent = String(game.bestScore);

function createPlayer() {
  return {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 120,
    width: 34,
    height: 48,
    hp: 5,
    targetX: GAME_WIDTH / 2,
    targetY: GAME_HEIGHT - 120,
    invulnerableTimer: 0,
  };
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    radius: Math.random() * 2 + 1,
    speed: Math.random() * 60 + 30,
    alpha: Math.random() * 0.5 + 0.3,
  }));
}

function resetGame() {
  game.player = createPlayer();
  game.bullets = [];
  game.enemies = [];
  game.explosions = [];
  game.floatingTexts = [];
  game.spawnTimer = 0;
  game.fireTimer = 0;
  game.score = 0;
  game.state = "playing";
  game.lastTime = performance.now();
  scoreValue.textContent = "0";
  hpValue.textContent = String(game.player.hp);
  hideOverlay(startOverlay);
  hideOverlay(gameOverOverlay);
}

function startGame() {
  resetGame();
}

function endGame() {
  game.state = "gameover";
  game.bestScore = Math.max(game.bestScore, game.score);
  localStorage.setItem(STORAGE_KEY, String(game.bestScore));
  bestValue.textContent = String(game.bestScore);
  gameOverSummary.textContent = `Score: ${game.score} | Best: ${game.bestScore}`;
  showOverlay(gameOverOverlay);
}

function showOverlay(element) {
  element.classList.add("visible");
}

function hideOverlay(element) {
  element.classList.remove("visible");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function spawnEnemy() {
  const laneWidth = 48 + Math.random() * 18;
  const hp = Math.random() < 0.18 ? 3 : 1;
  const speed = 120 + Math.random() * 100 + game.score * 0.3;
  game.enemies.push({
    x: 40 + Math.random() * (GAME_WIDTH - 80),
    y: -60,
    width: laneWidth,
    height: laneWidth * 0.88,
    speed,
    hp,
    scoreValue: hp * 10,
  });
}

function fireBullet() {
  const player = game.player;
  game.bullets.push(
    {
      x: player.x - 10,
      y: player.y - player.height * 0.42,
      width: 6,
      height: 16,
      speed: 580,
    },
    {
      x: player.x + 10,
      y: player.y - player.height * 0.42,
      width: 6,
      height: 16,
      speed: 580,
    }
  );
}

function addExplosion(x, y, color) {
  game.explosions.push({
    x,
    y,
    radius: 10,
    life: 0.28,
    maxLife: 0.28,
    color,
  });
}

function addFloatingText(x, y, text, color = "#ffe066") {
  game.floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 0.55,
    maxLife: 0.55,
  });
}

function update(deltaSeconds) {
  updateStars(deltaSeconds);

  if (game.state !== "playing") {
    updateExplosions(deltaSeconds);
    return;
  }

  const player = game.player;
  player.invulnerableTimer = Math.max(0, player.invulnerableTimer - deltaSeconds);

  const keyboardVectorX = Number(game.input.right) - Number(game.input.left);
  const keyboardVectorY = Number(game.input.down) - Number(game.input.up);
  const keyboardActive = keyboardVectorX !== 0 || keyboardVectorY !== 0;

  if (keyboardActive) {
    const moveSpeed = 320;
    player.x += keyboardVectorX * moveSpeed * deltaSeconds;
    player.y += keyboardVectorY * moveSpeed * deltaSeconds;
    player.targetX = player.x;
    player.targetY = player.y;
  } else {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const followStrength = Math.min(1, deltaSeconds * 12);
    player.x += dx * followStrength;
    player.y += dy * followStrength;
  }

  player.x = clamp(player.x, player.width / 2 + 8, GAME_WIDTH - player.width / 2 - 8);
  player.y = clamp(player.y, 70, GAME_HEIGHT - player.height / 2 - 18);

  game.spawnTimer -= deltaSeconds;
  if (game.spawnTimer <= 0) {
    spawnEnemy();
    game.spawnTimer = Math.max(0.32, 0.95 - game.score * 0.004);
  }

  game.fireTimer -= deltaSeconds;
  if (game.fireTimer <= 0) {
    fireBullet();
    game.fireTimer = 0.18;
  }

  for (const bullet of game.bullets) {
    bullet.y -= bullet.speed * deltaSeconds;
  }
  game.bullets = game.bullets.filter((bullet) => bullet.y + bullet.height > 0);

  for (const enemy of game.enemies) {
    enemy.y += enemy.speed * deltaSeconds;
  }

  handleBulletCollisions();
  handlePlayerCollisions();

  for (const enemy of game.enemies) {
    if (enemy.y - enemy.height / 2 > GAME_HEIGHT + 10) {
      enemy.hp = 0;
      damagePlayer(1);
    }
  }

  game.enemies = game.enemies.filter((enemy) => enemy.y - enemy.height < GAME_HEIGHT + 40 && enemy.hp > 0);

  updateExplosions(deltaSeconds);
  scoreValue.textContent = String(game.score);
  hpValue.textContent = String(player.hp);

  if (player.hp <= 0) {
    endGame();
  }
}

function updateStars(deltaSeconds) {
  for (const star of game.stars) {
    star.y += star.speed * deltaSeconds;
    if (star.y > GAME_HEIGHT) {
      star.y = -8;
      star.x = Math.random() * GAME_WIDTH;
    }
  }
}

function updateExplosions(deltaSeconds) {
  for (const burst of game.explosions) {
    burst.life -= deltaSeconds;
    burst.radius += 110 * deltaSeconds;
  }
  game.explosions = game.explosions.filter((burst) => burst.life > 0);

  for (const text of game.floatingTexts) {
    text.life -= deltaSeconds;
    text.y -= 38 * deltaSeconds;
  }
  game.floatingTexts = game.floatingTexts.filter((text) => text.life > 0);
}

function handleBulletCollisions() {
  const remainingBullets = [];

  for (const bullet of game.bullets) {
    let hit = false;

    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }

      if (intersects(bullet, enemy)) {
        enemy.hp -= 1;
        hit = true;
        addExplosion(bullet.x, bullet.y, "#68e0ff");

        if (enemy.hp <= 0) {
          game.score += enemy.scoreValue;
          addExplosion(enemy.x, enemy.y, "#ff9f43");
          addFloatingText(enemy.x, enemy.y, `+${enemy.scoreValue}`);
        }
        break;
      }
    }

    if (!hit) {
      remainingBullets.push(bullet);
    }
  }

  game.bullets = remainingBullets;
}

function handlePlayerCollisions() {
  const player = game.player;

  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    if (intersects(player, enemy)) {
      enemy.hp = 0;
      addExplosion(enemy.x, enemy.y, "#ff6b6b");
      damagePlayer(1);
    }
  }
}

function damagePlayer(amount) {
  const player = game.player;
  if (player.invulnerableTimer > 0) {
    return;
  }

  player.hp -= amount;
  player.invulnerableTimer = 1.1;
  addExplosion(player.x, player.y, "#ff6b6b");

  const clearRadius = 110;
  for (const enemy of game.enemies) {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (enemy.hp > 0 && distance <= clearRadius) {
      enemy.hp = 0;
      addExplosion(enemy.x, enemy.y, "#ffd166");
    }
  }
}

function intersects(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height
  );
}

function draw() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBackground();
  drawStars();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawExplosions();
  drawFloatingTexts();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, "#081425");
  gradient.addColorStop(1, "#133456");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < GAME_HEIGHT; y += 120) {
    ctx.fillRect(0, y + 40, GAME_WIDTH, 2);
  }
}

function drawStars() {
  for (const star of game.stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (!game.player) {
    return;
  }

  const player = game.player;
  const flashing = player.invulnerableTimer > 0 && Math.floor(player.invulnerableTimer * 12) % 2 === 0;
  if (flashing) {
    ctx.globalAlpha = 0.45;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "#8af5ff";
  ctx.beginPath();
  ctx.moveTo(0, -player.height / 2);
  ctx.lineTo(player.width / 2, player.height / 2);
  ctx.lineTo(0, player.height / 4);
  ctx.lineTo(-player.width / 2, player.height / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffe066";
  ctx.fillRect(-5, -6, 10, 18);

  ctx.fillStyle = "#ff8c42";
  ctx.beginPath();
  ctx.moveTo(-8, player.height / 2 - 4);
  ctx.lineTo(0, player.height / 2 + 14);
  ctx.lineTo(8, player.height / 2 - 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBullets() {
  ctx.fillStyle = "#ffe066";
  for (const bullet of game.bullets) {
    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
  }
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.fillStyle = enemy.hp > 1 ? "#ff9f43" : "#ff6b6b";
    ctx.beginPath();
    ctx.moveTo(0, enemy.height / 2);
    ctx.lineTo(enemy.width / 2, -enemy.height / 2);
    ctx.lineTo(0, -enemy.height / 4);
    ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#2d4059";
    ctx.fillRect(-8, -6, 16, 12);
    ctx.restore();
  }
}

function drawExplosions() {
  for (const burst of game.explosions) {
    const alpha = burst.life / burst.maxLife;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = burst.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
  ctx.textAlign = "center";
  ctx.font = "bold 22px Trebuchet MS, Segoe UI, sans-serif";
  for (const text of game.floatingTexts) {
    ctx.globalAlpha = text.life / text.maxLife;
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
}

function gameLoop(timestamp) {
  const deltaSeconds = Math.min(0.033, (timestamp - game.lastTime) / 1000 || 0);
  game.lastTime = timestamp;
  update(deltaSeconds);
  draw();
  requestAnimationFrame(gameLoop);
}

function setPointerTarget(event) {
  if (!game.player) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = GAME_WIDTH / rect.width;
  const scaleY = GAME_HEIGHT / rect.height;
  game.player.targetX = (event.clientX - rect.left) * scaleX;
  game.player.targetY = (event.clientY - rect.top) * scaleY;
}

function setInputDirection(key, pressed) {
  if (key === "arrowup" || key === "w") game.input.up = pressed;
  if (key === "arrowdown" || key === "s") game.input.down = pressed;
  if (key === "arrowleft" || key === "a") game.input.left = pressed;
  if (key === "arrowright" || key === "d") game.input.right = pressed;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === " " || key === "enter") {
    event.preventDefault();
    if (game.state === "title" || game.state === "gameover") {
      startGame();
    }
    return;
  }

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    setInputDirection(key, true);
  }
});

window.addEventListener("keyup", (event) => {
  setInputDirection(event.key.toLowerCase(), false);
});

canvas.addEventListener("pointerdown", (event) => {
  game.pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  setPointerTarget(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (game.state !== "playing" && game.state !== "title") {
    return;
  }
  if (game.pointerActive || event.pointerType === "mouse") {
    setPointerTarget(event);
  }
});

canvas.addEventListener("pointerup", () => {
  game.pointerActive = false;
});

canvas.addEventListener("pointercancel", () => {
  game.pointerActive = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

draw();
requestAnimationFrame((timestamp) => {
  game.lastTime = timestamp;
  requestAnimationFrame(gameLoop);
});
