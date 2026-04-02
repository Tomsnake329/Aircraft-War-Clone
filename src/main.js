const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreHud = document.getElementById('scoreHud');
const menuOverlay = document.getElementById('menuOverlay');
const shopOverlay = document.getElementById('shopOverlay');
const rankingOverlay = document.getElementById('rankingOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const gameOverSummary = document.getElementById('gameOverSummary');
const rankingList = document.getElementById('rankingList');
const shopList = document.getElementById('shopList');
const coinValue = document.getElementById('coinValue');
const playerNameInput = document.getElementById('playerNameInput');

const startButton = document.getElementById('startButton');
const shopButton = document.getElementById('shopButton');
const rankingButton = document.getElementById('rankingButton');
const closeShopButton = document.getElementById('closeShopButton');
const closeRankingButton = document.getElementById('closeRankingButton');
const rechargeButton = document.getElementById('rechargeButton');
const saveScoreButton = document.getElementById('saveScoreButton');
const restartButton = document.getElementById('restartButton');

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const STORAGE_RANKING_KEY = 'aircraft-war-clone-ranking';
const STORAGE_COIN_KEY = 'aircraft-war-clone-coins';
const STORAGE_UPGRADE_KEY = 'aircraft-war-clone-upgrades';

const spriteLibrary = createSpriteLibrary();
const STAGE_CONFIG = [
  { stage: 1, targetKills: 12, spawnInterval: 1.2, bossHp: 22, bossSpeed: 46, enemySpeed: 96 },
  { stage: 2, targetKills: 18, spawnInterval: 1.0, bossHp: 34, bossSpeed: 56, enemySpeed: 118 },
];
const SHOP_ITEMS = [
  { key: 'spread', label: '散射升級', desc: '增加同時發射的子彈數量', cost: 120 },
  { key: 'laser', label: '光炮模組', desc: '切換成穿透型光炮射擊', cost: 240 },
  { key: 'hp', label: '耐久強化', desc: '增加初始血量', cost: 180 },
  { key: 'shield', label: '護盾模組', desc: '提高受擊後無敵時間', cost: 220 },
];
const POWERUP_TYPES = {
  spread: { label: '散射模組', color: '#ffd166' },
  laser: { label: '光炮晶片', color: '#ff7a7a' },
};

const game = {
  state: 'menu',
  lastTime: 0,
  elapsed: 0,
  spawnTimer: 0,
  fireTimer: 0,
  phaseBannerTimer: 0,
  phaseBannerText: '',
  score: 0,
  coins: Number(localStorage.getItem(STORAGE_COIN_KEY) || 0),
  upgrades: JSON.parse(localStorage.getItem(STORAGE_UPGRADE_KEY) || '{}'),
  ranking: JSON.parse(localStorage.getItem(STORAGE_RANKING_KEY) || '[]'),
  stageIndex: 0,
  stageKills: 0,
  bossSpawned: false,
  stageClearTimer: 0,
  input: { up: false, down: false, left: false, right: false },
  pointerActive: false,
  player: null,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  explosions: [],
  powerUps: [],
  stars: createStars(44),
};

function createSpriteLibrary() {
  const assets = {
    player: './assets/images/processed/player.png',
    playerBullet: './assets/images/processed/player_bullet.png',
    enemyScout: './assets/images/processed/enemy_scout.png',
    enemyTank: './assets/images/processed/enemy_tank.png',
    enemyBoss: './assets/images/processed/enemy_boss.png',
    enemyBullet: './assets/images/processed/enemy_bullet.png',
    explosionSmall: './assets/images/processed/explosion_small.png',
    explosionMedium: './assets/images/processed/explosion_medium.png',
    powerupRapid: './assets/images/processed/powerup_rapid.png',
    powerupSpread: './assets/images/processed/powerup_spread.png',
  };
  const images = {};
  for (const [key, src] of Object.entries(assets)) {
    const image = new Image();
    image.src = src;
    images[key] = image;
  }
  return images;
}

function drawImageCover(image, x, y, width, height, alpha = 1) {
  if (!image || !image.complete || !image.naturalWidth) return false;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
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

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    radius: Math.random() * 2 + 1,
    speed: Math.random() * 50 + 25,
    alpha: Math.random() * 0.45 + 0.28,
  }));
}

