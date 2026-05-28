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
  const scoreSideEl = document.getElementById("score-side");
  const linesSideEl = document.getElementById("lines-side");
  const levelSideEl = document.getElementById("level-side");
  const overlay = document.getElementById("overlay");
  const startScreen = document.getElementById("start-screen");
  const finalScoreEl = document.getElementById("final-score");
  const homeBtn = document.getElementById("btn-home");
  const homeGoBtn = document.getElementById("btn-home-go");
  const retryLiveBtn = document.getElementById("btn-retry-live");
  const nextPreviewEl = document.getElementById("next-preview");
  const holdPreviewEl = document.getElementById("hold-preview");
  const bgmVolumeEl = document.getElementById("bgm-volume");
  const seVolumeEl = document.getElementById("se-volume");
  const bgmVolumeValueEl = document.getElementById("bgm-volume-value");
  const seVolumeValueEl = document.getElementById("se-volume-value");
  const audioSettingsBtn = document.getElementById("btn-audio-settings");
  const audioSettingsPanel = document.getElementById("audio-settings-panel");
  const spotifyBtn = document.getElementById("btn-spotify");
  const musicAdImageEl = document.getElementById("music-ad-image");
  const musicAdTrackEl = document.getElementById("music-ad-track");
  const levelButtons = Array.from(document.querySelectorAll(".level-btn"));
  const body = document.body;
  const musicAds = [
    {
      title: "FIRE",
      image: "fire.jpg",
      url: "https://open.spotify.com/intl-ja/track/64ENDNvfw95DX9v45m1kKe?si=c71919499c694fcc",
    },
    {
      title: "KIRAMEKI",
      image: "kirameki.jpg",
      url: "https://open.spotify.com/intl-ja/track/6FwegiT1StQcQK4zSJEZ5X?si=2b925b7ac105498f",
    },
    {
      title: "IZON",
      image: "izon.jpg",
      url: "https://open.spotify.com/intl-ja/track/0rQOKHqwbgZuwXjuewZ3M0?si=15ffb57f7a47451d",
    },
  ];
  let currentMusicAd = musicAds[0];

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
  let startLevel = 1;
  let nextType = randomType();
  let holdType = null;
  const BGM_TRACKS = ["song1.mp3", "song2.mp3", "song3.mp3"];
  const bgmAudio = new Audio();
  let bgmVolume = 0.65;
  let seVolume = 0.6;
  let currentTrackIdx = -1;
  let audioCtx = null;

  bgmAudio.preload = "auto";
  bgmAudio.loop = false;
  bgmAudio.playsInline = true;

  function calcDropInterval(currentLevel) {
    return Math.max(120, 800 - (currentLevel - 1) * 70);
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function loadAudioSettings() {
    const savedBgm = Number(localStorage.getItem("miu-tetris-bgm-volume"));
    const savedSe = Number(localStorage.getItem("miu-tetris-se-volume"));
    if (!Number.isNaN(savedBgm)) bgmVolume = clamp01(savedBgm);
    if (!Number.isNaN(savedSe)) seVolume = clamp01(savedSe);
  }

  function saveAudioSettings() {
    localStorage.setItem("miu-tetris-bgm-volume", String(bgmVolume));
    localStorage.setItem("miu-tetris-se-volume", String(seVolume));
  }

  function syncAudioSettingsUI() {
    bgmVolumeEl.value = String(Math.round(bgmVolume * 100));
    seVolumeEl.value = String(Math.round(seVolume * 100));
    bgmVolumeValueEl.textContent = bgmVolumeEl.value;
    seVolumeValueEl.textContent = seVolumeEl.value;
    bgmAudio.volume = bgmVolume;
  }

  function setAudioSettingsOpen(open) {
    audioSettingsPanel.classList.toggle("hidden", !open);
    audioSettingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function createSeGain(ctx, now, peak, duration) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(ctx.destination);
    return gain;
  }

  function playTone(ctx, now, opts) {
    const osc = ctx.createOscillator();
    osc.type = opts.type || "sine";
    if (opts.freqAt) osc.frequency.setValueAtTime(opts.freqAt, now);
    if (opts.freqTo) osc.frequency.exponentialRampToValueAtTime(opts.freqTo, now + opts.duration);
    const gain = createSeGain(ctx, now, opts.peak, opts.duration);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + opts.duration + 0.02);
  }

  function playSe(type) {
    if (seVolume <= 0) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const v = seVolume * 0.36;

    switch (type) {
      case "move":
        playTone(ctx, now, {
          type: "square",
          freqAt: 980,
          freqTo: 820,
          duration: 0.04,
          peak: v * 0.65,
        });
        break;
      case "rotate":
        playTone(ctx, now, {
          type: "sine",
          freqAt: 1180,
          freqTo: 1560,
          duration: 0.07,
          peak: v * 0.75,
        });
        break;
      case "softDrop":
        playTone(ctx, now, {
          type: "triangle",
          freqAt: 420,
          freqTo: 310,
          duration: 0.06,
          peak: v * 0.7,
        });
        break;
      case "hardDrop":
        playTone(ctx, now, {
          type: "sine",
          freqAt: 190,
          freqTo: 85,
          duration: 0.12,
          peak: v * 1.1,
        });
        break;
      case "lineClear": {
        const notes = [1040, 1320, 1560, 1760];
        notes.forEach((freq, i) => {
          const t = now + i * 0.035;
          playTone(ctx, t, {
            type: "sine",
            freqAt: freq,
            freqTo: freq * 1.08,
            duration: 0.07,
            peak: v * 0.55,
          });
        });
        break;
      }
      case "gameOver":
        playTone(ctx, now, {
          type: "sawtooth",
          freqAt: 360,
          freqTo: 95,
          duration: 0.45,
          peak: v * 0.9,
        });
        break;
      case "start": {
        [660, 880, 1100].forEach((freq, i) => {
          playTone(ctx, now + i * 0.05, {
            type: "sine",
            freqAt: freq,
            freqTo: freq * 1.05,
            duration: 0.08,
            peak: v * 0.8,
          });
        });
        break;
      }
      case "retry":
        playTone(ctx, now, {
          type: "square",
          freqAt: 740,
          freqTo: 980,
          duration: 0.06,
          peak: v * 0.75,
        });
        playTone(ctx, now + 0.07, {
          type: "square",
          freqAt: 980,
          freqTo: 1180,
          duration: 0.06,
          peak: v * 0.7,
        });
        break;
      case "home":
        playTone(ctx, now, {
          type: "triangle",
          freqAt: 620,
          freqTo: 380,
          duration: 0.1,
          peak: v * 0.7,
        });
        break;
      default:
        break;
    }
  }

  function pickRandomTrack(excludeIdx) {
    if (BGM_TRACKS.length === 0) return -1;
    if (BGM_TRACKS.length === 1) return 0;
    let idx = excludeIdx;
    while (idx === excludeIdx) {
      idx = (Math.random() * BGM_TRACKS.length) | 0;
    }
    return idx;
  }

  function playTrackByIndex(idx) {
    if (idx < 0 || idx >= BGM_TRACKS.length) return;
    currentTrackIdx = idx;
    bgmAudio.src = BGM_TRACKS[idx];
    bgmAudio.currentTime = 0;
    bgmAudio.volume = bgmVolume;
    bgmAudio.play().catch(() => {});
  }

  function startBgmRandom() {
    if (BGM_TRACKS.length === 0) return;
    const idx = pickRandomTrack(-1);
    playTrackByIndex(idx);
  }

  function stopBgm() {
    bgmAudio.pause();
    bgmAudio.removeAttribute("src");
    bgmAudio.load();
    currentTrackIdx = -1;
  }

  function playNextBgmTrack() {
    const idx = pickRandomTrack(currentTrackIdx);
    playTrackByIndex(idx);
  }

  function pickRandomMusicAd() {
    if (musicAds.length === 0) return null;
    const idx = (Math.random() * musicAds.length) | 0;
    return musicAds[idx];
  }

  function updateGameOverMusicAd() {
    const ad = pickRandomMusicAd();
    if (!ad) return;
    currentMusicAd = ad;
    musicAdTrackEl.textContent = ad.title;
    musicAdImageEl.src = ad.image;
    musicAdImageEl.alt = "AIみう " + ad.title + " ジャケット";
  }

  function syncGameBackground() {
    const bgLevel = Math.max(1, Math.min(5, level));
    body.style.setProperty("--game-bg-image", 'url("level' + bgLevel + '.jpg")');
  }

  function updateLevelButtonState() {
    levelButtons.forEach((btn) => {
      const isActive = Number(btn.dataset.level) === startLevel;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomType() {
    return TYPES[(Math.random() * TYPES.length) | 0];
  }

  function renderPreview(type, target) {
    target.textContent = "";
    if (!type) return;
    const def = SHAPES[type];
    const minX = Math.min(...def.cells.map((c) => c[0]));
    const minY = Math.min(...def.cells.map((c) => c[1]));
    def.cells.forEach(([x, y]) => {
      const cell = document.createElement("span");
      cell.className = "preview-cell";
      cell.style.setProperty("--px", String(x - minX));
      cell.style.setProperty("--py", String(y - minY));
      cell.style.setProperty("--pc", def.color);
      target.appendChild(cell);
    });
  }

  function updatePreviewPanels() {
    renderPreview(nextType, nextPreviewEl);
    renderPreview(holdType, holdPreviewEl);
  }

  function spawnPiece() {
    const type = nextType;
    nextType = randomType();
    const def = SHAPES[type];
    updatePreviewPanels();
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
    holdType = piece.type;
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
      score += points[cleared] || 800;
      lines += cleared;
      level = startLevel + ((lines / 10) | 0);
      dropInterval = calcDropInterval(level);
      updateHud();
      syncGameBackground();
      playSe("lineClear");
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
    scoreSideEl.textContent = score;
    linesSideEl.textContent = lines;
    levelSideEl.textContent = level;
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
    if (!running || !piece) return false;
    const rotated = rotateCells(piece.cells);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(rotated, piece.x + k, piece.y)) {
        piece.cells = rotated;
        piece.x += k;
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    if (!running || !piece) return;
    let moved = false;
    while (move(0, 1)) moved = true;
    if (moved) playSe("hardDrop");
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animId);
    stopBgm();
    playSe("gameOver");
    updateGameOverMusicAd();
    finalScoreEl.textContent = score;
    homeBtn.classList.add("hidden");
    overlay.classList.remove("hidden");
  }

  function showTitleScreen() {
    running = false;
    cancelAnimationFrame(animId);
    nextType = randomType();
    holdType = null;
    grid = createGrid();
    piece = spawnPiece();
    score = 0;
    lines = 0;
    level = startLevel;
    dropInterval = calcDropInterval(level);
    lastDrop = 0;
    updateHud();
    overlay.classList.add("hidden");
    startScreen.classList.remove("hidden");
    homeBtn.classList.add("hidden");
    retryLiveBtn.classList.add("hidden");
    stopBgm();
    body.classList.remove("game-active");
    body.style.removeProperty("--game-bg-image");
    body.classList.add("title-screen");
    setAudioSettingsOpen(false);
    updatePreviewPanels();
    draw();
  }

  function resetGame() {
    nextType = randomType();
    holdType = null;
    grid = createGrid();
    piece = spawnPiece();
    score = 0;
    lines = 0;
    level = startLevel;
    dropInterval = calcDropInterval(level);
    lastDrop = 0;
    updateHud();
    overlay.classList.add("hidden");
    startScreen.classList.add("hidden");
    setAudioSettingsOpen(false);
    homeBtn.classList.remove("hidden");
    retryLiveBtn.classList.remove("hidden");
    startBgmRandom();
    syncGameBackground();
    body.classList.add("game-active");
    body.classList.remove("title-screen");
    updatePreviewPanels();
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

  function parseCssLengthToPx(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return 0;
    if (value.endsWith("rem")) {
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return (parseFloat(value) || 0) * rootSize;
    }
    if (value.endsWith("px")) return parseFloat(value) || 0;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  function updateViewportHeightVar() {
    const vv = window.visualViewport;
    const viewportH = vv && vv.height ? vv.height : window.innerHeight;
    const vh = Math.max(1, viewportH * 0.01);
    document.documentElement.style.setProperty("--vh", vh + "px");
    document.documentElement.style.setProperty("--app-height", vh * 100 + "px");
  }

  function recalcLayout() {
    updateViewportHeightVar();
    resizeCanvas();
  }

  function recalcLayoutSoon() {
    requestAnimationFrame(recalcLayout);
  }

  function forceInitialLayoutSync() {
    recalcLayout();
    setTimeout(recalcLayout, 300);
    setTimeout(recalcLayout, 800);
  }

  function resizeCanvas() {
    syncControlsHeight();
    const wrap = canvas.parentElement;
    const wrapMaxW = wrap.clientWidth - 4;
    const maxH = wrap.clientHeight - 4;
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const bodyPadL = parseCssLengthToPx(bodyStyle.paddingLeft);
    const bodyPadR = parseCssLengthToPx(bodyStyle.paddingRight);
    const viewportW = window.innerWidth - bodyPadL - bodyPadR - 4;
    let maxW = Math.max(120, Math.min(wrapMaxW, viewportW));

    if (document.body.classList.contains("game-active")) {
      const chromeW = parseCssLengthToPx(rootStyle.getPropertyValue("--chrome-w"));
      const chromeGap = parseCssLengthToPx(rootStyle.getPropertyValue("--chrome-gap"));
      const sideSpace = (chromeW + chromeGap) * 2;
      maxW = Math.max(120, Math.min(maxW, viewportW - sideSpace));
    }

    const boardW = COLS * BLOCK;
    const boardH = ROWS * BLOCK;
    let scaleCap = 2;
    if (window.innerWidth <= 768) scaleCap = 1.95;
    if (window.innerWidth <= 430) scaleCap = 1.9;
    if (window.innerWidth <= 390) scaleCap = 1.8;
    const scale = Math.min(maxW / boardW, maxH / boardH, scaleCap);
    displayScale = scale;
    canvas.style.width = boardW * scale + "px";
    canvas.style.height = boardH * scale + "px";
    document.documentElement.style.setProperty("--board-render-width", boardW * scale + "px");
  }

  function parseColor(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
    };
  }

  function tone(rgb, amount, lighten) {
    const v = lighten ? rgb + amount : rgb * amount;
    return Math.max(0, Math.min(255, v | 0));
  }

  function drawBlock(x, y, color, ghost, glowing) {
    const px = x * BLOCK;
    const py = y * BLOCK;
    const pad = 2;
    const w = BLOCK - pad * 2;
    const h = BLOCK - pad * 2;
    const bx = px + pad;
    const by = py + pad;

    if (ghost) {
      ctx.fillStyle = "rgba(255, 79, 216, 0.12)";
      ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle = "rgba(255, 190, 235, 0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
      return;
    }

    const rgb = parseColor(color);

    ctx.fillStyle = "rgba(255, 79, 216, 0.2)";
    ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);

    if (glowing) {
      ctx.shadowColor = "rgba(255, 79, 216, 0.9)";
      ctx.shadowBlur = 9;
    }

    const bodyGrad = ctx.createLinearGradient(bx, by, bx, by + h);
    bodyGrad.addColorStop(
      0,
      `rgb(${tone(rgb.r, 55, true)}, ${tone(rgb.g, 55, true)}, ${tone(rgb.b, 55, true)})`
    );
    bodyGrad.addColorStop(0.48, color);
    bodyGrad.addColorStop(
      1,
      `rgb(${tone(rgb.r, 0.52, false)}, ${tone(rgb.g, 0.52, false)}, ${tone(rgb.b, 0.52, false)})`
    );
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(bx, by, w, h);

    if (glowing) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

    const shineGrad = ctx.createLinearGradient(bx, by, bx, by + h * 0.5);
    shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
    shineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shineGrad;
    ctx.fillRect(bx, by, w, Math.max(3, h * 0.42));

    ctx.strokeStyle = "rgba(255, 236, 250, 0.95)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);

    ctx.strokeStyle = "rgba(255, 79, 216, 0.5)";
    ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
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
        if (grid[r][c]) drawBlock(c, r, grid[r][c], false, false);
      }
    }

    if (piece) {
      const gy = ghostY();
      for (const [x, y] of piece.cells) {
        drawBlock(x + piece.x, y + gy, piece.color, true, false);
      }
      for (const [x, y] of piece.cells) {
        drawBlock(x + piece.x, y + piece.y, piece.color, false, true);
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
        if (move(-1, 0)) playSe("move");
        break;
      case "right":
        if (move(1, 0)) playSe("move");
        break;
      case "down":
        if (move(0, 1)) playSe("softDrop");
        break;
      case "rotate":
        if (rotate()) playSe("rotate");
        break;
      case "hard":
        hardDrop();
        break;
    }
    draw();
  }

  document.getElementById("btn-start").addEventListener("click", () => {
    playSe("start");
    resetGame();
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    playSe("retry");
    resetGame();
  });
  retryLiveBtn.addEventListener("click", () => {
    playSe("retry");
    resetGame();
  });
  function goHome() {
    playSe("home");
    showTitleScreen();
  }
  homeBtn.addEventListener("click", goHome);
  homeGoBtn.addEventListener("click", goHome);
  bgmAudio.addEventListener("ended", playNextBgmTrack);
  audioSettingsBtn.addEventListener("click", () => {
    playSe("move");
    setAudioSettingsOpen(audioSettingsBtn.getAttribute("aria-expanded") !== "true");
  });
  levelButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      startLevel = Number(btn.dataset.level) || 1;
      updateLevelButtonState();
      playSe("move");
    });
  });
  bgmVolumeEl.addEventListener("input", () => {
    bgmVolume = clamp01(Number(bgmVolumeEl.value) / 100);
    syncAudioSettingsUI();
    saveAudioSettings();
  });
  seVolumeEl.addEventListener("input", () => {
    seVolume = clamp01(Number(seVolumeEl.value) / 100);
    syncAudioSettingsUI();
    saveAudioSettings();
  });
  spotifyBtn.addEventListener("click", () => {
    playSe("start");
    if (!currentMusicAd || !currentMusicAd.url) return;
    const newTab = window.open(currentMusicAd.url, "_blank", "noopener,noreferrer");
    if (!newTab) {
      window.location.href = currentMusicAd.url;
    }
  });

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
      playSe("start");
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

  window.addEventListener("resize", recalcLayoutSoon);
  window.addEventListener("orientationchange", () => {
    recalcLayoutSoon();
    setTimeout(recalcLayout, 120);
    setTimeout(recalcLayout, 300);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", recalcLayoutSoon);
  }

  canvas.width = COLS * BLOCK;
  canvas.height = ROWS * BLOCK;
  loadAudioSettings();
  syncAudioSettingsUI();
  updateGameOverMusicAd();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", forceInitialLayoutSync, { once: true });
  } else {
    forceInitialLayoutSync();
  }
  updateLevelButtonState();
  showTitleScreen();
  draw();
})();
