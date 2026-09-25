/* GAME 2: HỨNG LUA + GAME 3: FLAPPY */
(() => {
  'use strict';

  const C = window.CONST;
  const State = window.State;
  const dom = window.dom;
  const ctx = window.ctx;
  const Best = window.Best;
  const STORAGE = window.STORAGE;
  const saveNum = window.saveNum;
  const setGameTimeout = window.setGameTimeout;
  const resizeCanvas = window.resizeCanvas;
  const updateScoreUI = window.updateScoreUI;
  const updateLivesUI = window.updateLivesUI;
  const showGameOver = window.showGameOver;

  // ========== HERO SPRITE ==========
  const HERO_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
      <style>
        .skin-dark { fill: #160b1f; }
        .skin-purple { fill: #5c2e7a; }
        .eye-white { fill: #f4eef8; }
        .eye-pink { fill: #d633b3; }
        .eye-dark { fill: #8c1a7a; }
      </style>
      <path class="skin-dark" d="M12,8 h12 v2 h-12z M10,10 h16 v2 h-16z M8,12 h18 v8 h-18z M10,20 h16 v2 h-16z M12,22 h12 v2 h-12z"/>
      <path class="skin-purple" d="M14,10 h8 v2 h-8z M12,12 h12 v6 h-12z M14,18 h8 v2 h-8z"/>
      <path class="skin-dark" d="M22,4 h4 v4 h-4z M24,8 h4 v4 h-4z"/>
      <path class="skin-purple" d="M24,6 h2 v4 h-2z M26,8 h2 v4 h-2z"/>
      <path class="skin-dark" d="M16,4 h4 v4 h-4z M18,8 h4 v4 h-4z"/>
      <path class="skin-purple" d="M18,6 h2 v4 h-2z M20,8 h2 v4 h-2z"/>
      <path class="eye-white" d="M18,14 h6 v4 h-6z"/>
      <path class="eye-pink" d="M20,15 h3 v2 h-3z"/>
      <path class="eye-dark" d="M20,16 h3 v1 h-3z"/>
      <path class="eye-white" d="M22,15 h1 v1 h-1z"/>
    </svg>
  `;
  const HERO_SVG_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(HERO_SVG);
  const heroImg = new Image();
  let heroReady = false;
  heroImg.onload = () => { heroReady = true; };
  heroImg.src = HERO_SVG_URL;

  // ========== BUFFS ==========
  const BUFFS = {
    X2:     { color: '#ffcf33', label: 'x2 ĐIỂM',   duration: 8000 },
    X5:     { color: '#ff8c1a', label: 'x5 ĐIỂM',   duration: 6000 },
    SPEED:  { color: '#3fa9ff', label: 'TỐC ĐỘ+',   duration: 8000 },
    WIDTH:  { color: '#66ff8c', label: 'GIỎ RỘNG',  duration: 10000 },
    LIFE:   { color: '#ff3b3b', label: '+1 MẠNG',   duration: 0 },
    VOID:   { color: '#b866ff', label: 'ĐÓNG VOID', duration: 6000 },
    SLOWMO: { color: '#5ce1e6', label: 'SLOW-MO',   duration: 6000 },
    SHIELD: { color: '#dddddd', label: 'KHIÊN',     duration: 10000 },
    MAGNET: { color: '#c98b4b', label: 'NAM CHÂM',  duration: 7000 },
    DSPAWN: { color: '#e05cff', label: 'x2 SPAWN',  duration: 8000 },
  };
  const BUFF_KEYS = Object.keys(BUFFS);
  const BUFF_SPEED_MULT = 1.8;
  const BUFF_WIDTH_MULT = 1.8;
  const BUG_UNLOCK = { ZIGZAG: 15, FREEZE: 20, ERRATIC: 30, SLOW: 40, BIG: 50, DRAIN: 70, BOMB: 100 };

  // =========================================================
  // GAME 2: CATCH
  // =========================================================

  function getBasketWidth() { return C.BASKET_WIDTH_BASE * State.basketWidthMult; }

  function initCatchGame() {
    dom.canvas.style.display = 'block';
    dom.catchControls.style.display = 'flex';
    dom.buffBar.style.display = 'flex';
    resizeCanvas();

    State.basket.x = (dom.canvas._logicalW - getBasketWidth()) / 2;
    State.basket.dir = 0;
    State.catchItems = [];
    State.lives = C.MAX_LIVES;
    State.lastSpawn = performance.now();
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
    dom.buffBar.innerHTML = '';

    updateLivesUI();
    dom.statusText.innerText = `BEST: ${Best.catchScore}`;
    runCatchGame();
  }

  function moveBasket(dir) {
    if (performance.now() < State.frozenUntil) return;
    State.basket.dir = dir * C.BASKET_SPEED * State.basketSpeedMult;
  }

  function applyBuff(type) {
    const def = BUFFS[type];
    if (!def) return;
    const now = performance.now();

    if (type === 'LIFE') { State.lives++; updateLivesUI(); return; }
    if (type === 'SHIELD') { State.shieldCharges += 1; return; }

    State.activeBuffs[type] = now + def.duration;

    if (type === 'X2') State.scoreMultiplier = 2;
    if (type === 'X5') State.scoreMultiplier = 5;
    if (type === 'SPEED') State.basketSpeedMult = BUFF_SPEED_MULT;
    if (type === 'WIDTH') {
      const oldW = getBasketWidth();
      State.basketWidthMult = BUFF_WIDTH_MULT;
      State.basket.x += (oldW - getBasketWidth()) / 2;
    }
    if (type === 'VOID') State.voidActive = true;
    if (type === 'SLOWMO') State.slowMoActive = true;
    if (type === 'MAGNET') State.magnetActive = true;
    if (type === 'DSPAWN') State.doubleSpawnActive = true;
  }

  function expireBuffs(now) {
    Object.keys(State.activeBuffs).forEach((type) => {
      if (State.activeBuffs[type] <= now) {
        delete State.activeBuffs[type];
        if (type === 'X2' || type === 'X5') State.scoreMultiplier = 1;
        if (type === 'SPEED') State.basketSpeedMult = 1;
        if (type === 'WIDTH') {
          const oldW = getBasketWidth();
          State.basketWidthMult = 1;
          State.basket.x += (oldW - getBasketWidth()) / 2;
        }
        if (type === 'VOID') State.voidActive = false;
        if (type === 'SLOWMO') State.slowMoActive = false;
        if (type === 'MAGNET') State.magnetActive = false;
        if (type === 'DSPAWN') State.doubleSpawnActive = false;
      }
    });
  }

  function renderBuffBar(now) {
    dom.buffBar.innerHTML = '';
    Object.keys(State.activeBuffs).forEach((type) => {
      const expire = State.activeBuffs[type];
      if (expire <= now) return;
      const def = BUFFS[type];
      if (!def) return;
      const seconds = Math.ceil((expire - now) / 1000);
      const chip = document.createElement('span');
      chip.className = 'buff-chip';
      chip.style.color = def.color;
      chip.textContent = `${def.label} ${seconds}s`;
      dom.buffBar.appendChild(chip);
    });
    if (State.shieldCharges > 0) {
      const chip = document.createElement('span');
      chip.className = 'buff-chip';
      chip.style.color = '#dddddd';
      chip.textContent = `KHIÊN x${State.shieldCharges}`;
      dom.buffBar.appendChild(chip);
    }
    if (now < State.frozenUntil) {
      const chip = document.createElement('span');
      chip.className = 'buff-chip';
      chip.style.color = '#5ce1e6';
      chip.textContent = `BĂNG ${Math.ceil((State.frozenUntil - now) / 1000)}s`;
      dom.buffBar.appendChild(chip);
    }
    if (now < State.slowDebuffUntil) {
      const chip = document.createElement('span');
      chip.className = 'buff-chip';
      chip.style.color = '#ff7a3c';
      chip.textContent = `CHẬM ${Math.ceil((State.slowDebuffUntil - now) / 1000)}s`;
      dom.buffBar.appendChild(chip);
    }
  }

  function pickBugType() {
    const pool = ['NORMAL'];
    if (State.score >= BUG_UNLOCK.ZIGZAG) pool.push('ZIGZAG');
    if (State.score >= BUG_UNLOCK.FREEZE) pool.push('FREEZE');
    if (State.score >= BUG_UNLOCK.ERRATIC) pool.push('ERRATIC');
    if (State.score >= BUG_UNLOCK.SLOW) pool.push('SLOW');
    if (State.score >= BUG_UNLOCK.BIG) pool.push('BIG');
    if (State.score >= BUG_UNLOCK.DRAIN) pool.push('DRAIN');
    if (State.score >= BUG_UNLOCK.BOMB) pool.push('BOMB');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function createItem(W) {
    const isBug = Math.random() < C.CATCH_BUG_RATE;

    if (!isBug) {
      const isBuff = Math.random() < C.BUFF_DROP_RATE;
      if (isBuff) {
        const buffType = BUFF_KEYS[Math.floor(Math.random() * BUFF_KEYS.length)];
        return {
          x: Math.random() * (W - 30) + 10, y: 0,
          type: 'BUFF', buffType,
          speed: Math.random() * C.CATCH_SPEED_VAR + C.CATCH_BASE_SPEED,
          size: 12,
        };
      }
      return {
        x: Math.random() * (W - 30) + 10, y: 0,
        type: 'LUA',
        speed: Math.random() * C.CATCH_SPEED_VAR + C.CATCH_BASE_SPEED,
        size: 12,
      };
    }

    const bugType = pickBugType();
    const item = {
      x: Math.random() * (W - 30) + 10, y: 0,
      type: 'BUG', bugType,
      speed: Math.random() * C.CATCH_SPEED_VAR + C.CATCH_BASE_SPEED,
      size: 12,
    };
    if (bugType === 'ZIGZAG') { item.zigDir = Math.random() < 0.5 ? -1 : 1; item.zigTimer = 0; }
    if (bugType === 'ERRATIC') { item.vx = (Math.random() - 0.5) * 2.5; item.changeTimer = 0; }
    if (bugType === 'BIG') { item.size = 22; item.speed *= 1.3; }
    return item;
  }

  function drawItem(item, now) {
    if (item.type === 'LUA') {
      ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = '#00ff66';
      ctx.fillStyle = '#00ff66';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('Lua', item.x, item.y);
      ctx.restore();
    } else if (item.type === 'BUFF') {
      const def = BUFFS[item.buffType];
      const pulse = 0.7 + 0.3 * Math.sin(now / 150);
      ctx.save(); ctx.shadowBlur = 14 * pulse; ctx.shadowColor = def.color;
      ctx.fillStyle = def.color;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('Lua', item.x, item.y);
      ctx.fillText('★', item.x + 22, item.y - 4);
      ctx.restore();
    } else if (item.type === 'BUG') {
      const bugStyle = {
        NORMAL: { color: '#ff2a2a', size: 12 },
        ZIGZAG: { color: '#ff2a2a', size: 13 },
        ERRATIC: { color: '#ff5c5c', size: 13 },
        BIG: { color: '#ff0044', size: 22 },
        FREEZE: { color: '#5ce1e6', size: 13 },
        SLOW: { color: '#ff7a3c', size: 13 },
        DRAIN: { color: '#c98bff', size: 13 },
        BOMB: { color: '#ffffff', size: 14 },
      };
      const style = bugStyle[item.bugType] || bugStyle.NORMAL;
      ctx.save();
      ctx.shadowBlur = item.bugType === 'BOMB' ? 12 : 0;
      ctx.shadowColor = style.color;
      ctx.fillStyle = style.color;
      ctx.font = `${style.size}px "JetBrains Mono", monospace`;
      ctx.fillText('👾', item.x, item.y);
      ctx.restore();
    }
  }

  function handleBugHit(bugType) {
    const now = performance.now();
    if (State.shieldCharges > 0) { State.shieldCharges -= 1; return; }
    switch (bugType) {
      case 'FREEZE':
        State.frozenUntil = now + 1500;
        State.basket.dir = 0;
        break;
      case 'SLOW':
        State.slowDebuffUntil = now + 5000;
        State.basketSpeedMult = 0.6;
        break;
      case 'DRAIN':
        State.score = Math.max(0, State.score - 15);
        updateScoreUI();
        break;
      case 'BOMB':
        State.lives--;
        State.activeBuffs = {};
        State.scoreMultiplier = 1;
        State.basketSpeedMult = 1;
        State.basketWidthMult = 1;
        State.voidActive = false;
        State.slowMoActive = false;
        State.magnetActive = false;
        State.doubleSpawnActive = false;
        State.shieldCharges = 0;
        break;
      default:
        State.lives--;
    }
  }

  function runCatchGame() {
    if (State.currentGame !== 2) return;
    const W = dom.canvas._logicalW;
    const H = dom.canvas._logicalH;
    const now = performance.now();

    expireBuffs(now);
    renderBuffBar(now);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (State.slowMoActive) {
      ctx.fillStyle = 'rgba(92,225,230,0.05)';
      ctx.fillRect(0, 0, W, H);
    }
    if (now < State.frozenUntil) {
      ctx.fillStyle = 'rgba(92,225,230,0.10)';
      ctx.fillRect(0, 0, W, H);
    }

    if (State.voidActive) {
      const grad = ctx.createLinearGradient(0, H - 24, 0, H);
      grad.addColorStop(0, 'rgba(184,102,255,0)');
      grad.addColorStop(1, 'rgba(184,102,255,0.65)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H - 24, W, 24);
      ctx.strokeStyle = '#b866ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#b866ff';
      ctx.beginPath();
      ctx.moveTo(0, H - 2);
      ctx.lineTo(W, H - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    State.basket.x += State.basket.dir;
    const bw = getBasketWidth();
    if (State.basket.x < 0) State.basket.x = 0;
    if (State.basket.x > W - bw) State.basket.x = W - bw;

    if (State.shieldCharges > 0) {
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#dddddd';
      ctx.strokeStyle = 'rgba(220,220,220,0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(State.basket.x - 3, H - C.BASKET_BOTTOM_OFFSET - 6, bw + 6, C.BASKET_HEIGHT + 10);
      ctx.restore();
    }

    ctx.fillStyle = (State.basketWidthMult > 1) ? '#66ff8c' : '#ff2a2a';
    ctx.shadowBlur = (State.basketWidthMult > 1) ? 8 : 0;
    ctx.shadowColor = '#66ff8c';
    ctx.fillRect(State.basket.x, H - C.BASKET_BOTTOM_OFFSET, bw, C.BASKET_HEIGHT);
    ctx.shadowBlur = 0;

    const spawnInterval = State.doubleSpawnActive ? C.CATCH_SPAWN_MS / 2 : C.CATCH_SPAWN_MS;
    if (now - State.lastSpawn > spawnInterval) {
      State.catchItems.push(createItem(W));
      State.lastSpawn = now;
    }

    const slowMoMult = State.slowMoActive ? 0.45 : 1;
    const basketCenter = State.basket.x + bw / 2;

    for (let i = State.catchItems.length - 1; i >= 0; i--) {
      const item = State.catchItems[i];

      if (State.magnetActive && (item.type === 'LUA' || item.type === 'BUFF')) {
        item.x += (basketCenter - (item.x + 6)) * 0.04;
      }

      item.y += item.speed * slowMoMult;

      if (item.type === 'BUG') {
        if (item.bugType === 'ZIGZAG') {
          item.zigTimer += 1;
          if (item.zigTimer % 20 === 0) item.zigDir *= -1;
          item.x += item.zigDir * 1.8;
          if (item.x < 0) { item.x = 0; item.zigDir = 1; }
          if (item.x > W - 14) { item.x = W - 14; item.zigDir = -1; }
        } else if (item.bugType === 'ERRATIC') {
          item.changeTimer += 1;
          if (item.changeTimer % 15 === 0) item.vx = (Math.random() - 0.5) * 3.5;
          item.x += item.vx;
          if (item.x < 0) { item.x = 0; item.vx = Math.abs(item.vx); }
          if (item.x > W - 18) { item.x = W - 18; item.vx = -Math.abs(item.vx); }
        }
      }

      drawItem(item, now);

      const hb = item.size || 12;
      const caught =
        item.y >= H - C.BASKET_BOTTOM_OFFSET - 6 &&
        item.y <= H - C.BASKET_BOTTOM_OFFSET + C.BASKET_HEIGHT + 6 &&
        item.x + hb / 2 >= State.basket.x &&
        item.x - hb / 2 <= State.basket.x + bw;

      if (caught) {
        if (item.type === 'LUA') {
          State.score += 5 * State.scoreMultiplier;
          if (State.score > Best.catchScore) {
            Best.catchScore = State.score;
            saveNum(STORAGE.CATCH_BEST, Best.catchScore);
          }
        } else if (item.type === 'BUFF') {
          applyBuff(item.buffType);
        } else if (item.type === 'BUG') {
          handleBugHit(item.bugType);
          if (State.lives <= 0) {
            showGameOver('HẾT MẠNG TỒ̀I!', `SCORE: ${State.score} | BEST: ${Best.catchScore}`);
            return;
          }
        }
        State.catchItems.splice(i, 1);
        updateLivesUI();
        updateScoreUI();
        dom.statusText.innerText = `BEST: ${Best.catchScore}`;
        continue;
      }

      if (item.y > H) {
        if (item.type === 'LUA' || item.type === 'BUFF') {
          if (State.voidActive) { item.y = H - 4; item.speed = 0; continue; }
          if (item.type === 'LUA') {
            State.lives--;
            updateLivesUI();
            if (State.lives <= 0) {
              showGameOver('BỎ LỠ LUA!', `SCORE: ${State.score} | BEST: ${Best.catchScore}`);
              return;
            }
          }
        }
        State.catchItems.splice(i, 1);
      }
    }

    State.loopId = requestAnimationFrame(runCatchGame);
  }

  // =========================================================
  // GAME 3: FLAPPY
  // =========================================================

  function initFlappyGame() {
    dom.canvas.style.display = 'block';
    resizeCanvas();

    State.bird.x = 60;
    State.bird.y = 90;
    State.bird.velocity = 0;
    State.pipes = [];
    State.gameStarted = false;
    State.flames = [];
    State.lastFlameAt = 0;
    State.flapPhase = 0;
    State.nextBlinkAt = performance.now() + 1500 + Math.random() * 2500;
    State.blinkUntil = 0;

    dom.statusText.innerText = `BEST: ${Best.flappyScore}`;
    dom.canvas.onclick = handleFlappyInput;
    runFlappyGame();
  }

  function handleFlappyInput() {
    if (State.currentGame !== 3) return;
    if (!State.gameStarted) {
      State.gameStarted = true;
      dom.statusText.innerText = `BEST: ${Best.flappyScore}`;
    }
    State.bird.velocity = C.FLAPPY_FLAP;
  }

  function drawHero(cx, cy, rotation) {
    const now = performance.now();
    if (now >= State.nextBlinkAt && now >= State.blinkUntil) {
      State.blinkUntil = now + 120;
      State.nextBlinkAt = now + 1500 + Math.random() * 2500;
    }
    const isBlinking = now < State.blinkUntil;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    const half = C.HERO_SIZE / 2;
    if (heroReady) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(heroImg, -half, -half, C.HERO_SIZE, C.HERO_SIZE);
      if (isBlinking) {
        ctx.fillStyle = '#5c2e7a';
        ctx.fillRect(-half + 18, -half + 14, 6, 4);
      }
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#160b1f';
      ctx.fillRect(-half + 10, -half + 8, 12, 2);
      ctx.fillRect(-half + 8, -half + 10, 16, 2);
      ctx.fillRect(-half + 6, -half + 12, 18, 8);
      ctx.fillRect(-half + 8, -half + 20, 16, 2);
      ctx.fillRect(-half + 10, -half + 22, 12, 2);
      ctx.fillStyle = '#5c2e7a';
      ctx.fillRect(-half + 12, -half + 10, 8, 2);
      ctx.fillRect(-half + 10, -half + 12, 12, 6);
      ctx.fillRect(-half + 12, -half + 18, 8, 2);
      ctx.fillStyle = isBlinking ? '#5c2e7a' : '#d633b3';
      ctx.fillRect(-half + 18, -half + 14, 6, 4);
      if (!isBlinking) {
        ctx.fillStyle = '#f4eef8';
        ctx.fillRect(-half + 22, -half + 15, 1, 1);
      }
    }
    ctx.restore();
  }

  function spawnTrailFlame(velocity) {
    const intensity = Math.min(1, Math.abs(velocity) / 6);
    const rot = Math.max(-0.45, Math.min(0.7, velocity * 0.12));
    const localX = -C.HERO_SIZE / 2 + 1 + (Math.random() - 0.5) * 2;
    const localY = (Math.random() - 0.5) * (C.HERO_SIZE * 0.55);
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const wx = localX * cosR - localY * sinR;
    const wy = localX * sinR + localY * cosR;
    const baseSize = 3 + intensity * 5 + Math.random() * 1.5;
    const vx = -(0.8 + intensity * 2.2) - Math.random() * 0.8;
    const vy = -velocity * 0.15 + (Math.random() - 0.5) * 0.7;
    State.flames.push({
      x: State.bird.x + wx,
      y: State.bird.y + wy,
      vx, vy, life: 1,
      decay: 0.045 + (1 - intensity) * 0.04,
      size: baseSize,
      bright: 0.75 + Math.random() * 0.25,
    });
  }

  function updateFlames() {
    for (let i = State.flames.length - 1; i >= 0; i--) {
      const f = State.flames[i];
      f.x += f.vx;
      f.y += f.vy;
      f.vx *= 0.96;
      f.vy *= 0.96;
      f.life -= f.decay;
      f.size *= 0.965;
      if (f.life <= 0 || f.size < 0.5) State.flames.splice(i, 1);
    }
  }

  function drawFlames() {
    State.flames.forEach((f) => {
      const a = Math.max(0, f.life) * f.bright;
      const s = f.size;
      ctx.fillStyle = `rgba(43,122,158,${a * 0.65})`;
      ctx.fillRect(f.x - s / 2, f.y - s / 2, s, s);
      ctx.fillStyle = `rgba(74,163,199,${a * 0.8})`;
      const s2 = s * 0.75;
      ctx.fillRect(f.x - s2 / 2, f.y - s2 / 2, s2, s2);
      ctx.fillStyle = `rgba(133,212,240,${a * 0.9})`;
      const s3 = s * 0.5;
      ctx.fillRect(f.x - s3 / 2, f.y - s3 / 2, s3, s3);
      ctx.fillStyle = `rgba(189,240,255,${a})`;
      const s4 = s * 0.28;
      ctx.fillRect(f.x - s4 / 2, f.y - s4 / 2, s4, s4);
      if (f.life > 0.5) {
        ctx.fillStyle = `rgba(224,250,255,${a * (f.life - 0.5) * 2})`;
        const s5 = s * 0.14;
        ctx.fillRect(f.x - s5 / 2, f.y - s5 / 2, s5, s5);
      }
    });
  }

  function runFlappyGame() {
    if (State.currentGame !== 3) return;
    const W = dom.canvas._logicalW;
    const H = dom.canvas._logicalH;
    const now = performance.now();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (State.gameStarted) {
      State.bird.velocity += C.FLAPPY_GRAVITY;
      State.bird.y += State.bird.velocity;
      State.flapPhase += 0.22;
    } else {
      State.flapPhase += 0.10;
      ctx.fillStyle = '#aaa';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('BẤM ĐỂ BAY', W / 2 - 40, H - 60);
    }

    if (State.pipes.length === 0 ||
        State.pipes[State.pipes.length - 1].x < W - C.FLAPPY_PIPE_SPACING) {
      const topH = Math.random() * 80 + 20;
      State.pipes.push({ x: W, top: topH, gap: C.FLAPPY_PIPE_GAP, passed: false });
    }

    for (let i = State.pipes.length - 1; i >= 0; i--) {
      const p = State.pipes[i];
      if (State.gameStarted) p.x -= C.FLAPPY_PIPE_SPEED;

      ctx.fillStyle = '#111';
      ctx.strokeStyle = '#ff2a2a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(p.x, 0, C.FLAPPY_PIPE_W, p.top);
      ctx.strokeRect(p.x, 0, C.FLAPPY_PIPE_W, p.top);
      ctx.fillRect(p.x, p.top + p.gap, C.FLAPPY_PIPE_W, H - (p.top + p.gap));
      ctx.strokeRect(p.x, p.top + p.gap, C.FLAPPY_PIPE_W, H - (p.top + p.gap));

      const br = State.bird.x + C.HERO_HITBOX / 2;
      const bl = State.bird.x - C.HERO_HITBOX / 2;
      const bt = State.bird.y - C.HERO_HITBOX / 2;
      const bb = State.bird.y + C.HERO_HITBOX / 2;
      if (br > p.x && bl < p.x + C.FLAPPY_PIPE_W) {
        if (bt < p.top || bb > p.top + p.gap) {
          showGameOver('TOANG RỒ̀I!',
            `Đụng tường rồi cha nội! Điểm: ${State.score} | BEST: ${Best.flappyScore}`);
          return;
        }
      }
      if (p.x + C.FLAPPY_PIPE_W < bl && !p.passed) {
        p.passed = true;
        State.score += 1;
        updateScoreUI();
        if (State.score > Best.flappyScore) {
          Best.flappyScore = State.score;
          saveNum(STORAGE.FLAPPY_BEST, Best.flappyScore);
        }
      }
      if (p.x < -C.FLAPPY_PIPE_W - 10) State.pipes.splice(i, 1);
    }

    if (State.gameStarted) {
      const speed = Math.abs(State.bird.velocity);
      const spawnsPerFrame = 1 + Math.floor(Math.min(2, speed / 2.5));
      const interval = Math.max(8, 22 - speed * 2);
      if (now - State.lastFlameAt > interval) {
        for (let k = 0; k < spawnsPerFrame; k++) {
          spawnTrailFlame(State.bird.velocity);
        }
        State.lastFlameAt = now;
      }
    }
    updateFlames();

    const bobY = Math.sin(State.flapPhase) * 1.5;
    const rot = Math.max(-0.45, Math.min(0.7, State.bird.velocity * 0.12));

    drawFlames();
    drawHero(State.bird.x, State.bird.y + bobY, rot);

    if (State.bird.y > H || State.bird.y < 0) {
      showGameOver('RƠI TỰ DO!',
        `Bay kiểu gì cắm đầu xuống đất thế? SCORE: ${State.score} | BEST: ${Best.flappyScore}`);
      return;
    }

    dom.statusText.innerText = `BEST: ${Best.flappyScore}`;
    State.loopId = requestAnimationFrame(runFlappyGame);
  }

  // Wire controls
  dom.catchControls.querySelectorAll('.ctrl-btn').forEach((btn) => {
    const dir = btn.dataset.dir === 'left' ? -1 : 1;
    const start = (e) => { e.preventDefault(); moveBasket(dir); };
    const stop = (e) => { e.preventDefault(); moveBasket(0); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
  });

  window.addEventListener('keydown', (e) => {
    if (State.currentGame === 2) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveBasket(-1);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') moveBasket(1);
    }
    if (State.currentGame === 3 && e.code === 'Space') {
      e.preventDefault();
      handleFlappyInput();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (State.currentGame === 2) {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) moveBasket(0);
    }
  });

  // Export
  window.CatchGame = {
    initCatchGame,
    initFlappyGame,
  };
})();