function currentStage() {
  return STAGE_CONFIG[Math.min(game.stageIndex, STAGE_CONFIG.length - 1)];
}

function createPlayer() {
  const hpBoost = game.upgrades.hp || 0;
  return {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 110,
    width: 52,
    height: 68,
    speed: 300,
    hp: 5 + hpBoost,
    maxHp: 5 + hpBoost,
    invulnerable: 0,
    fireInterval: 0.24,
    spreadLevel: game.upgrades.spread || 0,
    laserLevel: game.upgrades.laser || 0,
    weaponMode: game.upgrades.laser > 0 ? 'laser' : 'spread',
  };
}

function spreadCount(level) {
  return Math.min(7, 1 + level * 2);
}

function updateScoreHud() {
  const player = game.player;
  const hearts = player ? ` <span class="hud-hearts">${'♥'.repeat(player.hp)}</span>` : '';
  scoreHud.innerHTML = `第 ${currentStage().stage} 關 · 分數 ${game.score}${hearts}`;
}

function showOverlay(target) {
  [menuOverlay, shopOverlay, rankingOverlay, gameOverOverlay].forEach((item) => item.classList.remove('visible'));
  if (target) target.classList.add('visible');
}

function openMenu() {
  game.state = 'menu';
  renderShop();
  renderRanking();
  updateScoreHud();
  showOverlay(menuOverlay);
}

function openShop() {
  game.state = 'shop';
  renderShop();
  showOverlay(shopOverlay);
}

function openRanking() {
  game.state = 'ranking';
  renderRanking();
  showOverlay(rankingOverlay);
}

function getShopCost(item) {
  const level = game.upgrades[item.key] || 0;
  return item.cost + level * 60;
}

function upgradeItem(key) {
  const item = SHOP_ITEMS.find((entry) => entry.key === key);
  if (!item) return;
  const cost = getShopCost(item);
  if (game.coins < cost) return;
  game.coins -= cost;
  game.upgrades[key] = (game.upgrades[key] || 0) + 1;
  localStorage.setItem(STORAGE_COIN_KEY, String(game.coins));
  localStorage.setItem(STORAGE_UPGRADE_KEY, JSON.stringify(game.upgrades));
  renderShop();
}

function renderShop() {
  coinValue.textContent = `金幣：${game.coins}`;
  shopList.innerHTML = SHOP_ITEMS.map((item) => {
    const level = game.upgrades[item.key] || 0;
    const cost = getShopCost(item);
    return `
      <div class="shop-item">
        <strong>${item.label} Lv.${level}</strong>
        <div>${item.desc}</div>
        <div>費用：${cost} 金幣</div>
        <button class="action-button shop-buy-button" data-upgrade="${item.key}">升級</button>
      </div>`;
  }).join('');
  shopList.querySelectorAll('.shop-buy-button').forEach((button) => {
    button.addEventListener('click', () => upgradeItem(button.dataset.upgrade));
  });
}

function renderRanking() {
  const top10 = [...game.ranking].sort((a, b) => b.score - a.score).slice(0, 10);
  rankingList.innerHTML = top10.length
    ? top10.map((entry) => `<li>${entry.name} — ${entry.score} 分</li>`).join('')
    : '<li>目前尚無紀錄</li>';
}

function resetRun() {
  game.player = createPlayer();
  game.bullets = [];
  game.enemyBullets = [];
  game.enemies = [];
  game.explosions = [];
  game.powerUps = [];
  game.elapsed = 0;
  game.spawnTimer = 0.8;
  game.fireTimer = 0;
  game.score = 0;
  game.stageIndex = 0;
  game.stageKills = 0;
  game.bossSpawned = false;
  game.stageClearTimer = 0;
  game.state = 'playing';
  updateScoreHud();
}

