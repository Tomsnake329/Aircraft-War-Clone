const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const hpValue = document.getElementById("hpValue");
const bestValue = document.getElementById("bestValue");
const powerValue = document.getElementById("powerValue");
const nextTierValue = document.getElementById("nextTierValue");
const timeValue = document.getElementById("timeValue");
const threatValue = document.getElementById("threatValue");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverSummary = document.getElementById("gameOverSummary");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const STORAGE_KEY = "sky-patrol-prototype-best-score";
const BEST_TIME_KEY = "sky-patrol-prototype-best-time";
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const BASE_FIRE_INTERVAL = 0.22;
const spriteLibrary = createSpriteLibrary();
const POWERUP_DEFS = {
  spread: {
    label: "Spread",
    color: "#8ff8ff",
    accent: "#14304c",
    duration: 8,
  },
  rapid: {
    label: "Rapid",
    color: "#ffd166",
    accent: "#5c2f00",
    duration: 6,
  },
};

const game = {
  state: "title",
  lastTime: 0,
  spawnTimer: 0,
  fireTimer: 0,
  elapsed: 0,
  score: 0,
  bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
  bestTime: Number(localStorage.getItem(BEST_TIME_KEY) || 0),
  pointerActive: false,
  stars: createStars(48),
  player: null,
  bullets: [],
  enemies: [],
  warnings: [],
  powerUps: [],
  explosions: [],
  screenFlash: 0,
  screenShake: 0,
  surgeBannerTimer: 0,
  surgeTimer: 0,
  surgeFollowupTimer: 0,
  surgeWarningTimer: 0,
  surgeWarningLevel: 0,
  lastThreatLevel: 0,
  pauseReason: "manual",
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
  },
};

bestValue.textContent = String(game.bestScore);
powerValue.textContent = "Standard";
nextTierValue.textContent = "90 pts";
timeValue.textContent = "0.0s";
threatValue.textContent = "Lv 0";

function createSpriteLibrary() {
  const assets = {
    player: './assets/images/processed/player.png',
    playerHit: './assets/images/processed/player_hit.png',
    playerShieldHit: './assets/images/processed/shield_hit.png',
    playerBullet: './assets/images/processed/player_bullet.png',
    enemyScout: './assets/images/processed/enemy_scout.png',
    enemyTank: './assets/images/processed/enemy_tank.png',
    enemyElite: './assets/images/processed/enemy_elite.png',
    enemyBoss: './assets/images/processed/enemy_boss.png',
    enemyBullet: './assets/images/processed/enemy_bullet.png',
    hitSpark: './assets/images/hit-spark.jpg',
    explosionSmall: './assets/images/processed/explosion_small.png',
    explosionMedium: './assets/images/processed/explosion_medium.png',
    powerupRapid: './assets/images/processed/powerup_rapid.png',
    powerupSpread: './assets/images/processed/powerup_spread.png',
    weaponRapid: './assets/images/weapon-rapid.jpg',
    weaponSpread: './assets/images/weapon-spread.jpg',
    iconHp: './assets/images/icon-hp.jpg',
  };

  const images = {};
  for (const [key, src] of Object.entries(assets)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    images[key] = image;
  }
  return images;
}

function drawImageCover(image, x, y, width, height, alpha = 1) {
  if (!image || !image.complete || !image.naturalWidth) {
    return false;
  }

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
  return true;
}

function createPlayer() {
  return {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 120,
    width: 34,
    height: 48,
    hp: 5,
    maxHp: 5,
    targetX: GAME_WIDTH / 2,
    targetY: GAME_HEIGHT - 120,
    invulnerableTimer: 0,
    hitFlash: 0,
    weapon: {
      mode: "standard",
      timer: 0,
    },
  };
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    radius: Math.random() * 2 + 1,
    speed: Math.random() * 70 + 25,
    alpha: Math.random() * 0.45 + 0.28,
  }));
}

function resetGame() {
  game.player = createPlayer();
  game.bullets = [];
  game.enemies = [];
  game.warnings = [];
  game.powerUps = [];
  game.explosions = [];
  game.spawnTimer = 0.35;
  game.fireTimer = 0;
  game.elapsed = 0;
  game.score = 0;
  game.screenFlash = 0;
  game.screenShake = 0;
  game.surgeBannerTimer = 0;
  game.surgeTimer = 0;
  game.surgeFollowupTimer = 0;
  game.surgeWarningTimer = 0;
  game.surgeWarningLevel = 0;
  game.pauseReason = "manual";
  game.lastThreatLevel = 0;
  game.state = "playing";
  game.lastTime = performance.now();
  scoreValue.textContent = "0";
  hpValue.textContent = String(game.player.hp);
  powerValue.textContent = "Standard";
  nextTierValue.textContent = `${getNextTierTarget()} pts`;
  timeValue.textContent = "0.0s";
  threatValue.textContent = `Lv ${getThreatLevel()}`;
  updateHudArt();
  hideOverlay(startOverlay);
  hideOverlay(gameOverOverlay);
}

