const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const restartBtn = document.getElementById('restartBtn');
const difficultySelect = document.getElementById('difficultySelect');

const difficultySettings = {
  low: { label: 'נמוכה', spawnInterval: 1150, fruitSpeed: 1.8, bombSpeed: 1.5 },
  medium: { label: 'בינונית', spawnInterval: 800, fruitSpeed: 2.4, bombSpeed: 1.9 },
  high: { label: 'גבוהה', spawnInterval: 550, fruitSpeed: 3.3, bombSpeed: 2.4 }
};

const state = {
  score: 0,
  lives: 3,
  difficulty: 'medium',
  fruits: [],
  swipes: [],
  isPlaying: true,
  lastSpawn: 0,
  lastTime: 0,
  pointerActive: false,
  pointerPos: null,
  currentSwipe: []
};

const colors = ['#f43f5e', '#f59e0b', '#22c55e', '#38bdf8', '#a78bfa', '#f472b6'];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getDifficultyConfig() {
  return difficultySettings[state.difficulty];
}

function setDifficulty(value) {
  if (!difficultySettings[value]) {
    return;
  }

  state.difficulty = value;
  difficultySelect.value = value;
  levelEl.textContent = getDifficultyConfig().label;
}

function getCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  return rect;
}

function resizeCanvas() {
  const rect = getCanvasSize();
  if (state.canvasRect && state.canvasRect.width === rect.width && state.canvasRect.height === rect.height) {
    return;
  }
  state.canvasRect = rect;
}

function spawnFruit(now) {
  const rect = canvas.getBoundingClientRect();
  const config = getDifficultyConfig();

  if (now - state.lastSpawn < config.spawnInterval) {
    return;
  }

  const type = Math.random() > 0.25 ? 'fruit' : 'bomb';
  const radius = type === 'bomb' ? 28 : rand(28, 42);
  const x = rand(radius, rect.width - radius);
  const y = rect.height + radius;
  const speed = type === 'bomb' ? config.bombSpeed : config.fruitSpeed;
  const color = type === 'bomb' ? '#111827' : colors[Math.floor(Math.random() * colors.length)];

  state.fruits.push({
    x,
    y,
    vx: rand(-0.8, 0.8),
    vy: -speed,
    radius,
    color,
    type,
    rotation: rand(0, Math.PI * 2),
    spin: rand(-0.08, 0.08),
    sliced: false
  });

  state.lastSpawn = now;
}

function updateLevel() {
  levelEl.textContent = getDifficultyConfig().label;
}

function updateHud() {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
}

function lineDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegmentDistance(point, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: point.x - a.x, y: point.y - a.y };
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  let t = 0;

  if (ab2 > 0) {
    t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / ab2));
  }

  const projection = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function sliceFruits() {
  if (state.currentSwipe.length < 2) {
    return;
  }

  const swipe = state.currentSwipe;
  const active = state.fruits.filter((fruit) => !fruit.sliced);
  let slicedAny = false;

  for (const fruit of active) {
    let hit = false;

    for (let i = 1; i < swipe.length; i++) {
      const a = swipe[i - 1];
      const b = swipe[i];
      if (pointToSegmentDistance({ x: fruit.x, y: fruit.y }, a, b) < fruit.radius + 8) {
        hit = true;
        break;
      }
    }

    if (!hit) {
      continue;
    }

    fruit.sliced = true;
    slicedAny = true;

    if (fruit.type === 'bomb') {
      state.lives = Math.max(0, state.lives - 1);
      if (state.lives === 0) {
        state.isPlaying = false;
      }
    } else {
      state.score += 1;
    }
  }

  if (slicedAny) {
    updateHud();
  }
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.rotate(fruit.rotation);

  if (fruit.type === 'bomb') {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    ctx.font = '700 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 6);
  } else {
    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.ellipse(0, -fruit.radius * 0.5, fruit.radius * 0.6, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(-fruit.radius * 0.25, -fruit.radius * 0.25, fruit.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSwipe() {
  if (state.currentSwipe.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(248, 113, 113, 0.85)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(state.currentSwipe[0].x, state.currentSwipe[0].y);
  for (let i = 1; i < state.currentSwipe.length; i++) {
    ctx.lineTo(state.currentSwipe[i].x, state.currentSwipe[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function updateFruits(dt) {
  const rect = canvas.getBoundingClientRect();
  state.fruits = state.fruits.filter((fruit) => {
    fruit.x += fruit.vx * dt;
    fruit.y += fruit.vy * dt;
    fruit.rotation += fruit.spin * dt;

    if (fruit.y + fruit.radius < 0) {
      return false;
    }

    if (fruit.y - fruit.radius > rect.height + 40) {
      return false;
    }

    if (fruit.x + fruit.radius < -20 || fruit.x - fruit.radius > rect.width + 20) {
      return false;
    }

    if (!fruit.sliced) {
      return true;
    }

    return false;
  });

  state.fruits.forEach((fruit) => {
    if (fruit.type !== 'bomb' && fruit.sliced) {
      return;
    }

    if (fruit.type === 'bomb' && fruit.y > rect.height + 40) {
      return;
    }
  });

  if (state.isPlaying) {
    state.fruits.forEach((fruit) => {
      if (fruit.sliced && fruit.type !== 'bomb') {
        return;
      }
    });
  }
}

function handleMissedFruits() {
  const rect = canvas.getBoundingClientRect();
  const missed = state.fruits.filter((fruit) => fruit.y > rect.height + 10 && !fruit.sliced);
  if (missed.length) {
    state.fruits = state.fruits.filter((fruit) => fruit.y <= rect.height + 10 || fruit.sliced);
    state.lives = Math.max(0, state.lives - missed.length);
    if (state.lives === 0) {
      state.isPlaying = false;
    }
    updateHud();
  }
}

function drawBackground() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const sky = ctx.createLinearGradient(0, 0, 0, rect.height);
  sky.addColorStop(0, '#0ea5e9');
  sky.addColorStop(0.55, '#7dd3fc');
  sky.addColorStop(1, '#dcfce7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 8; i++) {
    const x = (i + 1) * 90 + Math.sin(i * 0.7) * 14;
    ctx.beginPath();
    ctx.arc(x, 90 + i * 14, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  resizeCanvas();
  drawBackground();

  if (!state.isPlaying) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.getBoundingClientRect().width / 2, canvas.getBoundingClientRect().height / 2 - 10);
    ctx.font = '600 18px Arial';
    ctx.fillText('לחץ על "התחל מחדש" כדי לנסות שוב', canvas.getBoundingClientRect().width / 2, canvas.getBoundingClientRect().height / 2 + 30);
    return;
  }

  state.fruits.forEach(drawFruit);
  drawSwipe();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '700 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('גררו לחיתוך', 18, 28);
}

function resetGame() {
  state.score = 0;
  state.lives = 3;
  state.fruits = [];
  state.swipes = [];
  state.isPlaying = true;
  state.lastSpawn = 0;
  state.lastTime = 0;
  state.pointerActive = false;
  state.pointerPos = null;
  state.currentSwipe = [];
  updateHud();
  updateLevel();
}

function getPointerPosition(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function startSwipe(evt) {
  if (!state.isPlaying) {
    return;
  }

  state.pointerActive = true;
  state.currentSwipe = [getPointerPosition(evt)];
}

function moveSwipe(evt) {
  if (!state.pointerActive || !state.isPlaying) {
    return;
  }

  const point = getPointerPosition(evt);
  const lastPoint = state.currentSwipe[state.currentSwipe.length - 1];

  if (!lastPoint || lineDistance(lastPoint, point) > 2) {
    state.currentSwipe.push(point);
  }

  state.pointerPos = point;
}

function endSwipe() {
  if (!state.pointerActive || !state.isPlaying) {
    return;
  }

  sliceFruits();
  state.currentSwipe = [];
  state.pointerActive = false;
}

canvas.addEventListener('pointerdown', startSwipe);
canvas.addEventListener('pointermove', moveSwipe);
canvas.addEventListener('pointerup', endSwipe);
canvas.addEventListener('pointerleave', endSwipe);
canvas.addEventListener('pointercancel', endSwipe);

restartBtn.addEventListener('click', resetGame);

difficultySelect.addEventListener('change', (event) => {
  setDifficulty(event.target.value);
});

function gameLoop(timestamp) {
  const dt = Math.min(32, timestamp - (state.lastTime || timestamp));
  state.lastTime = timestamp;

  if (state.isPlaying) {
    spawnFruit(timestamp);
    updateFruits(dt);
    handleMissedFruits();
    updateHud();
  }

  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', resizeCanvas);
setDifficulty('medium');
resetGame();
requestAnimationFrame(gameLoop);
