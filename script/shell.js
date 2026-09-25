/* GAME 1: TRÁO CỐC */
(() => {
  'use strict';

  const C = window.CONST;
  const State = window.State;
  const dom = window.dom;
  const Best = window.Best;
  const STORAGE = window.STORAGE;
  const saveNum = window.saveNum;
  const setGameTimeout = window.setGameTimeout;
  const updateScoreUI = window.updateScoreUI;
  const showGameOver = window.showGameOver;

  function updateSlotPositions() {
    const stageWidth = dom.game1UI.clientWidth || 360;
    const space = (stageWidth - C.CUP_WIDTH * C.CUP_COUNT) / (C.CUP_COUNT + 1);
    State.slotPos = [
      space,
      space * 2 + C.CUP_WIDTH,
      space * 3 + C.CUP_WIDTH * 2,
    ];
    dom.slots.forEach((slot, i) => { slot.style.left = State.slotPos[i] + 'px'; });
  }

  function paintCups() {
    dom.cups.forEach((cup, cupId) => {
      cup.style.left = State.slotPos[State.cupPos[cupId]] + 'px';
    });
  }

  function paintPrizes() {
    const coinSlot = State.cupPos[State.targetCupId];
    dom.prizes.forEach((prize, slotIndex) => {
      const isCoin = slotIndex === coinSlot;
      prize.classList.toggle('coin', isCoin);
      prize.classList.toggle('cross', !isCoin);
      prize.textContent = isCoin ? 'R$' : '✕';
    });
  }

  function runShellGame() {
    dom.game1UI.style.display = 'block';
    dom.game1UI.classList.remove('shuffling');
    updateSlotPositions();

    State.cupPos = [0, 1, 2];
    State.targetCupId = Math.floor(Math.random() * C.CUP_COUNT);

    paintCups();
    paintPrizes();

    dom.cups.forEach((cup) => cup.classList.add('open'));
    dom.prizes[State.cupPos[State.targetCupId]].classList.add('show');
    dom.statusText.innerText = `STREAK: ${State.streak}  |  BEST: ${State.bestStreakThisRun}`;

    setGameTimeout(() => {
      dom.cups.forEach((cup) => cup.classList.remove('open'));
      dom.prizes.forEach((p) => p.classList.remove('show'));
      setGameTimeout(shuffleCups, 500);
    }, C.REVEAL_MS);
  }

  function shuffleCups() {
    State.isShuffling = true;
    dom.game1UI.classList.add('shuffling');
    dom.statusText.innerText = 'ĐANG XÁO CỐC...';

    let swaps = 0;
    let speed = C.SHELL_SPEED_START;

    function doSwap() {
      if (State.currentGame !== 1) return;
      if (swaps >= C.SHELL_SWAPS) {
        State.isShuffling = false;
        State.canSelectCup = true;
        dom.game1UI.classList.remove('shuffling');
        dom.statusText.innerText = `STREAK: ${State.streak}  |  BEST: ${State.bestStreakThisRun}`;
        return;
      }

      let i = Math.floor(Math.random() * C.CUP_COUNT);
      let j = (i + 1 + Math.floor(Math.random() * (C.CUP_COUNT - 1))) % C.CUP_COUNT;

      [State.cupPos[i], State.cupPos[j]] = [State.cupPos[j], State.cupPos[i]];
      paintCups();

      swaps++;
      speed = Math.max(C.SHELL_SPEED_MIN, speed - C.SHELL_SPEED_STEP);
      setGameTimeout(doSwap, speed);
    }
    doSwap();
  }

  function selectCup(cupId) {
    if (!State.canSelectCup || State.isShuffling) return;
    State.canSelectCup = false;

    const cup = dom.cups[cupId];
    const slot = State.cupPos[cupId];
    const prize = dom.prizes[slot];

    cup.classList.add('open');

    const isWin = cupId === State.targetCupId;
    prize.classList.toggle('coin', isWin);
    prize.classList.toggle('cross', !isWin);
    prize.textContent = isWin ? 'R$' : '✕';
    prize.classList.add('show');

    if (isWin) {
      State.streak += 1;
      State.bestStreakThisRun = Math.max(State.bestStreakThisRun, State.streak);

      const gained = 10 + (State.streak - 1) * 2;
      State.score += gained;
      updateScoreUI();

      if (State.score > Best.shellScore) {
        Best.shellScore = State.score;
        saveNum(STORAGE.SHELL_BEST, Best.shellScore);
      }
      if (State.streak > Best.shellStreak) {
        Best.shellStreak = State.streak;
        saveNum(STORAGE.SHELL_BEST_STREAK, Best.shellStreak);
      }

      dom.statusText.innerText = `STREAK: ${State.streak}  |  BEST: ${State.bestStreakThisRun}`;

      setGameTimeout(() => {
        if (State.currentGame !== 1) return;
        dom.cups.forEach((c) => c.classList.remove('open'));
        dom.prizes.forEach((p) => p.classList.remove('show'));
        setGameTimeout(runShellGame, 500);
      }, 900);
    } else {
      const lostStreak = State.streak;
      State.streak = 0;
      dom.statusText.innerText = 'SAI RỒI!';

      setGameTimeout(() => {
        const targetSlot = State.cupPos[State.targetCupId];
        dom.cups[State.targetCupId].classList.add('open');
        const targetPrize = dom.prizes[targetSlot];
        targetPrize.classList.remove('cross');
        targetPrize.classList.add('coin', 'show');
        targetPrize.textContent = 'R$';

        setGameTimeout(() => {
          const msgs = [
            'Mắt để dưới gót chân à bro? 🐸',
            'Tráo có xíu đã quíu tay rồi, gà vãi!',
            'Tay nhanh hơn não rồi bạn ơi!',
            'Thua cả máy, chơi lại gỡ gạc không?',
          ];
          const msg = msgs[Math.floor(Math.random() * msgs.length)];
          showGameOver('GÀ VÃI LỒ̀NG!',
            `${msg}\nSCORE: ${State.score} | STREAK LOST: ${lostStreak}\n` +
            `BEST SCORE: ${Best.shellScore} | BEST STREAK: ${Best.shellStreak}`);
        }, 1200);
      }, 800);
    }
  }

  // Wire cups
  dom.cups.forEach((cup) => {
    cup.addEventListener('click', () => selectCup(Number(cup.dataset.cupId)));
  });

  // Export
  window.Shell = {
    updateSlotPositions,
    paintCups,
    runShellGame,
    selectCup,
  };
})();