function formatSeconds(value) {
  return `${Number(value || 0).toFixed(1)}s`;
}

function startGame() {
  resetGame();
}

function togglePause(reason = "manual") {
  if (game.state === "playing") {
    game.state = "paused";
    game.pauseReason = reason;
    game.input.up = false;
    game.input.down = false;
    game.input.left = false;
    game.input.right = false;
    return;
  }

  if (game.state === "paused") {
    game.state = "playing";
    game.pauseReason = "manual";
    game.lastTime = performance.now();
  }
}

function endGame() {
  game.state = "gameover";
  game.bestScore = Math.max(game.bestScore, game.score);
  game.bestTime = Math.max(game.bestTime, game.elapsed);
  localStorage.setItem(STORAGE_KEY, String(game.bestScore));
  localStorage.setItem(BEST_TIME_KEY, String(game.bestTime));
  bestValue.textContent = String(game.bestScore);
  gameOverSummary.textContent = `Score: ${game.score} | Best: ${game.bestScore} | Time: ${formatSeconds(game.elapsed)} | Best Time: ${formatSeconds(game.bestTime)}`;
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

function getThreatLevel() {
  return Math.min(7, Math.floor(game.elapsed / 11) + Math.floor(game.score / 90));
}

function getSpawnInterval() {
  const level = getThreatLevel();
  const baseInterval = Math.max(0.42, 1.15 - level * 0.08);
  return game.surgeTimer > 0 ? Math.max(0.3, baseInterval * 0.82) : baseInterval;
}

function getNextTierTarget() {
  const scoreTierTarget = (Math.floor(game.score / 90) + 1) * 90;
  return scoreTierTarget;
}

function queueEnemyWave() {
  const level = getThreatLevel();
  const patternRoll = Math.random();

  if (level >= 6 && patternRoll > 0.88) {
    spawnBossPattern(level);
    return;
  }

  if (level >= 2 && patternRoll > 0.74) {
    spawnHeavyPattern(level);
    return;
  }

  if (level >= 1 && patternRoll > 0.42) {
    spawnSweepPattern(level);
    return;
  }

  spawnLinePattern(level);
}

function spawnLinePattern(level) {
  const count = Math.min(5, 3 + Math.floor(level / 2));
  const spacing = GAME_WIDTH / (count + 1);

  for (let index = 0; index < count; index += 1) {
    const x = spacing * (index + 1);
    addWarning({
      x,
      y: 54,
      delay: 0.6 + index * 0.08,
      enemyConfig: createEnemyConfig("scout", x),
    });
  }
}

function spawnSweepPattern(level) {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const baseX = direction > 0 ? 72 : GAME_WIDTH - 72;
  const gap = 88;

  for (let index = 0; index < 3; index += 1) {
    const x = clamp(baseX + direction * gap * index, 60, GAME_WIDTH - 60);
    addWarning({
      x,
      y: 46,
      delay: 0.45 + index * 0.16,
      enemyConfig: createEnemyConfig("zigzag", x, { zigzagPhase: index * 0.8 }),
    });
  }

  if (level >= 3) {
    addWarning({
      x: GAME_WIDTH - baseX,
      y: 52,
      delay: 0.92,
      enemyConfig: createEnemyConfig("scout", GAME_WIDTH - baseX),
    });
  }
}

function spawnHeavyPattern(level) {
  const centerX = GAME_WIDTH / 2;
  addWarning({
    x: centerX,
    y: 44,
    delay: 0.95,
    enemyConfig: createEnemyConfig("tank", centerX),
    big: true,
  });

  const escortOffset = 110;
  addWarning({
    x: centerX - escortOffset,
    y: 58,
    delay: 0.62,
    enemyConfig: createEnemyConfig("zigzag", centerX - escortOffset, { zigzagPhase: 0.6 }),
  });
  addWarning({
    x: centerX + escortOffset,
    y: 58,
    delay: 0.7,
    enemyConfig: createEnemyConfig("zigzag", centerX + escortOffset, { zigzagPhase: 1.4 }),
  });

  if (level >= 5) {
    addWarning({
      x: centerX,
      y: 86,
      delay: 1.32,
      enemyConfig: createEnemyConfig("scout", centerX),
    });
  }
}

function spawnBossPattern(level) {
  const centerX = GAME_WIDTH / 2;

  addWarning({
    x: centerX,
    y: 34,
    delay: 0.88,
    enemyConfig: createEnemyConfig('boss', centerX, { dropPowerUp: false }),
    big: true,
  });

  addWarning({
    x: centerX - 120,
    y: 68,
    delay: 0.42,
    enemyConfig: createEnemyConfig('zigzag', centerX - 120, { zigzagPhase: 0.4 }),
    big: true,
  });
  addWarning({
    x: centerX + 120,
    y: 68,
    delay: 0.48,
    enemyConfig: createEnemyConfig('zigzag', centerX + 120, { zigzagPhase: 1.1 }),
    big: true,
  });
}

function spawnSurgePattern(level) {
  const centerX = GAME_WIDTH / 2;
  const sideOffset = 118;

  addWarning({
    x: centerX,
    y: 42,
    delay: 0.52,
    enemyConfig: createEnemyConfig(level >= 4 ? "tank" : "zigzag", centerX),
    big: true,
  });

  addWarning({
    x: centerX - sideOffset,
    y: 54,
    delay: 0.28,
    enemyConfig: createEnemyConfig("zigzag", centerX - sideOffset, { zigzagPhase: 0.5 }),
  });
  addWarning({
    x: centerX + sideOffset,
    y: 54,
    delay: 0.34,
    enemyConfig: createEnemyConfig("zigzag", centerX + sideOffset, { zigzagPhase: 1.3 }),
  });

  addWarning({
    x: centerX - 54,
    y: 82,
    delay: 0.72,
    enemyConfig: createEnemyConfig("scout", centerX - 54),
  });
  addWarning({
    x: centerX + 54,
    y: 82,
    delay: 0.78,
    enemyConfig: createEnemyConfig("scout", centerX + 54),
  });
}

function triggerThreatSurge(level) {
  game.surgeWarningLevel = level;
  game.surgeWarningTimer = 1.15;
  game.surgeBannerTimer = 3.2;
  game.surgeTimer = 7.2;
  game.surgeFollowupTimer = 3.15;
  game.screenFlash = Math.max(game.screenFlash, 0.15);
  game.screenShake = Math.max(game.screenShake, 6);
}

function addWarning({ x, y, delay, enemyConfig, big = false }) {
  game.warnings.push({
    x,
    y,
    delay,
    duration: delay,
    enemyConfig,
    big,
  });
}

function createEnemyConfig(type, x, overrides = {}) {
  const level = getThreatLevel();

  if (type === "tank") {
    return {
      type,
      x,
      y: -82,
      width: 60,
      height: 58,
      hp: 5 + Math.floor(level / 2),
      maxHp: 5 + Math.floor(level / 2),
      speed: 110 + level * 8,
      scoreValue: 45 + level * 4,
      swayAmplitude: 18,
      swaySpeed: 1.2,
      dropPowerUp: Math.random() > 0.15,
      ...overrides,
    };
  }

  if (type === 'boss') {
    return {
      type,
      x,
      y: -120,
      width: 110,
      height: 104,
      hp: 14 + level,
      maxHp: 14 + level,
      speed: 92 + level * 5,
      scoreValue: 180 + level * 14,
      swayAmplitude: 28,
      swaySpeed: 0.9,
      dropPowerUp: false,
      ...overrides,
    };
  }

  if (type === "zigzag") {
    return {
      type,
      x,
      y: -56,
      width: 42,
      height: 38,
      hp: 2 + (level >= 4 ? 1 : 0),
      maxHp: 2 + (level >= 4 ? 1 : 0),
      speed: 180 + level * 10,
      scoreValue: 18 + level * 3,
      swayAmplitude: 44,
      swaySpeed: 2.2,
      ...overrides,
    };
  }

  return {
    type: "scout",
    x,
    y: -42,
    width: 34,
    height: 30,
    hp: 1 + (level >= 6 ? 1 : 0),
    maxHp: 1 + (level >= 6 ? 1 : 0),
    speed: 220 + level * 16,
    scoreValue: 10 + level * 2,
    swayAmplitude: 14,
    swaySpeed: 1.6,
    ...overrides,
  };
}

function spawnEnemyFromConfig(config) {
  game.enemies.push({
    ...config,
    baseX: config.x,
    age: 0,
    hitFlash: 0,
  });
}

function fireBullet() {
  const player = game.player;
  const spreadActive = player.weapon.mode === "spread";
  const rapidActive = player.weapon.mode === "rapid";
  const bulletSpeed = spreadActive ? 660 : rapidActive ? 640 : 600;
  const bulletColor = spreadActive ? "#8ff8ff" : rapidActive ? "#ffd166" : "#ffe066";
  const shots = spreadActive
    ? [
        { offsetX: -12, velocityX: -110 },
        { offsetX: 0, velocityX: 0 },
        { offsetX: 12, velocityX: 110 },
      ]
    : [
        { offsetX: -9, velocityX: -18 },
        { offsetX: 9, velocityX: 18 },
      ];

  for (const shot of shots) {
    game.bullets.push({
      x: player.x + shot.offsetX,
      y: player.y - player.height * 0.42,
      width: spreadActive ? 7 : 6,
      height: spreadActive ? 18 : 16,
      speed: bulletSpeed,
      velocityX: shot.velocityX,
      color: bulletColor,
    });
  }
}

function spawnPowerUp(x, y, type = "spread") {
  const powerUpDef = POWERUP_DEFS[type] || POWERUP_DEFS.spread;
  game.powerUps.push({
    x,
    y,
    type,
    label: powerUpDef.label,
    color: powerUpDef.color,
    accent: powerUpDef.accent,
    width: 24,
    height: 24,
    speed: 140,
    bob: Math.random() * Math.PI * 2,
  });
}

function addExplosion(x, y, color, size = 1) {
  game.explosions.push({
    x,
    y,
    radius: 10 * size,
    life: 0.32 + size * 0.08,
    maxLife: 0.32 + size * 0.08,
    color,
    size,
  });
}

function update(deltaSeconds) {
  updateStars(deltaSeconds);
  updateEffects(deltaSeconds);

  if (game.state === "paused") {
    return;
  }

  if (game.state !== "playing") {
    updateExplosions(deltaSeconds);
    return;
  }

  game.elapsed += deltaSeconds;
  updateWarnings(deltaSeconds);

  const threatLevel = getThreatLevel();
  if (threatLevel > game.lastThreatLevel) {
    game.lastThreatLevel = threatLevel;
    triggerThreatSurge(threatLevel);
  }

  if (game.surgeWarningTimer > 0 && game.surgeWarningTimer <= 0.55 && game.surgeFollowupTimer > 2.9) {
    spawnSurgePattern(threatLevel);
    game.surgeFollowupTimer = Math.min(game.surgeFollowupTimer, 2.15);
  }

  if (game.surgeTimer > 0) {
    game.surgeFollowupTimer -= deltaSeconds;
    if (game.surgeFollowupTimer <= 0) {
      spawnSurgeFollowupPattern(threatLevel);
      game.surgeFollowupTimer = Number.POSITIVE_INFINITY;
    }
  }

  const player = game.player;
  player.invulnerableTimer = Math.max(0, player.invulnerableTimer - deltaSeconds);
  player.hitFlash = Math.max(0, player.hitFlash - deltaSeconds);
  player.weapon.timer = Math.max(0, player.weapon.timer - deltaSeconds);

  if (player.weapon.mode !== "standard" && player.weapon.timer <= 0) {
    player.weapon.mode = "standard";
  }

  updatePlayerMovement(deltaSeconds);

  game.spawnTimer -= deltaSeconds;
  if (game.spawnTimer <= 0) {
    queueEnemyWave();
    game.spawnTimer = getSpawnInterval();
  }

  game.fireTimer -= deltaSeconds;
  if (game.fireTimer <= 0) {
    fireBullet();
    game.fireTimer = getFireInterval(player.weapon.mode);
  }

  updateBullets(deltaSeconds);
  updateEnemies(deltaSeconds);
  updatePowerUps(deltaSeconds);
  handleBulletCollisions();
  handlePowerUpCollection();
  handlePlayerCollisions();
  handleEscapedEnemies();
  cleanupEntities();
  updateExplosions(deltaSeconds);

  scoreValue.textContent = String(game.score);
  hpValue.textContent = String(player.hp);
  powerValue.textContent = getWeaponHudLabel();
  nextTierValue.textContent = `${Math.max(0, getNextTierTarget() - game.score)} pts`;
  timeValue.textContent = `${game.elapsed.toFixed(1)}s`;
  threatValue.textContent = `Lv ${threatLevel}`;

  if (player.hp <= 0) {
    endGame();
  }

  updateHudArt();
}

function updatePlayerMovement(deltaSeconds) {
  const player = game.player;
  const keyboardVectorX = Number(game.input.right) - Number(game.input.left);
  const keyboardVectorY = Number(game.input.down) - Number(game.input.up);
  const keyboardActive = keyboardVectorX !== 0 || keyboardVectorY !== 0;

  if (keyboardActive) {
    const moveSpeed = 330;
    player.x += keyboardVectorX * moveSpeed * deltaSeconds;
    player.y += keyboardVectorY * moveSpeed * deltaSeconds;
    player.targetX = player.x;
    player.targetY = player.y;
  } else {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const followStrength = Math.min(1, deltaSeconds * 13);
    player.x += dx * followStrength;
    player.y += dy * followStrength;
  }

  player.x = clamp(player.x, player.width / 2 + 8, GAME_WIDTH - player.width / 2 - 8);
  player.y = clamp(player.y, 70, GAME_HEIGHT - player.height / 2 - 18);
}

function updateBullets(deltaSeconds) {
  for (const bullet of game.bullets) {
    bullet.y -= bullet.speed * deltaSeconds;
    bullet.x += bullet.velocityX * deltaSeconds;
  }
}

function updateEnemies(deltaSeconds) {
  for (const enemy of game.enemies) {
    enemy.age += deltaSeconds;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - deltaSeconds);
    enemy.y += enemy.speed * deltaSeconds;
    enemy.x = enemy.baseX + Math.sin(enemy.age * enemy.swaySpeed + (enemy.zigzagPhase || 0)) * enemy.swayAmplitude;
  }
}

