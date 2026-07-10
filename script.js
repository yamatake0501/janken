(() => {
  const ROUND_MS = 500;
  const WIN_SCORE = 10;

  const HAND_NAME = { 1: 'グー', 2: 'チョキ', 3: 'パー' };
  const HAND_EMOJI = { 1: '✊', 2: '✌️', 3: '🖐' };
  const BASE_WEIGHTS = { 1: 0.36, 2: 0.32, 3: 0.32 };

  // screens
  const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
  };

  // game screen elements
  const playerScoreEl = document.getElementById('player-score');
  const cpuScoreEl = document.getElementById('cpu-score');
  const timerBar = document.getElementById('timer-bar');
  const playerHandEl = document.getElementById('player-hand');
  const cpuHandEl = document.getElementById('cpu-hand');
  const resultFlashEl = document.getElementById('result-flash');
  const pendingHandEl = document.getElementById('pending-hand');
  const roundLogEl = document.getElementById('round-log');
  const handButtons = document.querySelectorAll('.hand-btn');

  // result screen elements
  const resultTitleEl = document.getElementById('result-title');
  const finalScoreEl = document.getElementById('final-score');
  const statsSummaryEl = document.getElementById('stats-summary');

  let playerScore = 0;
  let cpuScore = 0;
  let pendingMove = null;
  let history = []; // { player: 1|2|3|null, cpu: 1|2|3, result: 'win'|'lose'|'tie' }
  let intervalId = null;
  let gameOver = false;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function beats(a, b) {
    return (a === 1 && b === 2) || (a === 2 && b === 3) || (a === 3 && b === 1);
  }

  function weightedRandomHand() {
    const r = Math.random();
    if (r < BASE_WEIGHTS[1]) return 1;
    if (r < BASE_WEIGHTS[1] + BASE_WEIGHTS[2]) return 2;
    return 3;
  }

  function pickCpuMove() {
    const last = history[history.length - 1];
    if (last) {
      const r = Math.random();
      if (last.result === 'tie' && r < 0.55) {
        return last.cpu; // クセ: あいこの後は同じ手を出しやすい
      }
      if (last.result === 'lose' && r < 0.45) {
        // プレイヤーが負けた = CPUが勝った → 勝った手を続けやすい
        return last.cpu;
      }
      if (last.result === 'win' && last.player && r < 0.4) {
        // プレイヤーが勝った = CPUが負けた → 直前に負けた手をなぞりやすい
        return last.player;
      }
    }
    return weightedRandomHand();
  }

  function resetGame() {
    playerScore = 0;
    cpuScore = 0;
    pendingMove = null;
    history = [];
    gameOver = false;
    playerScoreEl.textContent = '0';
    cpuScoreEl.textContent = '0';
    roundLogEl.innerHTML = '';
    resultFlashEl.className = 'result-flash';
    pendingHandEl.textContent = '未入力';
    handButtons.forEach((b) => b.classList.remove('selected'));
  }

  function setPendingMove(move) {
    if (gameOver) return;
    pendingMove = move;
    pendingHandEl.textContent = `${HAND_EMOJI[move]} ${HAND_NAME[move]}`;
    handButtons.forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.move) === move);
    });
  }

  function restartTimerBar() {
    timerBar.classList.remove('running');
    void timerBar.offsetWidth; // force reflow to restart animation
    timerBar.classList.add('running');
  }

  function stopTimerBar() {
    timerBar.classList.remove('running');
  }

  function bumpScore(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function flashResult(kind, text) {
    resultFlashEl.className = `result-flash ${kind} show`;
    resultFlashEl.textContent = text;
  }

  function playRound() {
    const cpuMove = pickCpuMove();
    const playerMove = pendingMove;

    playerHandEl.textContent = playerMove ? HAND_EMOJI[playerMove] : '❌';
    cpuHandEl.textContent = HAND_EMOJI[cpuMove];
    playerHandEl.classList.remove('reveal');
    cpuHandEl.classList.remove('reveal');
    void playerHandEl.offsetWidth;
    playerHandEl.classList.add('reveal');
    cpuHandEl.classList.add('reveal');

    let result;
    if (!playerMove) {
      result = 'lose';
      flashResult('lose', '入力なし… 敗北');
    } else if (playerMove === cpuMove) {
      result = 'tie';
      flashResult('tie', 'あいこ');
    } else if (beats(playerMove, cpuMove)) {
      result = 'win';
      flashResult('win', 'WIN!');
    } else {
      result = 'lose';
      flashResult('lose', 'LOSE...');
    }

    if (result === 'win') {
      playerScore += 1;
      playerScoreEl.textContent = String(playerScore);
      bumpScore(playerScoreEl);
    } else if (result === 'lose') {
      cpuScore += 1;
      cpuScoreEl.textContent = String(cpuScore);
      bumpScore(cpuScoreEl);
    }

    history.push({ player: playerMove, cpu: cpuMove, result });

    const dot = document.createElement('span');
    dot.className = result === 'win' ? 'w' : result === 'lose' ? 'l' : 't';
    dot.textContent = result === 'win' ? 'W' : result === 'lose' ? 'L' : 'T';
    roundLogEl.appendChild(dot);

    pendingMove = null;
    pendingHandEl.textContent = '未入力';
    handButtons.forEach((b) => b.classList.remove('selected'));

    if (playerScore >= WIN_SCORE || cpuScore >= WIN_SCORE) {
      endGame();
    } else {
      restartTimerBar();
    }
  }

  function startGame() {
    resetGame();
    showScreen('game');
    restartTimerBar();
    // わずかな準備時間を挟んでから開始
    setTimeout(() => {
      intervalId = setInterval(playRound, ROUND_MS);
    }, 400);
  }

  function endGame() {
    gameOver = true;
    stopTimerBar();
    clearInterval(intervalId);
    setTimeout(showResult, 700);
  }

  function countHands(moves) {
    const counts = { 1: 0, 2: 0, 3: 0 };
    moves.forEach((m) => {
      if (m) counts[m] += 1;
    });
    return counts;
  }

  function tieFollowUps(perspective) {
    // perspective: 'player' | 'cpu' — 直前のラウンドが「あいこ」だった直後に出した手
    const moves = [];
    for (let i = 1; i < history.length; i += 1) {
      if (history[i - 1].result === 'tie') {
        const mv = history[i][perspective];
        if (mv) moves.push(mv);
      }
    }
    return moves;
  }

  function renderBarChart(container, counts) {
    const total = counts[1] + counts[2] + counts[3];
    container.innerHTML = '';
    [1, 2, 3].forEach((k) => {
      const pct = total > 0 ? Math.round((counts[k] / total) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = `
        <span class="label">${HAND_EMOJI[k]} ${HAND_NAME[k]}</span>
        <span class="track"><span class="fill" style="width:${pct}%"></span></span>
        <span class="pct">${pct}%</span>
      `;
      container.appendChild(row);
    });
    if (total === 0) {
      const empty = document.createElement('div');
      empty.style.color = 'var(--text-dim)';
      empty.style.fontSize = '0.85rem';
      empty.textContent = 'データなし';
      container.appendChild(empty);
    }
  }

  function mostFrequent(counts) {
    let best = null;
    let bestN = -1;
    [1, 2, 3].forEach((k) => {
      if (counts[k] > bestN) {
        bestN = counts[k];
        best = k;
      }
    });
    return bestN > 0 ? best : null;
  }

  function showResult() {
    const playerWon = playerScore >= WIN_SCORE;
    resultTitleEl.textContent = playerWon ? '🎉 あなたの勝利！' : '😢 CPUの勝利…';
    finalScoreEl.textContent = `${playerScore} - ${cpuScore}`;

    const playerMoves = history.map((h) => h.player);
    const cpuMoves = history.map((h) => h.cpu);

    const playerHandCounts = countHands(playerMoves);
    const cpuHandCounts = countHands(cpuMoves);
    const playerTieCounts = countHands(tieFollowUps('player'));
    const cpuTieCounts = countHands(tieFollowUps('cpu'));

    renderBarChart(document.getElementById('player-hand-chart'), playerHandCounts);
    renderBarChart(document.getElementById('cpu-hand-chart'), cpuHandCounts);
    renderBarChart(document.getElementById('player-tie-chart'), playerTieCounts);
    renderBarChart(document.getElementById('cpu-tie-chart'), cpuTieCounts);

    const totalRounds = history.length;
    const ties = history.filter((h) => h.result === 'tie').length;
    const forfeits = history.filter((h) => h.player === null).length;
    const favHand = mostFrequent(playerHandCounts);
    const favCpuHand = mostFrequent(cpuHandCounts);
    const favTieHand = mostFrequent(playerTieCounts);
    const favCpuTieHand = mostFrequent(cpuTieCounts);

    const lines = [];
    lines.push(`総ラウンド数: <strong>${totalRounds}</strong>　あいこ: <strong>${ties}</strong>　未入力による敗北: <strong>${forfeits}</strong>`);
    if (favHand) {
      lines.push(`あなたが一番多く出した手は <strong>${HAND_EMOJI[favHand]} ${HAND_NAME[favHand]}</strong> でした。`);
    }
    if (favTieHand) {
      lines.push(`あなたはあいこの後、<strong>${HAND_EMOJI[favTieHand]} ${HAND_NAME[favTieHand]}</strong> を出す傾向があります。`);
    }
    if (favCpuHand) {
      lines.push(`CPUが一番多く出した手は <strong>${HAND_EMOJI[favCpuHand]} ${HAND_NAME[favCpuHand]}</strong> でした。`);
    }
    if (favCpuTieHand) {
      lines.push(`CPUはあいこの後、<strong>${HAND_EMOJI[favCpuTieHand]} ${HAND_NAME[favCpuTieHand]}</strong> を出す傾向があります。次はそこを狙い撃ちしましょう。`);
    }
    statsSummaryEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');

    showScreen('result');
  }

  // --- イベント登録 ---
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('retry-btn').addEventListener('click', startGame);

  handButtons.forEach((btn) => {
    btn.addEventListener('click', () => setPendingMove(Number(btn.dataset.move)));
  });

  document.addEventListener('keydown', (e) => {
    if (!screens.game.classList.contains('active')) return;
    if (e.key === '1') setPendingMove(1);
    else if (e.key === '2') setPendingMove(2);
    else if (e.key === '3') setPendingMove(3);
  });
})();
