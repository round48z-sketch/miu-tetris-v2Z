(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 20;

  const SHAPES = {
    I: { color: "#00e8ff", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { color: "#ffe566", cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    T: { color: "#ff4fd8", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { color: "#3dffa8", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { color: "#ff4768", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { color: "#7b8cff", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { color: "#ff7a3d", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
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
  const tapGate = document.getElementById("tap-gate");
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
  const TITLE_BGM = "OP.mp3";
  const BGM_TRACKS = ["song1.mp3", "song2.mp3", "song3.mp3"];
  const bgmAudio = new Audio();
  let bgmVolume = 0.65;
  let seVolume = 0.6;
  let currentTrackIdx = -1;
  let audioCtx = null;
  let titleReady = false;
  let lastSePreviewAt = 0;
  let lockedMobilePortraitHeight = 0;
  let lockedOrientationIsPortrait = null;

  bgmAudio.preload = "auto";
  bgmAudio.loop = false;
  bgmAudio.playsInline = true;
  bgmAudio.src = TITLE_BGM;

  function isTitleBgmLoaded() {
    return (bgmAudio.currentSrc || bgmAudio.src || "").includes(TITLE_BGM);
  }

  function tryPlayBgm() {
    return bgmAudio.play().catch(() => {});
  }

  function unlockTitleScreen() {
    if (titleReady) return;
    titleReady = true;
    body.classList.remove("title-locked");
    tapGate.classList.add("hidden");
    ensureAudioContext();
    startTitleBgm();
  }

  function syncTitleGate() {
    if (titleReady) {
      tapGate.classList.add("hidden");
      body.classList.remove("title-locked");
      startTitleBgm();
      return;
    }
    tapGate.classList.remove("hidden");
    body.classList.add("title-locked");
  }

  function resumeTitleBgmIfNeeded() {
    if (!titleReady || !body.classList.contains("title-screen")) return;
    if (bgmAudio.paused || !isTitleBgmLoaded()) {
      startTitleBgm();
    }
  }

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
    ensureAudioContext();
    resumeTitleBgmIfNeeded();
    if (seVolume <= 0) return;
    const ctx = audioCtx;
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
    bgmAudio.loop = false;
    bgmAudio.src = BGM_TRACKS[idx];
    bgmAudio.currentTime = 0;
    bgmAudio.volume = bgmVolume;
    bgmAudio.play().catch(() => {});
  }

  function startTitleBgm() {
    bgmAudio.loop = true;
    bgmAudio.volume = bgmVolume;
    currentTrackIdx = -1;
    if (!isTitleBgmLoaded()) {
      bgmAudio.src = TITLE_BGM;
      bgmAudio.currentTime = 0;
    }
    tryPlayBgm();
  }

  function startBgmRandom() {
    if (BGM_TRACKS.length === 0) return;
    const idx = pickRandomTrack(-1);
    playTrackByIndex(idx);
  }

  function stopBgm() {
    bgmAudio.pause();
    bgmAudio.loop = false;
    bgmAudio.removeAttribute("src");
    bgmAudio.load();
    currentTrackIdx = -1;
  }

  function playNextBgmTrack() {
    const idx = pickRandomTrack(currentTrackIdx);
    playTrackByIndex(idx);
  }

  function previewBgmVolume() {
    bgmAudio.volume = bgmVolume;
    if (running) return;

    if (body.classList.contains("title-screen")) {
      if (!titleReady) return;
      if (bgmAudio.paused || !bgmAudio.getAttribute("src")) {
        startTitleBgm();
      }
      return;
    }

    if (BGM_TRACKS.length === 0) return;

    if (!bgmAudio.getAttribute("src")) {
      currentTrackIdx = 0;
      bgmAudio.loop = false;
      bgmAudio.src = BGM_TRACKS[currentTrackIdx];
      bgmAudio.currentTime = 0;
    }
    if (bgmAudio.paused) {
      bgmAudio.play().catch(() => {});
    }
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
    body.classList.remove("game-active");
    body.style.removeProperty("--game-bg-image");
    body.classList.add("title-screen");
    setAudioSettingsOpen(false);
    syncTitleGate();
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
    stabilizeLayoutAfterStart();
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

  function isMobileViewport() {
    return window.innerWidth <= 768;
  }

  function isPortraitViewport() {
    const vv = window.visualViewport;
    const w = vv && vv.width ? vv.width : window.innerWidth;
    const h = vv && vv.height ? vv.height : window.innerHeight;
    return h >= w;
  }

  function resetMobileHeightLock() {
    lockedMobilePortraitHeight = 0;
    lockedOrientationIsPortrait = null;
  }

  function updateViewportHeightVar() {
    const vv = window.visualViewport;
    const rawViewportH = vv && vv.height ? vv.height : window.innerHeight;
    let viewportH = rawViewportH;

    if (isMobileViewport()) {
      const isPortrait = isPortraitViewport();
      if (lockedOrientationIsPortrait === null || lockedOrientationIsPortrait !== isPortrait) {
        lockedOrientationIsPortrait = isPortrait;
        lockedMobilePortraitHeight = 0;
      }
      if (isPortrait) {
        lockedMobilePortraitHeight = Math.max(lockedMobilePortraitHeight, rawViewportH);
        viewportH = lockedMobilePortraitHeight;
      }
    } else {
      resetMobileHeightLock();
    }

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

  function stabilizeLayoutAfterStart() {
    if (!isMobileViewport()) {
      recalcLayout();
      return;
    }
    resetMobileHeightLock();
    recalcLayout();
    setTimeout(recalcLayout, 250);
    setTimeout(recalcLayout, 650);
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

  function rgba(rgb, alpha) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function roundRectPath(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fillRoundRect(x, y, w, h, radius) {
    roundRectPath(x, y, w, h, radius);
    ctx.fill();
  }

  function strokeRoundRect(x, y, w, h, radius) {
    roundRectPath(x, y, w, h, radius);
    ctx.stroke();
  }

  function drawBlock(x, y, color, ghost, glowing) {
    const px = x * BLOCK;
    const py = y * BLOCK;
    const inset = 1;
    const w = BLOCK - inset * 2;
    const h = BLOCK - inset * 2;
    const bx = px + inset;
    const by = py + inset;
    const radius = Math.max(4.5, BLOCK * 0.36);
    const glowBoost = glowing ? 1.45 : 1;

    if (ghost) {
      ctx.fillStyle = "rgba(255, 79, 216, 0.1)";
      fillRoundRect(bx - 1, by - 1, w + 2, h + 2, radius + 1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      fillRoundRect(bx, by, w, h, radius);
      ctx.strokeStyle = "rgba(255, 230, 250, 0.55)";
      ctx.lineWidth = 1;
      strokeRoundRect(bx + 0.5, by + 0.5, w - 1, h - 1, radius);
      return;
    }

    const rgb = parseColor(color);
    const light = {
      r: tone(rgb.r, 95, true),
      g: tone(rgb.g, 95, true),
      b: tone(rgb.b, 95, true),
    };
    const dark = {
      r: tone(rgb.r, 0.32, false),
      g: tone(rgb.g, 0.32, false),
      b: tone(rgb.b, 0.32, false),
    };

    ctx.fillStyle = rgba(rgb, 0.3 * glowBoost);
    fillRoundRect(bx - 3, by - 3, w + 6, h + 6, radius + 3);
    ctx.fillStyle = rgba(rgb, 0.2 * glowBoost);
    fillRoundRect(bx - 2, by - 2, w + 4, h + 4, radius + 2);
    ctx.fillStyle = rgba(rgb, 0.13 * glowBoost);
    fillRoundRect(bx - 1, by - 1, w + 2, h + 2, radius + 1);

    if (glowing) {
      ctx.shadowColor = rgba(rgb, 1);
      ctx.shadowBlur = 18;
    }

    const cx = bx + w * 0.5;
    const cy = by + h * 0.5;
    const glassCore = ctx.createRadialGradient(cx - w * 0.14, cy - h * 0.2, 0, cx, cy, w * 0.9);
    glassCore.addColorStop(0, rgba(light, 0.78));
    glassCore.addColorStop(0.3, rgba(rgb, 0.72));
    glassCore.addColorStop(0.68, rgba(rgb, 0.66));
    glassCore.addColorStop(1, rgba(dark, 0.78));
    ctx.fillStyle = glassCore;
    fillRoundRect(bx, by, w, h, radius);

    const tintGrad = ctx.createLinearGradient(bx, by, bx + w, by + h);
    tintGrad.addColorStop(0, rgba(light, 0.38));
    tintGrad.addColorStop(0.45, rgba(rgb, 0.28));
    tintGrad.addColorStop(1, rgba(dark, 0.32));
    ctx.fillStyle = tintGrad;
    fillRoundRect(bx, by, w, h, radius);

    const frostGrad = ctx.createLinearGradient(bx, by, bx + w, by + h);
    frostGrad.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    frostGrad.addColorStop(0.32, "rgba(255, 255, 255, 0.1)");
    frostGrad.addColorStop(1, "rgba(0, 0, 0, 0.12)");
    ctx.fillStyle = frostGrad;
    fillRoundRect(bx, by, w, h, radius);

    if (glowing) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.fillStyle = rgba(rgb, 0.28);
      fillRoundRect(bx - 0.5, by - 0.5, w + 1, h + 1, radius + 0.5);
    }

    const shineGrad = ctx.createLinearGradient(bx, by, bx, by + h * 0.65);
    shineGrad.addColorStop(0, "rgba(255, 255, 255, 0.62)");
    shineGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.18)");
    shineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shineGrad;
    fillRoundRect(bx, by, w, h * 0.58, radius);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
    ctx.lineWidth = 1.4;
    strokeRoundRect(bx + 0.5, by + 0.5, w - 1, h - 1, radius);

    ctx.strokeStyle = rgba(light, 0.82);
    ctx.lineWidth = 0.95;
    strokeRoundRect(bx + 1.1, by + 1.1, w - 2.2, h - 2.2, Math.max(3, radius - 1.1));

    ctx.strokeStyle = rgba(rgb, 0.72);
    ctx.lineWidth = 0.75;
    strokeRoundRect(bx + 2, by + 2, w - 4, h - 4, Math.max(2.5, radius - 2));
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

    ctx.strokeStyle = "rgba(255, 79, 216, 0.06)";
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

  tapGate.addEventListener("click", () => {
    unlockTitleScreen();
    playSe("start");
  });
  document.getElementById("btn-start").addEventListener("click", () => {
    if (!titleReady) return;
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
    previewBgmVolume();
    saveAudioSettings();
  });
  seVolumeEl.addEventListener("input", () => {
    seVolume = clamp01(Number(seVolumeEl.value) / 100);
    syncAudioSettingsUI();
    const now = performance.now();
    if (now - lastSePreviewAt > 90) {
      playSe("move");
      lastSePreviewAt = now;
    }
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
    const canRepeat = btn.dataset.repeat === "true" || action === "down";
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
    if (startScreen.classList.contains("hidden") === false) {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!titleReady) {
          unlockTitleScreen();
          playSe("start");
          return;
        }
        if (e.code === "Space") {
          playSe("start");
          resetGame();
        }
        return;
      }
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
      if (e.target.closest(".audio-slider")) return;
      if (e.target.matches('input[type="range"]')) return;
      if (e.target.closest(".app")) e.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("pageshow", () => {
    if (titleReady && body.classList.contains("title-screen")) {
      startTitleBgm();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (titleReady && body.classList.contains("title-screen")) {
      startTitleBgm();
    }
  });
  window.addEventListener("resize", recalcLayoutSoon);
  window.addEventListener("orientationchange", () => {
    resetMobileHeightLock();
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