function spawnEnemy(type = 'scout') {
  const stage = currentStage();
  game.enemies.push({
    type,
    x: 72 + Math.random() * (GAME_WIDTH - 144),
    y: -50,
    width: type === 'tank' ? 70 : 56,
    height: type === 'tank' ? 72 : 58,
    hp: type === 'tank' ? 4 : 2,
    maxHp: type === 'tank' ? 4 : 2,
    speed: stage.enemySpeed + (type === 'tank' ? -18 : 0),
    hitFlash: 0,
    scoreValue: type === 'tank' ? 18 : 10,
    fireCooldown: 1.2 + Math.random() * 0.8,
  });
}

function spawnBoss() {
  const stage = currentStage();
  game.bossSpawned = true;
  game.enemies.push({
    type: 'boss',
    x: GAME_WIDTH / 2,
    y: -110,
    width: 150,
    height: 142,
    hp: stage.bossHp + 38,
    maxHp: stage.bossHp + 38,
    speed: stage.bossSpeed,
    hitFlash: 0,
    scoreValue: 200,
    bossAnchorY: 130,
    fireCooldown: 1.1,
    patternTimer: 0,
    phase: 1,
    invulnerable: 0,
    phaseTransitionTimer: 0,
    bulletColor: '#ff7d96',
  });
}

function firePlayerBullet() {
  const player = game.player;
  if (!player) return;
  if (player.weaponMode === 'laser') {
    game.bullets.push({ x: player.x, y: player.y - 220, width: 22 + player.laserLevel * 8, height: 420, speed: 0, damage: 0.34 + player.laserLevel * 0.08, kind: 'laser' });
    return;
  }
  const count = spreadCount(player.spreadLevel);
  const spreadOffsets = { 1: [0], 3: [-0.22, 0, 0.22], 5: [-0.36, -0.18, 0, 0.18, 0.36], 7: [-0.48, -0.3, -0.15, 0, 0.15, 0.3, 0.48] };
  const velocities = spreadOffsets[count] || [0];
  velocities.forEach((vx) => {
    game.bullets.push({ x: player.x, y: player.y - 30, width: 20, height: 36, speed: 450, damage: 1.1, vx, kind: 'normal' });
  });
}

function fireEnemyBullet(enemy, pattern = 'single') {
  const base = { x: enemy.x, y: enemy.y + enemy.height * 0.45, width: enemy.type === 'boss' ? 18 : 14, height: enemy.type === 'boss' ? 28 : 24, speed: enemy.type === 'boss' ? 220 : 180, damage: enemy.type === 'boss' ? 2 : 1, color: enemy.bulletColor || '#ff708d' };
  if (pattern === 'spread') {
    [-0.45, 0, 0.45].forEach((vx) => game.enemyBullets.push({ ...base, vx }));
    return;
  }
  if (pattern === 'ring') {
    [-0.7, -0.35, 0, 0.35, 0.7].forEach((vx) => game.enemyBullets.push({ ...base, vx }));
    return;
  }
  game.enemyBullets.push({ ...base, vx: 0 });
}

function spawnPowerUp(x, y, type) {
  game.powerUps.push({ x, y, type, bob: 0, radius: 18 });
}

function addExplosion(x, y, size = 1, color = null) {
  game.explosions.push({ x, y, radius: 22 * size, life: 0.35, maxLife: 0.35, size, color });
}

function maybeAdvanceStage(delta) {
  if (game.stageClearTimer <= 0) return;
  game.stageClearTimer -= delta;
  if (game.stageClearTimer > 0) return;
  if (game.stageIndex < STAGE_CONFIG.length - 1) {
    game.stageIndex += 1;
    game.stageKills = 0;
    game.bossSpawned = false;
    game.enemies = [];
    game.bullets = [];
    game.enemyBullets = [];
    game.powerUps = [];
    game.spawnTimer = 1;
  } else {
    endGame(true);
  }
  updateScoreHud();
}

function endGame(cleared = false) {
  game.state = 'gameover';
  gameOverSummary.textContent = cleared
    ? `通關完成！最終分數：${game.score}`
    : `本次分數：${game.score}｜已到第 ${currentStage().stage} 關`;
  playerNameInput.value = '';
  showOverlay(gameOverOverlay);
}

