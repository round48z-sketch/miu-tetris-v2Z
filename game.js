(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 20;

  const SHAPES = {
    I: { color: "#7ef9ff", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { color: "#ffe66d", cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    T: { color: "#ff4fd8", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { color: "#7dff9a", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { color: "#ff6b8a", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { color: "#a78bfa", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { color: "#ffb347", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  };

  const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startScreen = document.getElementById("start-screen");
  const finalScoreEl = document.getElementById("final-score");
  const homeBtn = document.getElementById("btn-home");

  let grid = [];
  let piece = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 800;
  let lastDrop = 0;
  let running = false;
  let animId = 0;
  let displayScale = 1;

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomType() {
    return TYPES[(Math.random() * TYPES.length) | 0];
  }

  function spawnPiece() {
    const type = randomType();
    const def = SHAPES[type];
    return {
      type,
      color: def.color,
      cells: def.cells.map(([x, y]) => [x, y]),
      x: 3,
      y: 0,
    };
  }

  function rotateCells(cells) {
    const maxX = Math.max(...cells.map((c) => c[0]));
    const maxY = Math.max(...cells.map((c) => c[1]));
    const size = Math.max(maxX, maxY) + 1;
    return cells.map(([x, y]) => [size - 1 - y, x]);
  }

  function collides(cells, ox, oy) {
    for (const [x, y] of cells) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && grid[ny][nx]) return true;
    }
    return false;
  }

  function lockPiece() {
    for (const [x, y] of piece.cells) {
      const gx = x + piece.x;
      const gy = y + piece.y;
      if (gy < 0) {
        gameOver();
        return;
      }
      grid[gy][gx] = piece.color;
    }
    clearLines();
    piece = spawnPiece();
    if (collides(piece.cells, piece.x, piece.y)) gameOver();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((c) => c)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800];
      score += (points[cleared] || 800) * level;
      lines += cleared;
      level = 1 + (lines / 10) | 0;
      dropInterval = Math.max(120, 800 - (level - 1) * 70);
      updateHud();
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }

  function move(dx, dy) {
    if (!running || !piece) return;
    if (!collides(piece.cells, piece.x + dx, piece.y + dy)) {
      piece.x += dx;
      piece.y += dy;
      return true;
    }
    if (dy > 0) lockPiece();
    return false;
  }

  function rotate() {
    if (!running || !piece) return;
    const rotated = rotateCells(piece.cells);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(rotated, piece.x + k, piece.y)) {
        piece.cells = rotated;
        piece.x += k;
        return;
      }
    }
  }

  function hardDrop() {
    if (!running || !piece) return;
    while (move(0, 1)) {}
    score += 2;
    updateHud();
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animId);
    finalScoreEl.textContent = score;
    overlay.classList.remove("hidden");
  }

  function showTitleScreen() {
    running = false;
    cancelAnimationFrame(animId);
    grid = createGrid();
    piece = spawnPiece();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    lastDrop = 0;
    updateHud();
    overlay.classList.add("hidden");
    startScreen.classList.remove("hidden");
    homeBtn.classList.add("hidden");
    draw();
  }

  function resetGame() {
    grid = createGrid();
    piece = spawnPiece();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    lastDrop = 0;
    updateHud();
    overlay.classList.add("hidden");
    startScreen.classList.add("hidden");
    homeBtn.classList.remove("hidden");
    running = true;
    lastDrop = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function syncControlsHeight() {
    const controls = document.querySelector(".controls");
    if (!controls) return;
    const h = controls.offsetHeight;
    document.documentElement.style.setProperty("--controls-h", h + "px");
  }

  function resizeCanvas() {
    syncControlsHeight();
    const wrap = canvas.parentElement;
    const maxW = wrap.clientWidth - 4;
    const maxH = wrap.clientHeight - 4;
    const boardW = COLS * BLOCK;
    const boardH = ROWS * BLOCK;
    const scale = Math.min(maxW / boardW, maxH / boardH, 2);
    displayScale = scale;
    canvas.style.width = boardW * scale + "px";
    canvas.style.height = boardH * scale + "px";
  }

  function drawBlock(x, y, color, ghost) {
    const px = x * BLOCK;
    const py = y * BLOCK;
    const pad = 1;

    ctx.fillStyle = ghost ? "rgba(255, 79, 216, 0.08)" : color;
    ctx.fillRect(px + pad, py + pad, BLOCK - pad * 2, BLOCK - pad * 2);

    if (!ghost) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + pad, py + pad, BLOCK - pad * 2, BLOCK - pad * 2);

      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(px + pad, py + pad, BLOCK - pad * 2, 3);
      ctx.shadowBlur = 0;
    }
  }

  function ghostY() {
    let gy = piece.y;
    while (!collides(piece.cells, piece.x, gy + 1)) gy++;
    return gy;
  }

  function draw() {
    const w = COLS * BLOCK;
    const h = ROWS * BLOCK;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 79, 216, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK, 0);
      ctx.lineTo(x * BLOCK, h);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK);
      ctx.lineTo(w, y * BLOCK);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) drawBlock(c, r, grid[r][c], false);
      }
    }

    if (piece) {
      const gy = ghostY();
      for (const [x, y] of piece.cells) {
        drawBlock(x + piece.x, y + gy, piece.color, true);
      }
      for (const [x, y] of piece.cells) {
        drawBlock(x + piece.x, y + piece.y, piece.color, false);
      }
    }
  }

  function loop(now) {
    if (!running) return;
    if (now - lastDrop >= dropInterval) {
      move(0, 1);
      lastDrop = now;
    }
    draw();
    animId = requestAnimationFrame(loop);
  }

  function handleAction(action) {
    if (!running) return;
    switch (action) {
      case "left":
        move(-1, 0);
        break;
      case "right":
        move(1, 0);
        break;
      case "down":
        if (move(0, 1)) {
          score += 1;
          updateHud();
        }
        break;
      case "rotate":
        rotate();
        break;
      case "hard":
        hardDrop();
        break;
    }
    draw();
  }

  document.getElementById("btn-start").addEventListener("click", resetGame);
  document.getElementById("btn-restart").addEventListener("click", resetGame);
  homeBtn.addEventListener("click", showTitleScreen);

  const REPEAT_DELAY = 220;
  const REPEAT_INTERVAL = 75;

  function bindControlButton(btn) {
    const action = btn.dataset.action;
    const canRepeat = btn.dataset.repeat === "true";
    let delayTimer = null;
    let repeatTimer = null;

    function stopRepeat() {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      delayTimer = null;
      repeatTimer = null;
      btn.classList.remove("is-pressed");
    }

    function startRepeat() {
      handleAction(action);
      if (!canRepeat) return;
      delayTimer = setTimeout(() => {
        repeatTimer = setInterval(() => handleAction(action), REPEAT_INTERVAL);
      }, REPEAT_DELAY);
    }

    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add("is-pressed");
      startRepeat();
    });

    ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach((ev) => {
      btn.addEventListener(ev, stopRepeat);
    });
  }

  document.querySelectorAll(".ctrl-btn").forEach(bindControlButton);

  document.addEventListener("keydown", (e) => {
    if (startScreen.classList.contains("hidden") === false && e.code === "Space") {
      resetGame();
      return;
    }
    const map = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowDown: "down",
      ArrowUp: "rotate",
      KeyZ: "rotate",
      KeyX: "rotate",
      Space: "hard",
    };
    const action = map[e.code];
    if (action) {
      e.preventDefault();
      handleAction(action);
    }
  });

  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.target.closest(".app")) e.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 150);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeCanvas);
  }

  canvas.width = COLS * BLOCK;
  canvas.height = ROWS * BLOCK;
  syncControlsHeight();
  resizeCanvas();
  draw();
})();
