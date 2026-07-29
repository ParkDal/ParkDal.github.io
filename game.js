(() => {
  const canvas = document.querySelector('#game-board');
  const difficultySelect = document.querySelector('#difficulty');
  const startButton = document.querySelector('#start-game');
  const restartButton = document.querySelector('#restart-game');
  const pauseButton = document.querySelector('#pause-game');
  const scoreElement = document.querySelector('#score');
  const highScoreElement = document.querySelector('#high-score');
  const enemyCountElement = document.querySelector('#enemy-count');
  const statusElement = document.querySelector('#game-status');
  if (!canvas || !difficultySelect || !startButton || !restartButton || !pauseButton) return;

  const ctx = canvas.getContext('2d');
  const columns = 24;
  const rows = 18;
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / rows;
  const vectors = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const settingsByLevel = {
    1: { wormDelay: 210, enemyDelay: 330, enemies: 1 },
    2: { wormDelay: 175, enemyDelay: 275, enemies: 2 },
    3: { wormDelay: 140, enemyDelay: 220, enemies: 3 },
    4: { wormDelay: 110, enemyDelay: 170, enemies: 4 },
    5: { wormDelay: 82, enemyDelay: 125, enemies: 5 }
  };
  let worm = [];
  let direction = vectors.right;
  let queuedDirection = vectors.right;
  let enemies = [];
  let food = { x: 5, y: 5 };
  let score = 0;
  let highScore = Number(localStorage.getItem('parkdal-worm-high-score') || 0);
  let state = 'ready';
  let lastFrame = 0;
  let wormClock = 0;
  let enemyClock = 0;
  let animationTime = 0;

  const samePoint = (a, b) => a.x === b.x && a.y === b.y;
  const randomPoint = () => ({ x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) });
  const occupied = (point) => worm.some((segment) => samePoint(segment, point)) || enemies.some((enemy) => samePoint(enemy.position, point));
  const levelSettings = () => settingsByLevel[difficultySelect.value];

  function updateScore() {
    scoreElement.textContent = score;
    highScoreElement.textContent = highScore;
  }

  function placeFood() {
    let next = randomPoint();
    while (occupied(next)) next = randomPoint();
    food = next;
  }

  function spawnEnemies(count) {
    enemies = [];
    while (enemies.length < count) {
      const position = randomPoint();
      if (occupied(position) || samePoint(position, food)) continue;
      const names = Object.keys(vectors);
      enemies.push({ position, direction: vectors[names[Math.floor(Math.random() * names.length)]] });
    }
  }

  function setDirection(name) {
    const requested = vectors[name];
    if (!requested || (requested.x + direction.x === 0 && requested.y + direction.y === 0)) return;
    queuedDirection = requested;
  }

  function resetGame() {
    worm = [{ x: Math.floor(columns / 2), y: Math.floor(rows / 2) }, { x: Math.floor(columns / 2) - 1, y: Math.floor(rows / 2) }];
    direction = vectors.right;
    queuedDirection = direction;
    score = 0;
    state = 'ready';
    wormClock = 0;
    enemyClock = 0;
    food = { x: 5, y: 5 };
    spawnEnemies(levelSettings().enemies);
    enemyCountElement.textContent = levelSettings().enemies;
    startButton.hidden = false;
    restartButton.hidden = true;
    pauseButton.disabled = true;
    pauseButton.textContent = '일시정지';
    statusElement.textContent = '시작 버튼을 눌러 출발하세요.';
    updateScore();
    draw();
  }

  function startGame() {
    if (state !== 'ready') return;
    state = 'playing';
    startButton.hidden = true;
    restartButton.hidden = false;
    pauseButton.disabled = false;
    statusElement.textContent = '게임 진행 중';
  }

  function togglePause() {
    if (state === 'ready' || state === 'won' || state === 'lost') return;
    state = state === 'paused' ? 'playing' : 'paused';
    pauseButton.textContent = state === 'paused' ? '계속하기' : '일시정지';
    statusElement.textContent = state === 'paused' ? '일시정지됨' : '게임 진행 중';
  }

  function finish(message, won = false) {
    state = won ? 'won' : 'lost';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('parkdal-worm-high-score', String(highScore));
    }
    startButton.hidden = true;
    restartButton.hidden = false;
    pauseButton.disabled = true;
    pauseButton.textContent = '일시정지';
    updateScore();
    statusElement.textContent = message;
    draw();
  }

  function moveWorm() {
    direction = queuedDirection;
    const next = { x: worm[0].x + direction.x, y: worm[0].y + direction.y };
    if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows || worm.some((segment) => samePoint(segment, next))) return finish('게임 오버! 벽 또는 몸에 부딪혔습니다.');
    worm.unshift(next);
    if (samePoint(next, food)) {
      score += 1;
      if (score >= 10) return finish('승리! 먹이 10개를 모두 먹었습니다.', true);
      placeFood();
    } else {
      worm.pop();
    }
    if (enemies.some((enemy) => samePoint(enemy.position, next))) finish('게임 오버! 적과 충돌했습니다.');
    updateScore();
  }

  function moveEnemies() {
    enemies.forEach((enemy) => {
      const choices = Object.values(vectors).filter((vector) => vector.x + enemy.direction.x !== 0 || vector.y + enemy.direction.y !== 0);
      const chosen = choices[Math.floor(Math.random() * choices.length)];
      const next = { x: enemy.position.x + chosen.x, y: enemy.position.y + chosen.y };
      if (next.x >= 0 && next.x < columns && next.y >= 0 && next.y < rows) {
        enemy.position = next;
        enemy.direction = chosen;
      }
      if (worm.some((segment) => samePoint(segment, enemy.position))) finish('게임 오버! 적과 충돌했습니다.');
    });
  }

  function drawCell(point, color, radius = 5, glow = 0) {
    const pad = 3;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    ctx.roundRect(point.x * cellWidth + pad, point.y * cellHeight + pad, cellWidth - pad * 2, cellHeight - pad * 2, radius);
    ctx.fill();
    ctx.restore();
  }

  function drawHead() {
    const head = worm[0];
    drawCell(head, '#e9fff7', 7, 18);
    const eyeOffset = direction.x !== 0 ? { x: direction.x * 5, y: 4 } : { x: 4, y: direction.y * 5 };
    ctx.fillStyle = '#0b111b';
    ctx.beginPath();
    ctx.arc(head.x * cellWidth + cellWidth / 2 + eyeOffset.x, head.y * cellHeight + cellHeight / 2 + eyeOffset.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOverlay() {
    if (state === 'playing') return;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 15, .62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#63f5b0';
    ctx.font = '800 24px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(state === 'ready' ? 'PRESS START' : state === 'paused' ? 'PAUSED' : state === 'won' ? 'MISSION CLEAR' : 'GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  function draw() {
    const background = ctx.createRadialGradient(canvas.width * .5, canvas.height * .4, 20, canvas.width * .5, canvas.height * .4, canvas.width * .8);
    background.addColorStop(0, '#17283a');
    background.addColorStop(1, '#070a11');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(99, 245, 176, .1)';
    for (let x = 0; x <= columns; x += 1) { ctx.beginPath(); ctx.moveTo(x * cellWidth, 0); ctx.lineTo(x * cellWidth, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= rows; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * cellHeight); ctx.lineTo(canvas.width, y * cellHeight); ctx.stroke(); }
    const pulse = 12 + Math.sin(animationTime / 180) * 4;
    drawCell(food, '#ffcf5c', 10, pulse);
    enemies.forEach((enemy) => drawCell(enemy.position, '#ff5c7c', 7, 14));
    worm.slice(1).forEach((segment, index) => drawCell(segment, index % 2 ? '#42c995' : '#63f5b0', 7, 8));
    drawHead();
    drawOverlay();
  }

  function frame(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    const elapsed = timestamp - lastFrame;
    lastFrame = timestamp;
    animationTime = timestamp;
    if (state === 'playing') {
      wormClock += elapsed;
      enemyClock += elapsed;
      if (wormClock >= levelSettings().wormDelay) { wormClock = 0; moveWorm(); }
      if (enemyClock >= levelSettings().enemyDelay) { enemyClock = 0; moveEnemies(); }
    }
    draw();
    requestAnimationFrame(frame);
  }

  document.addEventListener('keydown', (event) => {
    const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', p: 'pause', P: 'pause' };
    if (keys[event.key] === 'pause') { event.preventDefault(); togglePause(); return; }
    if (keys[event.key]) { event.preventDefault(); setDirection(keys[event.key]); }
  });
  document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  startButton.addEventListener('click', startGame);
  restartButton.addEventListener('click', resetGame);
  pauseButton.addEventListener('click', togglePause);
  difficultySelect.addEventListener('change', resetGame);
  resetGame();
  requestAnimationFrame(frame);
})();