function saveRanking() {
  const name = (playerNameInput.value || '玩家').trim() || '玩家';
  game.ranking.push({ name, score: game.score });
  game.ranking = game.ranking.sort((a, b) => b.score - a.score).slice(0, 10);
  localStorage.setItem(STORAGE_RANKING_KEY, JSON.stringify(game.ranking));
  renderRanking();
  openRanking();
}

function hitPlayer(damage) {
  const player = game.player;
  if (!player || player.invulnerable > 0) return;
  player.hp -= damage;
  player.invulnerable = 1 + (game.upgrades.shield || 0) * 0.2;
  addExplosion(player.x, player.y, 1.05);
  if (player.hp <= 0) endGame(false);
  updateScoreHud();
}

function update(delta) {
  for (const star of game.stars) {
    star.y += star.speed * delta;
    if (star.y > GAME_HEIGHT) star.y = -10;
  }

  if (game.state !== 'playing') return;
  const player = game.player;
  const stage = currentStage();
  game.elapsed += delta;
  game.phaseBannerTimer = Math.max(0, game.phaseBannerTimer - delta);
  player.invulnerable = Math.max(0, player.invulnerable - delta);

  let dx = 0; let dy = 0;
  if (game.input.left) dx -= 1;
  if (game.input.right) dx += 1;
  if (game.input.up) dy -= 1;
  if (game.input.down) dy += 1;
  player.x = Math.max(34, Math.min(GAME_WIDTH - 34, player.x + dx * player.speed * delta));
  player.y = Math.max(82, Math.min(GAME_HEIGHT - 40, player.y + dy * player.speed * delta));

  if (!game.bossSpawned) {
    game.spawnTimer -= delta;
    if (game.spawnTimer <= 0) {
      spawnEnemy(Math.random() > 0.72 ? 'tank' : 'scout');
      game.spawnTimer = stage.spawnInterval;
    }
    if (game.stageKills >= stage.targetKills) spawnBoss();
  }

  game.fireTimer -= delta;
  if (game.fireTimer <= 0) {
    firePlayerBullet();
    game.fireTimer = player.fireInterval;
  }

  for (const bullet of game.bullets) {
    if (bullet.kind === 'laser') {
      bullet.x = player.x;
      bullet.y = player.y - 220;
    } else {
      bullet.y -= bullet.speed * delta;
      bullet.x += (bullet.vx || 0) * 160 * delta;
    }
  }
  game.bullets = game.bullets.filter((bullet) => bullet.kind === 'laser' || (bullet.y > -80 && bullet.x > -60 && bullet.x < GAME_WIDTH + 60));

  for (const bullet of game.enemyBullets) {
    bullet.y += bullet.speed * delta;
    bullet.x += (bullet.vx || 0) * 140 * delta;
  }
  game.enemyBullets = game.enemyBullets.filter((bullet) => bullet.y < GAME_HEIGHT + 40 && bullet.x > -40 && bullet.x < GAME_WIDTH + 40);

  for (const enemy of game.enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta * 4);
    enemy.fireCooldown -= delta;
    enemy.invulnerable = Math.max(0, (enemy.invulnerable || 0) - delta);
    enemy.phaseTransitionTimer = Math.max(0, (enemy.phaseTransitionTimer || 0) - delta);
    if (enemy.type === 'boss') {
      enemy.y += (enemy.y < enemy.bossAnchorY ? 1 : 0.18) * enemy.speed * delta;
      enemy.x += Math.sin(game.elapsed * 1.8) * 22 * delta;
      enemy.patternTimer += delta;
      const hpRatio = enemy.hp / enemy.maxHp;
      const nextPhase = hpRatio < 0.34 ? 3 : hpRatio < 0.67 ? 2 : 1;
      if (enemy.phase === 1 && enemy.hp <= enemy.maxHp * 0.67) {
        enemy.hp = enemy.maxHp * 0.67;
        if (nextPhase !== enemy.phase) {
          enemy.phase = 2;
          enemy.fireCooldown = 1.2;
          enemy.invulnerable = 1.05;
          enemy.phaseTransitionTimer = 1.2;
          game.phaseBannerTimer = 1.25;
          game.phaseBannerText = 'BOSS 第二階段';
          addExplosion(enemy.x, enemy.y, 1.2, '#ffd166');
        }
      } else if (enemy.phase === 2 && enemy.hp <= enemy.maxHp * 0.34) {
        enemy.hp = enemy.maxHp * 0.34;
        if (nextPhase !== enemy.phase) {
          enemy.phase = 3;
          enemy.fireCooldown = 1.2;
          enemy.invulnerable = 1.45;
          enemy.phaseTransitionTimer = 1.5;
          game.phaseBannerTimer = 1.35;
          game.phaseBannerText = 'BOSS 最終階段';
          addExplosion(enemy.x, enemy.y, 1.2, '#8ff8ff');
        }
      }
      if (enemy.phase === 1) {
        enemy.bulletColor = '#ff7d96';
      } else if (enemy.phase === 2) {
        enemy.bulletColor = '#ffd166';
      } else {
        enemy.bulletColor = '#8ff8ff';
      }
      if (enemy.phaseTransitionTimer > 0) {
        continue;
      }
      if (enemy.fireCooldown <= 0) {
        const pattern = enemy.phase === 1 ? 'single' : enemy.phase === 2 ? 'spread' : 'ring';
        fireEnemyBullet(enemy, pattern);
        enemy.fireCooldown = enemy.phase === 1 ? 1.05 : enemy.phase === 2 ? 0.8 : 0.58;
        if (enemy.patternTimer > 9) enemy.patternTimer = 0;
      }
    } else {
      enemy.y += enemy.speed * delta;
      if (enemy.fireCooldown <= 0 && enemy.y > 80) {
        fireEnemyBullet(enemy, enemy.type === 'tank' ? 'spread' : 'single');
        enemy.fireCooldown = enemy.type === 'tank' ? 1.8 : 2.4;
      }
    }
  }
  game.enemies = game.enemies.filter((enemy) => enemy.y < GAME_HEIGHT + 120);

  for (const bullet of game.bullets) {
    for (const enemy of game.enemies) {
      const hitX = enemy.type === 'boss' ? enemy.width * 0.7 : enemy.type === 'tank' ? enemy.width * 0.64 : enemy.width * 0.42;
      const hitY = enemy.type === 'boss' ? enemy.height * 0.42 : enemy.type === 'tank' ? enemy.height * 0.38 : enemy.height * 0.4;
      if (Math.abs(bullet.x - enemy.x) < hitX + bullet.width * 0.35 && Math.abs(bullet.y - enemy.y) < hitY) {
        if (bullet.kind !== 'laser') {
          bullet.y = -999;
        } else {
          bullet.width = Math.max(10, bullet.width - 3);
          if (bullet.width <= 10) bullet.y = -999;
          addExplosion(enemy.x, enemy.y + hitY * 0.1, 0.8, '#8ff8ff');
          addExplosion(enemy.x + (Math.random() * 18 - 9), enemy.y - 8, 0.45, '#b7f7ff');
        }
        if ((enemy.invulnerable || 0) > 0) {
          continue;
        }
        enemy.hp -= bullet.damage;
        enemy.hitFlash = bullet.kind === 'laser' ? 1.6 : 1;
        if (bullet.kind !== 'laser') addExplosion(bullet.x, enemy.y, 0.45, '#ffdca8');
        if (enemy.hp <= 0) {
          addExplosion(enemy.x, enemy.y, enemy.type === 'boss' ? 2.8 : enemy.type === 'tank' ? 1.9 : 1.5);
          game.score += enemy.scoreValue;
          game.coins += enemy.type === 'boss' ? 40 : enemy.type === 'tank' ? 8 : 4;
          localStorage.setItem(STORAGE_COIN_KEY, String(game.coins));
          if (Math.random() > 0.65 && enemy.type !== 'boss') spawnPowerUp(enemy.x, enemy.y, Math.random() > 0.5 ? 'spread' : 'laser');
          if (enemy.type === 'boss') {
            spawnPowerUp(enemy.x - 24, enemy.y, 'spread');
            spawnPowerUp(enemy.x + 24, enemy.y, 'laser');
            game.stageClearTimer = 1.5;
          } else {
            game.stageKills += 1;
          }
          enemy.y = GAME_HEIGHT + 200;
          updateScoreHud();
        }
      }
    }
  }

  for (const bullet of game.enemyBullets) {
    if (Math.abs(player.x - bullet.x) < 28 && Math.abs(player.y - bullet.y) < 30) {
      bullet.y = GAME_HEIGHT + 100;
      hitPlayer(bullet.damage);
    }
  }

  if (player.invulnerable <= 0) {
    for (const enemy of game.enemies) {
      const collideX = enemy.type === 'boss' ? enemy.width * 0.34 : enemy.type === 'tank' ? enemy.width * 0.3 : enemy.width * 0.34;
      const collideY = enemy.type === 'boss' ? enemy.height * 0.32 : enemy.type === 'tank' ? enemy.height * 0.28 : enemy.height * 0.32;
      if (Math.abs(player.x - enemy.x) < collideX && Math.abs(player.y - enemy.y) < collideY) {
        hitPlayer(enemy.type === 'boss' ? 2 : 1);
        enemy.y = GAME_HEIGHT + 200;
        break;
      }
    }
  }

  for (const powerUp of game.powerUps) {
    powerUp.y += 90 * delta;
    powerUp.bob += delta * 5;
    if (Math.abs(player.x - powerUp.x) < 30 && Math.abs(player.y - powerUp.y) < 30) {
      if (powerUp.type === 'spread') {
        player.weaponMode = 'spread';
        player.spreadLevel = Math.min(3, player.spreadLevel + 1);
      } else {
        player.weaponMode = 'laser';
        player.laserLevel = Math.min(4, player.laserLevel + 1);
      }
      powerUp.y = GAME_HEIGHT + 100;
      updateScoreHud();
    }
  }
  game.powerUps = game.powerUps.filter((item) => item.y < GAME_HEIGHT + 40);

  for (const burst of game.explosions) burst.life -= delta;
  game.explosions = game.explosions.filter((burst) => burst.life > 0);
  maybeAdvanceStage(delta);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, '#091423');
  gradient.addColorStop(1, '#17395e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  for (const star of game.stars) {
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const player = game.player;
  if (!player) return;
  const alpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0 ? 0.45 : 1;
  if (!drawImageCover(spriteLibrary.player, player.x - 36, player.y - 42, 72, 86, alpha)) {
    ctx.fillStyle = '#8af5ff';
    ctx.fillRect(player.x - 22, player.y - 28, 44, 56);
  }
}