function updateWarnings(deltaSeconds) {
  const pending = [];

  for (const warning of game.warnings) {
    warning.delay -= deltaSeconds;
    if (warning.delay <= 0) {
      spawnEnemyFromConfig(warning.enemyConfig);
      addExplosion(warning.x, warning.y + 24, warning.big ? "#ffd166" : "#68e0ff", warning.big ? 1.35 : 0.8);
    } else {
      pending.push(warning);
    }
  }

  game.warnings = pending;
}

function updatePowerUps(deltaSeconds) {
  for (const powerUp of game.powerUps) {
    powerUp.y += powerUp.speed * deltaSeconds;
    powerUp.bob += deltaSeconds * 3.6;
  }
}

function getFireInterval(mode) {
  if (mode === "spread") {
    return 0.11;
  }
  if (mode === "rapid") {
    return 0.08;
  }
  return BASE_FIRE_INTERVAL;
}

function getWeaponHudLabel() {
  const weapon = game.player.weapon;
  if (weapon.mode === "standard") {
    return "Standard";
  }

  const powerUpDef = POWERUP_DEFS[weapon.mode] || POWERUP_DEFS.spread;
  return `${powerUpDef.label} ${weapon.timer.toFixed(1)}s`;
}

function updateHudArt() {
  const weaponIcon = document.querySelector('.hud-inline-icon--weapon');
  if (!weaponIcon || !game.player) return;
  const weapon = game.player.weapon.mode;
  weaponIcon.style.backgroundImage = weapon === 'rapid'
    ? "url('./assets/images/weapon-rapid.jpg')"
    : weapon === 'spread'
      ? "url('./assets/images/weapon-spread.jpg')"
      : "url('./assets/images/player-bullet.jpg')";
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

function updateEffects(deltaSeconds) {
  game.screenFlash = Math.max(0, game.screenFlash - deltaSeconds * 2.8);
  game.screenShake = Math.max(0, game.screenShake - deltaSeconds * 18);
  game.surgeBannerTimer = Math.max(0, game.surgeBannerTimer - deltaSeconds);
  game.surgeTimer = Math.max(0, game.surgeTimer - deltaSeconds);
  game.surgeWarningTimer = Math.max(0, game.surgeWarningTimer - deltaSeconds);
}

function spawnSurgeFollowupPattern(level) {
  const leftX = 78;
  const rightX = GAME_WIDTH - 78;
  const centerX = GAME_WIDTH / 2;

  addWarning({
    x: leftX,
    y: 40,
    delay: 0.26,
    enemyConfig: createEnemyConfig("zigzag", leftX, { zigzagPhase: 0.2 }),
    big: true,
  });
  addWarning({
    x: rightX,
    y: 40,
    delay: 0.32,
    enemyConfig: createEnemyConfig("zigzag", rightX, { zigzagPhase: 1.0 }),
    big: true,
  });

  if (level >= 4) {
    addWarning({
      x: centerX,
      y: 58,
      delay: 0.68,
      enemyConfig: createEnemyConfig("tank", centerX, { dropPowerUp: false }),
      big: true,
    });
  } else {
    addWarning({
      x: centerX - 56,
      y: 74,
      delay: 0.62,
      enemyConfig: createEnemyConfig("scout", centerX - 56),
    });
    addWarning({
      x: centerX + 56,
      y: 74,
      delay: 0.68,
      enemyConfig: createEnemyConfig("scout", centerX + 56),
    });
  }
}

function updateExplosions(deltaSeconds) {
  for (const burst of game.explosions) {
    burst.life -= deltaSeconds;
    burst.radius += (130 + burst.size * 40) * deltaSeconds;
  }
  game.explosions = game.explosions.filter((burst) => burst.life > 0);
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
        enemy.hitFlash = 0.12;
        hit = true;
        addExplosion(bullet.x, bullet.y, bullet.color, 0.65);

        if (enemy.hp <= 0) {
          game.score += enemy.scoreValue;
          game.screenShake = Math.max(game.screenShake, enemy.type === "boss" ? 12 : enemy.type === "tank" ? 9 : 4);
          addExplosion(enemy.x, enemy.y, enemy.type === "boss" ? "#ffd166" : enemy.type === "tank" ? "#ffd166" : "#ff8c42", enemy.type === "boss" ? 2.2 : enemy.type === "tank" ? 1.7 : 1.05);
          if (enemy.type === 'boss') {
            spawnPowerUp(enemy.x - 28, enemy.y, 'spread');
            spawnPowerUp(enemy.x + 28, enemy.y + 12, 'rapid');
          } else if (enemy.dropPowerUp) {
            spawnPowerUp(enemy.x, enemy.y, Math.random() > 0.5 ? "spread" : "rapid");
          }
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

function handlePowerUpCollection() {
  const remaining = [];

  for (const powerUp of game.powerUps) {
    if (intersects(game.player, powerUp)) {
      applyPowerUp(powerUp.type);
      addExplosion(powerUp.x, powerUp.y, "#8ff8ff", 1.2);
      continue;
    }
    remaining.push(powerUp);
  }

  game.powerUps = remaining;
}

function applyPowerUp(type) {
  const powerUpDef = POWERUP_DEFS[type];
  if (!powerUpDef) {
    return;
  }

  game.player.weapon.mode = type;
  game.player.weapon.timer = Math.min(12, game.player.weapon.timer + powerUpDef.duration);
  game.screenFlash = Math.max(game.screenFlash, 0.16);
  game.screenShake = Math.max(game.screenShake, 4);
}

function handlePlayerCollisions() {
  const player = game.player;

  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    if (intersects(player, enemy)) {
      enemy.hp = 0;
      addExplosion(enemy.x, enemy.y, "#ff6b6b", 1.25);
      damagePlayer(1);
    }
  }
}

function handleEscapedEnemies() {
  for (const enemy of game.enemies) {
    if (enemy.hp > 0 && enemy.y - enemy.height / 2 > GAME_HEIGHT + 10) {
      enemy.hp = 0;
      damagePlayer(enemy.type === "tank" ? 2 : 1);
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
  player.hitFlash = 0.36;
  game.screenFlash = Math.max(game.screenFlash, 0.34);
  game.screenShake = Math.max(game.screenShake, 10);
  addExplosion(player.x, player.y, "#ff6b6b", 1.45);
}

function cleanupEntities() {
  game.bullets = game.bullets.filter((bullet) => {
    return bullet.y + bullet.height > -20 && bullet.x > -40 && bullet.x < GAME_WIDTH + 40;
  });
  game.enemies = game.enemies.filter((enemy) => enemy.hp > 0 && enemy.y - enemy.height < GAME_HEIGHT + 60);
  game.powerUps = game.powerUps.filter((powerUp) => powerUp.y - powerUp.height < GAME_HEIGHT + 30);
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

  let shakeX = 0;
  let shakeY = 0;
  if (game.screenShake > 0) {
    shakeX = (Math.random() - 0.5) * game.screenShake;
    shakeY = (Math.random() - 0.5) * game.screenShake;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawWarnings();
  drawDangerIndicators();
  drawPowerUps();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawExplosions();
  ctx.restore();
  drawDamageFlash();
  drawBossIntro();
  drawSurgeWarning();
  drawSurgeRails();
  drawSurgeBanner();
  drawPauseOverlay();
}

function drawBackground() {
  const usedArt = drawImageCover(spriteLibrary.enemyBoss, 0, 0, GAME_WIDTH, GAME_HEIGHT, 0.08);
  const usedBackdrop = drawImageCover(spriteLibrary.playerShieldHit, 0, 0, GAME_WIDTH, GAME_HEIGHT, 0.08);

  if (!usedArt && !usedBackdrop) {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#081425");
    gradient.addColorStop(1, "#133456");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  const overlay = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  overlay.addColorStop(0, 'rgba(8, 20, 37, 0.82)');
  overlay.addColorStop(1, 'rgba(19, 52, 86, 0.9)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.035)";
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

function drawWarnings() {
  for (const warning of game.warnings) {
    const pulse = 0.4 + Math.abs(Math.sin(warning.delay * 11)) * 0.55;
    const width = warning.big ? 56 : 34;
    const height = warning.big ? 16 : 12;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = warning.big ? "#ffd166" : "#68e0ff";
    ctx.fillRect(warning.x - width / 2, warning.y, width, height);
    ctx.fillRect(warning.x - 2, warning.y + height, 4, 22);
  }
  ctx.globalAlpha = 1;
}

function drawBossIntro() {
  const boss = game.enemies.find((enemy) => enemy.type === 'boss' && enemy.hp > 0);
  if (!boss) return;

  const pulse = 0.28 + Math.abs(Math.sin(game.elapsed * 7)) * 0.18;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = 'rgba(255, 90, 110, 0.22)';
  ctx.fillRect(0, 0, GAME_WIDTH, 64);
  ctx.fillRect(0, GAME_HEIGHT - 22, GAME_WIDTH, 22);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd7df';
  ctx.font = 'bold 26px Trebuchet MS, Segoe UI, sans-serif';
  ctx.fillText('BOSS INBOUND', GAME_WIDTH / 2, 42);
}

function drawDangerIndicators() {
  const imminentEnemies = game.enemies.filter((enemy) => enemy.y > GAME_HEIGHT * 0.58 && enemy.hp > 0);
  if (imminentEnemies.length === 0) {
    return;
  }

  const strongestThreat = imminentEnemies.reduce((max, enemy) => {
    const threat = enemy.type === "tank" ? 1 : 0.65;
    return Math.max(max, threat);
  }, 0);
  const pulse = 0.35 + Math.abs(Math.sin(game.elapsed * 8)) * 0.3;

  ctx.globalAlpha = pulse * strongestThreat;
  ctx.fillStyle = strongestThreat > 0.9 ? "#ff9f43" : "#ff6b6b";
  ctx.fillRect(0, GAME_HEIGHT - 16, GAME_WIDTH, 16);

  for (const enemy of imminentEnemies) {
    const arrowX = clamp(enemy.x, 18, GAME_WIDTH - 18);
    const arrowY = GAME_HEIGHT - 26;
    const size = enemy.type === "tank" ? 12 : 9;

    ctx.globalAlpha = pulse * (enemy.type === "tank" ? 1 : 0.85);
    ctx.fillStyle = enemy.type === "tank" ? "#ffd166" : "#ff6b6b";
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY + size);
    ctx.lineTo(arrowX - size, arrowY - size);
    ctx.lineTo(arrowX + size, arrowY - size);
    ctx.closePath();
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

  if (player.weapon.mode === "spread") {
    drawImageCover(spriteLibrary.weaponSpread, player.x - 34, player.y - 34, 68, 68, 0.2);
  }

  if (player.weapon.mode === "rapid") {
    drawImageCover(spriteLibrary.weaponRapid, player.x - 34, player.y - 24, 68, 48, 0.26);
  }

  if (player.invulnerableTimer > 0) {
    const shieldPulse = 0.28 + Math.abs(Math.sin(player.invulnerableTimer * 16)) * 0.35;
    drawImageCover(spriteLibrary.playerShieldHit, player.x - 34, player.y - 34, 68, 68, shieldPulse);
  }

  const playerImage = player.hitFlash > 0 ? spriteLibrary.playerHit : spriteLibrary.player;
  const drewPlayerArt = drawImageCover(playerImage, player.x - 28, player.y - 34, 56, 68, 1);

  if (!drewPlayerArt) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = player.hitFlash > 0 ? "#ffffff" : "#8af5ff";
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(player.width / 2, player.height / 2);
    ctx.lineTo(0, player.height / 4);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = player.hitFlash > 0 ? "#ffdede" : "#ffe066";
    ctx.fillRect(-5, -6, 10, 18);
    ctx.fillStyle = "#ff8c42";
    ctx.beginPath();
    ctx.moveTo(-8, player.height / 2 - 4);
    ctx.lineTo(0, player.height / 2 + 14);
    ctx.lineTo(8, player.height / 2 - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const hpBarWidth = 44;
  const hpBarY = player.y - player.height / 2 - 14;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(player.x - hpBarWidth / 2, hpBarY, hpBarWidth, 5);
  ctx.fillStyle = player.hp >= 3 ? "#68e0ff" : player.hp >= 2 ? "#ffd166" : "#ff6b6b";
  ctx.fillRect(player.x - hpBarWidth / 2, hpBarY, hpBarWidth * (player.hp / player.maxHp), 5);

  ctx.globalAlpha = 1;
}

function drawBullets() {
  for (const bullet of game.bullets) {
    const drewBullet = drawImageCover(spriteLibrary.playerBullet, bullet.x - bullet.width * 1.3, bullet.y - bullet.height * 1.4, bullet.width * 2.6, bullet.height * 2.8, 0.92);
    if (!drewBullet) {
      ctx.fillStyle = bullet.color;
      ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }
  }
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    const sprite = enemy.type === 'boss'
      ? spriteLibrary.enemyBoss
      : enemy.type === 'tank'
        ? spriteLibrary.enemyTank
        : enemy.type === 'zigzag'
          ? spriteLibrary.enemyElite
          : spriteLibrary.enemyScout;

    const drewEnemy = drawImageCover(sprite, enemy.x - enemy.width * 0.8, enemy.y - enemy.height * 0.9, enemy.width * 1.6, enemy.height * 1.8, enemy.hitFlash > 0 ? 0.74 : 1);

    if (!drewEnemy) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const isTank = enemy.type === "tank";
      const hullColor = enemy.hitFlash > 0
        ? "#ffffff"
        : isTank
          ? "#ffb347"
          : enemy.type === "zigzag"
            ? "#ff8f70"
            : "#ff6b6b";
      ctx.fillStyle = hullColor;
      ctx.beginPath();
      ctx.moveTo(0, enemy.height / 2);
      ctx.lineTo(enemy.width / 2, -enemy.height / 2);
      ctx.lineTo(0, -enemy.height / 4);
      ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isTank ? "#3b3752" : "#2d4059";
      ctx.fillRect(-9, -7, 18, 14);
      ctx.restore();
    }

    if (enemy.maxHp > 1) {
      const barWidth = enemy.width;
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.height / 2 - 10, barWidth, 4);
      ctx.fillStyle = enemy.type === 'boss' ? '#ffd166' : '#8ff8ff';
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.height / 2 - 10, barWidth * (enemy.hp / enemy.maxHp), 4);
    }
  }
}

function drawPowerUps() {
  for (const powerUp of game.powerUps) {
    const bobOffset = Math.sin(powerUp.bob) * 4;
    const sprite = powerUp.type === 'rapid' ? spriteLibrary.powerupRapid : spriteLibrary.powerupSpread;
    ctx.save();
    ctx.translate(powerUp.x, powerUp.y + bobOffset);
    ctx.rotate(powerUp.bob * 0.18);
    const drewPower = drawImageCover(sprite, -16, -16, 32, 32, 0.95);
    if (!drewPower) {
      ctx.fillStyle = powerUp.color;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = powerUp.accent;
      if (powerUp.type === "rapid") {
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.fillRect(-3, -11, 6, 22);
        ctx.fillRect(-11, -3, 22, 6);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
    }
    ctx.restore();
  }
}

function drawExplosions() {
  for (const burst of game.explosions) {
    const alpha = burst.life / burst.maxLife;
    const sprite = burst.size > 1.2 ? spriteLibrary.explosionMedium : spriteLibrary.explosionSmall;
    const drewExplosion = drawImageCover(sprite, burst.x - burst.radius, burst.y - burst.radius, burst.radius * 2, burst.radius * 2, alpha * 0.92);
    if (!drewExplosion) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = burst.color;
      ctx.lineWidth = 3 + burst.size;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = burst.color;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawDamageFlash() {
  if (game.screenFlash <= 0) {
    return;
  }

  ctx.globalAlpha = game.screenFlash * 0.45;
  ctx.fillStyle = "#ffb3b3";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.globalAlpha = 1;
}

function drawSurgeBanner() {
  if (game.surgeBannerTimer <= 0 || game.state !== "playing") {
    return;
  }

  const alpha = Math.min(1, game.surgeBannerTimer) * 0.95;
  const topY = 20;
  const bossActive = game.enemies.some((enemy) => enemy.type === 'boss' && enemy.hp > 0);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bossActive ? 'rgba(255, 84, 112, 0.24)' : "rgba(255, 159, 67, 0.2)";
  ctx.fillRect(42, topY, GAME_WIDTH - 84, 42);
  ctx.strokeStyle = bossActive ? '#ff8aa0' : "#ffd166";
  ctx.lineWidth = 2;
  ctx.strokeRect(42, topY, GAME_WIDTH - 84, 42);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff4cf";
  ctx.font = "bold 22px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(bossActive ? 'BOSS CONTACT' : `Threat Surge Lv ${game.lastThreatLevel}`, GAME_WIDTH / 2, topY + 28);
  ctx.globalAlpha = 1;
}

function drawSurgeWarning() {
  if (game.surgeWarningTimer <= 0 || game.state !== "playing") {
    return;
  }

  const progress = 1 - game.surgeWarningTimer / 1.15;
  const alpha = 0.18 + Math.abs(Math.sin(game.elapsed * 18)) * 0.2;
  const ringRadius = 54 + progress * 190;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(GAME_WIDTH / 2, GAME_HEIGHT / 2, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 107, 107, 0.14)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff4cf";
  ctx.font = "bold 30px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("SURGE INCOMING", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8);
  ctx.font = "18px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillStyle = "#ffd7a3";
  ctx.fillText(`Threat Level ${game.surgeWarningLevel}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 24);
  ctx.globalAlpha = 1;
}

function drawSurgeRails() {
  if (game.surgeTimer <= 0 || game.state !== "playing") {
    return;
  }

  const alpha = 0.15 + Math.abs(Math.sin(game.elapsed * 10)) * 0.18;
  const railHeight = GAME_HEIGHT - 110;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(0, 74, 12, railHeight);
  ctx.fillRect(GAME_WIDTH - 12, 74, 12, railHeight);

  ctx.fillStyle = "#ffd166";
  for (let y = 92; y < GAME_HEIGHT - 36; y += 56) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(36, y + 12);
    ctx.lineTo(18, y + 24);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH - 18, y);
    ctx.lineTo(GAME_WIDTH - 36, y + 12);
    ctx.lineTo(GAME_WIDTH - 18, y + 24);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawPauseOverlay() {
  if (game.state !== "paused") {
    return;
  }

  ctx.fillStyle = "rgba(3, 10, 20, 0.5)";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.textAlign = "center";
  ctx.fillStyle = "#eef6ff";
  ctx.font = "bold 42px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("Paused", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8);
  ctx.font = "20px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillStyle = "#b6c8dc";
  const pauseHint = game.pauseReason === "focus-loss"
    ? "Auto-paused after focus loss"
    : "Press P / Esc to resume · R to restart";
  ctx.fillText(pauseHint, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 28);
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

  if (key === "p" || key === "escape") {
    event.preventDefault();
    if (game.state === "playing" || game.state === "paused") {
      togglePause();
    }
    return;
  }

  if (key === "r") {
    event.preventDefault();
    if (game.state === "playing" || game.state === "paused" || game.state === "gameover") {
      startGame();
    }
    return;
  }

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

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === "playing") {
    togglePause("focus-loss");
  }
});

window.addEventListener("blur", () => {
  if (game.state === "playing") {
    togglePause("focus-loss");
  }
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
