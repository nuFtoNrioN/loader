/* NOIRHUB — Core: constants, State, Best, timers, UI helpers, TV transition, switchGame */
(() => {
  'use strict';

  // ========== CONSTANTS ==========
  const CONST = {
    CUP_COUNT: 3,
    CUP_WIDTH: 54,
    SHELL_SWAPS: 18,
    SHELL_SPEED_START: 240,
    SHELL_SPEED_MIN: 80,
    SHELL_SPEED_STEP: 10,
    REVEAL_MS: 1500,

    CATCH_SPAWN_MS: 800,
    CATCH_BUG_RATE: 0.3,
    CATCH_BASE_SPEED: 1.8,
    CATCH_SPEED_VAR: 1.0,
    BASKET_SPEED: 5,
    BASKET_WIDTH_BASE: 44,
    BASKET_HEIGHT: 10,
    BASKET_BOTTOM_OFFSET: 15,
    MAX_LIVES: 3,
    BUFF_DROP_RATE: 0.10,

    FLAPPY_GRAVITY: 0.20,
    FLAPPY_FLAP: -3.7,
    FLAPPY_PIPE_W: 26,
    FLAPPY_PIPE_GAP: 65,
    FLAPPY_PIPE_SPACING: 130,
    FLAPPY_PIPE_SPEED: 2,
    HERO_SIZE: 32,
    HERO_HITBOX: 20,

    TV_TRANSITION_MS: 350,
  };

  // ========== STORAGE ==========
  const STORAGE = {
    SHELL_BEST: 'noirhub.shell.best',
    SHELL_BEST_STREAK: 'noirhub.shell.bestStreak',
    CATCH_BEST: 'noirhub.catch.best',
    FLAPPY_BEST: 'noirhub.flappy.best',
  };
  function loadNum(key) {
    const v = parseInt(localStorage.getItem(key) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveNum(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) {}
  }

  const Best = {
    shellScore: loadNum(STORAGE.SHELL_BEST),
    shellStreak: loadNum(STORAGE.SHELL_BEST_STREAK),
    catchScore: loadNum(STORAGE.CATCH_BEST),
    flappyScore: loadNum(STORAGE.FLAPPY_BEST),
  };

  // ========== DOM ==========
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const dom = {
    canvas: $('#gameCanvas'),
    overlay: $('#overlay'),
    overlayTitle: $('#overlay-title'),
    overlayMsg: $('#overlay-msg'),
    startBtn: $('#start-btn'),
    statusText: $('#status-text'),
    extraInfo: $('#extra-info'),
    scoreEl: $('#score'),
    game1UI: $('#game1-ui'),
    catchControls: $('#catch-controls'),
    buffBar: $('#buff-bar'),
    cups: Array.from($$('#game1-ui .cup')),
    slots: Array.from($$('#game1-ui .slot')),
    prizes: Array.from($$('#game1-ui .prize')),
    tvStatic: $('#tv-static'),
    menuBtns: Array.from($$('.menu-btn')),
  };
  const ctx = dom.canvas.getContext('2d');

  // ========== STATE ==========
  const State = {
    currentGame: 0,
    score: 0,
    loopId: null,
    timers: new Set(),
    isTransitioning: false,

    // shell
    cupPos: [0, 1, 2],
    slotPos: [0, 0, 0],
    targetCupId: -1,
    isShuffling: false,
    canSelectCup: false,
    streak: 0,
    bestStreakThisRun: 0,

    // catch
    basket: { x: 170, dir: 0 },
    catchItems: [],
    lives: 3,
    lastSpawn: 0,
    activeBuffs: {},
    scoreMultiplier: 1,
    basketSpeedMult: 1,
    basketWidthMult: 1,
    voidActive: false,
    slowMoActive: false,
    magnetActive: false,
    doubleSpawnActive: false,
    shieldCharges: 0,
    frozenUntil: 0,
    slowDebuffUntil: 0,

    // flappy
    bird: { x: 60, y: 90, velocity: 0 },
    pipes: [],
    gameStarted: false,
    flames: [],
    lastFlameAt: 0,
    flapPhase: 0,
    nextBlinkAt: 0,
    blinkUntil: 0,
  };

  // ========== TIMERS ==========
  function setGameTimeout(fn, ms) {
    const id = setTimeout(() => { State.timers.delete(id); fn(); }, ms);
    State.timers.add(id); return id;
  }
  function setGameInterval(fn, ms) {
    const id = setInterval(fn, ms);
    State.timers.add(id); return id;
  }
  function clearAllTimers() {
    State.timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    State.timers.clear();
  }

  // ========== CANVAS ==========
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = dom.canvas.getBoundingClientRect();
    const w = rect.width || 380, h = rect.height || 200;
    dom.canvas.width = Math.round(w * dpr);
    dom.canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dom.canvas._logicalW = w;
    dom.canvas._logicalH = h;
  }
  window.addEventListener('resize', () => {
    if (State.currentGame === 2 || State.currentGame === 3) resizeCanvas();
    if (State.currentGame === 1 && window.Shell) {
      window.Shell.updateSlotPositions();
      window.Shell.paintCups();
    }
  });

  // ========== UI ==========
  function updateScoreUI() { dom.scoreEl.innerText = State.score; }

  function updateLivesUI() {
    const lives = Math.max(0, State.lives);
    dom.extraInfo.innerHTML =
      `MẠNG: <b style="color:#ff2a2a">${'❤️'.repeat(lives)}</b> | ` +
      `SCORE: <b style="color:#fff">${State.score}</b>`;
  }

  function showGameOver(title, msg) {
    cancelAnimationFrame(State.loopId);
    State.loopId = null;
    dom.overlayTitle.innerText = title;
    dom.overlayMsg.innerText = msg;
    dom.startBtn.style.display = 'block';
    dom.startBtn.innerText = '[ CHƠI LẠI ]';
    dom.overlay.style.display = 'flex';
    dom.buffBar.style.display = 'none';
    dom.buffBar.innerHTML = '';
  }

  // ========== TV TRANSITION ==========
  function playTVTransition(onMidpoint) {
    if (State.isTransitioning) return;
    State.isTransitioning = true;

    dom.tvStatic.classList.remove('active');
    void dom.tvStatic.offsetWidth;
    dom.tvStatic.classList.add('active');

    setTimeout(() => {
      if (typeof onMidpoint === 'function') onMidpoint();
    }, CONST.TV_TRANSITION_MS * 0.45);

    setTimeout(() => {
      dom.tvStatic.classList.remove('active');
      State.isTransitioning = false;
    }, CONST.TV_TRANSITION_MS + 40);
  }

  // ========== GAME SWITCH ==========
  function destroyCurrentGame() {
    cancelAnimationFrame(State.loopId);
    State.loopId = null;
    clearAllTimers();
    dom.canvas.onclick = null;

    State.basket.dir = 0;
    State.gameStarted = false;
    State.isShuffling = false;
    State.canSelectCup = false;

    dom.game1UI.classList.remove('shuffling');
    dom.cups.forEach((c) => c.classList.remove('open'));
    dom.prizes.forEach((p) => p.classList.remove('show'));

    State.activeBuffs = {};
    State.scoreMultiplier = 1;
    State.basketSpeedMult = 1;
    State.basketWidthMult = 1;
    State.voidActive = false;
    State.slowMoActive = false;
    State.magnetActive = false;
    State.doubleSpawnActive = false;
    State.shieldCharges = 0;
    State.frozenUntil = 0;
    State.slowDebuffUntil = 0;
    State.flames = [];

    dom.buffBar.style.display = 'none';
    dom.buffBar.innerHTML = '';
  }

  function applyGameUI(id) {
    State.currentGame = id;
    State.score = 0;
    State.streak = 0;
    State.bestStreakThisRun = 0;
    updateScoreUI();

    dom.game1UI.style.display = 'none';
    dom.catchControls.style.display = 'none';
    dom.canvas.style.display = 'none';

    dom.overlay.style.display = 'flex';
    dom.startBtn.style.display = 'block';
    dom.startBtn.innerText = '[ BẮT ĐẦU ]';

    if (id === 1) {
      dom.overlayTitle.innerText = 'TRÁO CỐC TÌM R$';
      dom.overlayMsg.innerText =
        `Nhớ vị trí R$. Ăn đúng liên tiếp để tăng STREAK!\n` +
        `BEST: ${Best.shellScore} | STREAK: ${Best.shellStreak}`;
      dom.statusText.innerText = 'STATUS: READY';
      dom.extraInfo.innerHTML = `SCORE: <b id="score" style="color:#fff;">0</b>`;
      // re-bind scoreEl after innerHTML replace
      State._scoreEl = document.getElementById('score');
    } else if (id === 2) {
      dom.overlayTitle.innerText = 'HỨNG LUA SCRIPT';
      dom.overlayMsg.innerText = `Hứng 'LUA' (10% rơi buff!). Né bug.\nBEST: ${Best.catchScore}`;
      dom.statusText.innerText = 'STATUS: READY';
    } else if (id === 3) {
      dom.overlayTitle.innerText = 'FLAPPY 403';
      dom.overlayMsg.innerText =
        `Bấm [ BẮT ĐẦU ] rồi CLICK/TOUCH để điều khiển nhân vật bay!\n` +
        `BEST: ${Best.flappyScore}`;
      dom.statusText.innerText = 'STATUS: READY';
    }
  }

  function updateTabUI(id) {
    dom.menuBtns.forEach((btn) => {
      const btnId = Number(btn.dataset.game);
      const wasActive = btn.classList.contains('active');
      if (btnId === id) {
        btn.classList.add('active');
        btn.classList.remove('just-left');
      } else {
        if (wasActive) {
          btn.classList.remove('active');
          btn.classList.add('just-left');
          setTimeout(() => btn.classList.remove('just-left'), 340);
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  function switchGame(id, skipTransition) {
    if (State.isTransitioning) return;

    const doSwitch = () => {
      destroyCurrentGame();
      applyGameUI(id);
      updateTabUI(id);
    };

    if (skipTransition) { doSwitch(); return; }
    playTVTransition(doSwitch);
  }

  function startCurrentGame() {
    State.score = 0; State.streak = 0; State.bestStreakThisRun = 0;
    updateScoreUI();

    if (State.currentGame === 3) {
      dom.overlay.style.display = 'none';
      if (window.CatchGame) window.CatchGame.initFlappyGame();
      return;
    }

    dom.startBtn.style.display = 'none';
    let count = 3;
    dom.overlayTitle.innerText = String(count);
    dom.overlayMsg.innerText = 'CHUẨN BỊ...';

    const iv = setGameInterval(() => {
      count--;
      if (count > 0) dom.overlayTitle.innerText = String(count);
      else {
        clearInterval(iv);
        State.timers.delete(iv);
        dom.overlay.style.display = 'none';
        if (State.currentGame === 1 && window.Shell) window.Shell.runShellGame();
        if (State.currentGame === 2 && window.CatchGame) window.CatchGame.initCatchGame();
      }
    }, 800);
  }

  // ========== EXPORT ==========
  window.CONST = CONST;
  window.STORAGE = STORAGE;
  window.Best = Best;
  window.State = State;
  window.dom = dom;
  window.ctx = ctx;
  window.loadNum = loadNum;
  window.saveNum = saveNum;
  window.setGameTimeout = setGameTimeout;
  window.setGameInterval = setGameInterval;
  window.clearAllTimers = clearAllTimers;
  window.resizeCanvas = resizeCanvas;
  window.updateScoreUI = updateScoreUI;
  window.updateLivesUI = updateLivesUI;
  window.showGameOver = showGameOver;
  window.playTVTransition = playTVTransition;
  window.destroyCurrentGame = destroyCurrentGame;
  window.applyGameUI = applyGameUI;
  window.updateTabUI = updateTabUI;
  window.switchGame = switchGame;
  window.startCurrentGame = startCurrentGame;

  // ========== WIRE ==========
  dom.menuBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.game);
      if (id === State.currentGame && !State.isTransitioning) return;
      switchGame(id);
    });
  });
  dom.startBtn.addEventListener('click', startCurrentGame);

  // ========== BOOT ==========
  window.addEventListener('DOMContentLoaded', () => {
    const boot = () => switchGame(1, true);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(boot);
    } else {
      boot();
    }
  });
})();