function drawBullets() {
  for (const bullet of game.bullets) {
    if (bullet.kind === 'laser') {
      let contactY = 0;
      for (const enemy of game.enemies) {
        const hitX = enemy.type === 'boss' ? enemy.width * 0.55 : enemy.type === 'tank' ? enemy.width * 0.52 : enemy.width * 0.5;
        const hitY = enemy.type === 'boss' ? enemy.height * 0.52 : enemy.type === 'tank' ? enemy.height * 0.5 : enemy.height * 0.48;
        const enemyTop = enemy.y - hitY;
        const enemyBottom = enemy.y + hitY;
        if (Math.abs(bullet.x - enemy.x) < hitX && enemyBottom < game.player.y && enemyBottom > contactY) {
          contactY = enemyBottom;
        }
      }
      const beamTop = contactY > 0 ? contactY : 0;
      const beamBottom = game.player.y - 18;
      const beamHeight = Math.max(0, beamBottom - beamTop);
      ctx.fillStyle = 'rgba(82, 225, 255, 0.16)';
      ctx.fillRect(bullet.x - bullet.width / 2 - 10, beamTop, bullet.width + 20, beamHeight);
      ctx.fillStyle = 'rgba(111, 241, 255, 0.36)';
      ctx.fillRect(bullet.x - bullet.width / 2, beamTop, bullet.width, beamHeight);
      ctx.fillStyle = 'rgba(235, 255, 255, 0.94)';
      ctx.fillRect(bullet.x - Math.max(5, bullet.width * 0.2), beamTop, Math.max(10, bullet.width * 0.4), beamHeight);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 2;
      ctx.moveTo(bullet.x, beamTop);
      ctx.lineTo(bullet.x, beamBottom);
      ctx.stroke();
      if (contactY > 0) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(173,255,255,0.75)';
        ctx.arc(bullet.x, beamTop, Math.max(8, bullet.width * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    if (!drawImageCover(spriteLibrary.playerBullet, bullet.x - 20, bullet.y - 28, 40, 56, 1)) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(bullet.x - 8, bullet.y - 14, 16, 28);
    }
  }
}

function drawEnemyBullets() {
  for (const bullet of game.enemyBullets) {
    if (!drawImageCover(spriteLibrary.enemyBullet, bullet.x - 14, bullet.y - 18, 28, 36, 0.95)) {
      ctx.fillStyle = bullet.color || '#ff708d';
      ctx.fillRect(bullet.x - 6, bullet.y - 10, 12, 20);
    }
    ctx.fillStyle = bullet.color || '#ff708d';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    const sprite = enemy.type === 'boss' ? spriteLibrary.enemyBoss : enemy.type === 'tank' ? spriteLibrary.enemyTank : spriteLibrary.enemyScout;
    const alpha = enemy.hitFlash > 0 ? 0.58 : 1;
    drawImageCover(sprite, enemy.x - enemy.width * 0.85, enemy.y - enemy.height * 0.95, enemy.width * 1.7, enemy.height * 1.9, alpha);
    if (enemy.hitFlash > 0) {
      ctx.strokeStyle = `rgba(120, 247, 255, ${0.32 + enemy.hitFlash * 0.24})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(enemy.x - enemy.width * 0.28, enemy.y - enemy.height * 0.2);
      ctx.lineTo(enemy.x + enemy.width * 0.22, enemy.y + enemy.height * 0.18);
      ctx.moveTo(enemy.x - enemy.width * 0.12, enemy.y - enemy.height * 0.3);
      ctx.lineTo(enemy.x + enemy.width * 0.3, enemy.y - enemy.height * 0.04);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.16 + enemy.hitFlash * 0.14})`;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.width * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPowerUps() {
  for (const item of game.powerUps) {
    const sprite = item.type === 'laser' ? spriteLibrary.powerupRapid : spriteLibrary.powerupSpread;
    if (!drawImageCover(sprite, item.x - 30, item.y - 30, 60, 60, 0.98)) {
      ctx.fillStyle = POWERUP_TYPES[item.type].color;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    if (item.type === 'laser') {
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 12);
      ctx.lineTo(item.x, item.y + 12);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(item.x - 8, item.y - 10);
      ctx.lineTo(item.x + 8, item.y - 10);
      ctx.moveTo(item.x - 8, item.y + 10);
      ctx.lineTo(item.x + 8, item.y + 10);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - 12);
      ctx.lineTo(item.x, item.y + 12);
      ctx.moveTo(item.x - 12, item.y);
      ctx.lineTo(item.x + 12, item.y);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(item.x - 10, item.y - 10);
      ctx.lineTo(item.x + 10, item.y + 10);
      ctx.moveTo(item.x + 10, item.y - 10);
      ctx.lineTo(item.x - 10, item.y + 10);
      ctx.stroke();
    }
  }
}

function drawExplosions() {
  for (const burst of game.explosions) {
    const alpha = burst.life / burst.maxLife;
    if (burst.color) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = burst.color;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = burst.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    const sprite = burst.size > 1.4 ? spriteLibrary.explosionMedium : spriteLibrary.explosionSmall;
    drawImageCover(sprite, burst.x - burst.radius, burst.y - burst.radius, burst.radius * 2, burst.radius * 2, alpha);
  }
}

function drawBossBar() {
  const boss = game.enemies.find((enemy) => enemy.type === 'boss');
  if (!boss || game.state !== 'playing') return;
  const barColor = boss.phase === 1 ? '#ff5978' : boss.phase === 2 ? '#ffd166' : '#8ff8ff';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(54, 56, GAME_WIDTH - 108, 18);
  ctx.fillStyle = barColor;
  ctx.fillRect(54, 56, (GAME_WIDTH - 108) * (boss.hp / boss.maxHp), 18);
  ctx.strokeStyle = '#ffd8df';
  ctx.strokeRect(54, 56, GAME_WIDTH - 108, 18);
  ctx.fillStyle = '#fff4f7';
  ctx.font = 'bold 16px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`第 ${currentStage().stage} 關 BOSS`, GAME_WIDTH / 2, 50);
}

function drawStageBanner() {
  if (game.state !== 'playing') return;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = 'bold 18px Trebuchet MS, sans-serif';
  ctx.fillText(`第 ${currentStage().stage} 關`, 20, 42);
  if (game.phaseBannerTimer > 0) {
    ctx.fillStyle = `rgba(255, 243, 199, ${0.35 + game.phaseBannerTimer * 0.35})`;
    ctx.fillRect(36, GAME_HEIGHT / 2 - 40, GAME_WIDTH - 72, 56);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, GAME_HEIGHT / 2 - 40, GAME_WIDTH - 72, 56);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fffaf0';
    ctx.font = 'bold 24px Trebuchet MS, sans-serif';
    ctx.fillText(game.phaseBannerText, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 4);
  }
}

function draw() {
  drawBackground();
  if (game.player) drawPlayer();
  drawBullets();
  drawEnemyBullets();
  drawEnemies();
  drawPowerUps();
  drawExplosions();
  drawStageBanner();
  drawBossBar();
}

function gameLoop(timestamp) {
  const delta = Math.min(0.033, (timestamp - game.lastTime) / 1000 || 0);
  game.lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(gameLoop);
}

function setInputDirection(key, pressed) {
  if (key === 'arrowup' || key === 'w') game.input.up = pressed;
  if (key === 'arrowdown' || key === 's') game.input.down = pressed;
  if (key === 'arrowleft' || key === 'a') game.input.left = pressed;
  if (key === 'arrowright' || key === 'd') game.input.right = pressed;
}

function setPointerTarget(event) {
  if (!game.player) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = GAME_WIDTH / rect.width;
  const scaleY = GAME_HEIGHT / rect.height;
  game.player.x = Math.max(34, Math.min(GAME_WIDTH - 34, (event.clientX - rect.left) * scaleX));
  game.player.y = Math.max(82, Math.min(GAME_HEIGHT - 40, (event.clientY - rect.top) * scaleY));
}

window.addEventListener('keydown', (event) => {
  const targetTag = event.target?.tagName;
  if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
    event.preventDefault();
    setInputDirection(key, true);
  }
  if ((key === 'enter' || key === ' ') && game.state === 'menu') {
    event.preventDefault();
    resetRun();
    showOverlay(null);
  }
});
window.addEventListener('keyup', (event) => setInputDirection(event.key.toLowerCase(), false));
canvas.addEventListener('pointerdown', (event) => {
  game.pointerActive = true;
  setPointerTarget(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (game.pointerActive && game.state === 'playing') setPointerTarget(event);
});
canvas.addEventListener('pointerup', () => { game.pointerActive = false; });
canvas.addEventListener('pointercancel', () => { game.pointerActive = false; });

startButton.addEventListener('click', () => { resetRun(); showOverlay(null); });
shopButton.addEventListener('click', openShop);
rankingButton.addEventListener('click', openRanking);
closeShopButton.addEventListener('click', openMenu);
closeRankingButton.addEventListener('click', openMenu);
restartButton.addEventListener('click', openMenu);
saveScoreButton.addEventListener('click', saveRanking);
rechargeButton.addEventListener('click', () => {
  game.coins += 300;
  localStorage.setItem(STORAGE_COIN_KEY, String(game.coins));
  renderShop();
});

renderShop();
renderRanking();
openMenu();
draw();
requestAnimationFrame((timestamp) => {
  game.lastTime = timestamp;
  requestAnimationFrame(gameLoop);
});
