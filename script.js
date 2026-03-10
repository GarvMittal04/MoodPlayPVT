/* ═══════════════════════════════════════════
   MOODPLAY · script.js
   No onclick attributes — pure event listeners
═══════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────
// MOOD DATA
// ─────────────────────────────────────────
const MOOD_DATA = {
  happy: {
    label: 'Happy 😄',
    ytSrc: 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1',
    games: ['reactionSpeed', 'colorMatch'],
    tabLabels: ['Reaction Speed', 'Color Match'],
  },
  sad: {
    label: 'Sad 😢',
    ytSrc: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1',
    games: ['slidingPuzzle', 'bubblePop'],
    tabLabels: ['Simple Puzzle', 'Bubble Pop'],
  },
  stressed: {
    label: 'Stressed 😰',
    ytSrc: 'https://www.youtube.com/embed/lFcSrYw-ARY?autoplay=1',
    games: ['breathingClick', 'bubblePop'],
    tabLabels: ['Breathing Game', 'Bubble Pop'],
  },
  bored: {
    label: 'Bored 😑',
    ytSrc: 'https://www.youtube.com/embed/5yx6BWlEVcY?autoplay=1',
    games: ['memoryMatch', 'quickTap'],
    tabLabels: ['Memory Match', 'Quick Tap'],
  },
  tired: {
    label: 'Tired 😴',
    ytSrc: 'https://www.youtube.com/embed/1ZYbU82GVz4?autoplay=1',
    games: ['slidingPuzzle', 'relaxRhythm'],
    tabLabels: ['Slow Puzzle', 'Relax Rhythm'],
  },
};

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let currentMood  = null;
let activeTab    = 1;
let gameCleanup  = null;   // function to stop current game

// ─────────────────────────────────────────
// PARTICLE BACKGROUND
// ─────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  const COLORS = ['#f6a623','#5b9bd5','#5dab7f','#e07b54','#9b7ec8'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - .5) * .4,
      vy: -.2 - Math.random() * .3,
      alpha: .15 + Math.random() * .25,
    };
  }

  for (let i = 0; i < 55; i++) particles.push(mkParticle());

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.y + p.r < 0) { Object.assign(p, mkParticle(), { y: H + p.r }); }
      if (p.x < -10 || p.x > W + 10) { Object.assign(p, mkParticle()); }
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ─────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goLanding() {
  stopGame();
  document.getElementById('yt-player').src = '';
  document.body.className = '';
  showPage('page-landing');
}

function goMoodSelect() {
  stopGame();
  document.getElementById('yt-player').src = '';
  showPage('page-mood');
}

function selectMood(mood) {
  const data = MOOD_DATA[mood];
  currentMood = mood;
  activeTab = 1;

  // Body accent class
  document.body.className = 'm-' + mood;

  // Mood chip
  document.getElementById('mood-chip').textContent = data.label;

  // Tab labels
  document.getElementById('tab-btn-1').textContent = data.tabLabels[0];
  document.getElementById('tab-btn-2').textContent = data.tabLabels[1];
  document.getElementById('tab-btn-1').classList.add('active');
  document.getElementById('tab-btn-2').classList.remove('active');

  // Music
  document.getElementById('yt-player').src = data.ytSrc;

  // Load game 1
  loadGame(data.games[0]);

  showPage('page-games');
}

function switchTab(n) {
  activeTab = n;
  document.getElementById('tab-btn-1').classList.toggle('active', n === 1);
  document.getElementById('tab-btn-2').classList.toggle('active', n === 2);
  stopGame();
  loadGame(MOOD_DATA[currentMood].games[n - 1]);
}

// ─────────────────────────────────────────
// DOM READY — attach all event listeners
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

  document.getElementById('btn-start').addEventListener('click', function () {
    showPage('page-mood');
  });

  document.getElementById('btn-back-landing').addEventListener('click', goLanding);
  document.getElementById('btn-back-mood').addEventListener('click', goMoodSelect);

  document.querySelectorAll('.mood-pill').forEach(function (pill) {
    pill.addEventListener('click', function () {
      selectMood(pill.dataset.mood);
    });
  });

  document.getElementById('tab-btn-1').addEventListener('click', function () { switchTab(1); });
  document.getElementById('tab-btn-2').addEventListener('click', function () { switchTab(2); });
});

// ─────────────────────────────────────────
// GAME ENGINE
// ─────────────────────────────────────────
function stopGame() {
  if (typeof gameCleanup === 'function') { gameCleanup(); gameCleanup = null; }
}

function loadGame(name) {
  stopGame();
  const area = document.getElementById('game-area');
  area.innerHTML = '';
  GAMES[name](area);
}

const GAMES = {};

/* ──────────────────────────────────────
   1. REACTION SPEED
────────────────────────────────────── */
GAMES.reactionSpeed = function (area) {
  let state = 'idle', t0 = 0, timer = null;

  area.innerHTML = `
    <div class="g-title">Reaction Speed</div>
    <div class="g-sub">Click the box the moment it turns colour!</div>
    <div id="rx-box">Click to Start</div>
    <div id="rx-score" class="g-score"></div>`;

  const box = area.querySelector('#rx-box');
  const sc  = area.querySelector('#rx-score');

  box.addEventListener('click', function () {
    if (state === 'idle' || state === 'result') {
      state = 'waiting';
      box.textContent = 'Wait for it…';
      box.className = 'state-wait';
      sc.textContent = '';
      const delay = 1500 + Math.random() * 3000;
      timer = setTimeout(function () {
        state = 'go';
        box.textContent = 'NOW! Click!';
        box.className = 'state-go';
        t0 = Date.now();
      }, delay);
    } else if (state === 'waiting') {
      clearTimeout(timer);
      state = 'result';
      box.textContent = '😬 Too early! Click to retry';
      box.className = '';
      sc.textContent = 'Too soon!';
    } else if (state === 'go') {
      const ms = Date.now() - t0;
      state = 'result';
      box.className = '';
      box.textContent = ms + ' ms — Click to retry';
      const rank = ms < 200 ? '⚡ Lightning fast!' : ms < 350 ? '🔥 Speedy!' : ms < 500 ? '👍 Not bad' : '🐢 Keep practising';
      sc.textContent = rank;
    }
  });

  gameCleanup = function () { clearTimeout(timer); };
};

/* ──────────────────────────────────────
   2. COLOR MATCH
────────────────────────────────────── */
GAMES.colorMatch = function (area) {
  const COLORS = [
    { name: 'Red',    hex: '#e74c3c' },
    { name: 'Blue',   hex: '#3498db' },
    { name: 'Green',  hex: '#2ecc71' },
    { name: 'Yellow', hex: '#f1c40f' },
    { name: 'Purple', hex: '#9b59b6' },
    { name: 'Orange', hex: '#e67e22' },
  ];
  let score = 0, lives = 3, target;

  area.innerHTML = `
    <div class="g-title">Color Match</div>
    <div class="g-sub">Tap the circle that matches the colour above</div>
    <div class="cm-target" id="cm-target"></div>
    <div class="cm-options" id="cm-opts">
      <button></button><button></button><button></button><button></button>
    </div>
    <div class="g-score" id="cm-score">Score: 0  ❤️ 3</div>`;

  const tgt  = area.querySelector('#cm-target');
  const opts = area.querySelectorAll('#cm-opts button');
  const sc   = area.querySelector('#cm-score');

  function pick() {
    const pool = [...COLORS].sort(function () { return Math.random() - .5; }).slice(0, 4);
    target = pool[Math.floor(Math.random() * 4)];
    tgt.style.background = target.hex;
    opts.forEach(function (btn, i) {
      btn.style.background = pool[i].hex;
      btn.dataset.color = pool[i].name;
    });
    sc.textContent = 'Score: ' + score + '  ❤️ ' + lives;
  }

  opts.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (lives <= 0) return;
      if (btn.dataset.color === target.name) {
        score++;
        sc.textContent = '✅ Correct! Score: ' + score;
      } else {
        lives--;
        if (lives <= 0) { sc.textContent = '💀 Game Over — refresh tab to restart'; return; }
        sc.textContent = '❌ Nope! Lives: ' + lives;
      }
      setTimeout(pick, 550);
    });
  });

  pick();
};

/* ──────────────────────────────────────
   3. MEMORY MATCH
────────────────────────────────────── */
GAMES.memoryMatch = function (area) {
  const ICONS = ['🌸','🦋','🌙','⭐','🍀','🌈','🎵','🦄'];
  const deck  = [...ICONS, ...ICONS].sort(function () { return Math.random() - .5; });
  let flipped = [], matched = 0, locked = false, moves = 0;

  area.innerHTML = `
    <div class="g-title">Memory Match</div>
    <div class="g-sub">Find all 8 matching pairs</div>
    <div class="mm-grid" id="mm-grid"></div>
    <div class="g-score" id="mm-score">Moves: 0</div>`;

  const grid = area.querySelector('#mm-grid');
  const sc   = area.querySelector('#mm-score');

  deck.forEach(function (icon, i) {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.innerHTML = '<div class="mm-inner"><div class="mm-front">?</div><div class="mm-back">' + icon + '</div></div>';
    card.dataset.icon = icon;

    card.addEventListener('click', function () {
      if (locked || card.classList.contains('flipped') || card.dataset.done) return;
      card.classList.add('flipped');
      flipped.push(card);

      if (flipped.length === 2) {
        locked = true;
        moves++;
        sc.textContent = 'Moves: ' + moves;
        const [a, b] = flipped;
        if (a.dataset.icon === b.dataset.icon) {
          a.dataset.done = b.dataset.done = '1';
          matched++;
          flipped = [];
          locked = false;
          if (matched === ICONS.length) sc.textContent = '🎉 Solved in ' + moves + ' moves!';
        } else {
          setTimeout(function () {
            a.classList.remove('flipped');
            b.classList.remove('flipped');
            flipped = [];
            locked = false;
          }, 900);
        }
      }
    });

    grid.appendChild(card);
  });
};

/* ──────────────────────────────────────
   4. BUBBLE POP
────────────────────────────────────── */
GAMES.bubblePop = function (area) {
  let score = 0, spawnId = null;
  const COLORS = ['#f6a623','#5b9bd5','#5dab7f','#e07b54','#9b7ec8','#f48fb1'];
  const ICONS  = ['🫧','✨','💫','🌟','🎈'];

  area.innerHTML = `
    <div class="g-title">Bubble Pop</div>
    <div class="g-sub">Pop them before they float away!</div>
    <div class="g-score" id="bp-score">Score: 0</div>
    <div id="bubble-arena"></div>`;

  const arena = area.querySelector('#bubble-arena');
  const sc    = area.querySelector('#bp-score');

  function spawn() {
    const size = 42 + Math.random() * 38;
    const b    = document.createElement('div');
    b.className = 'bubble';
    b.style.cssText = [
      'width:'  + size + 'px',
      'height:' + size + 'px',
      'left:'   + (4 + Math.random() * 80) + '%',
      'background:' + COLORS[Math.floor(Math.random() * COLORS.length)],
      'animation-duration:' + (2.8 + Math.random() * 3) + 's',
    ].join(';');
    b.textContent = ICONS[Math.floor(Math.random() * ICONS.length)];

    b.addEventListener('click', function (e) {
      e.stopPropagation();
      score++;
      sc.textContent = 'Score: ' + score;
      b.remove();
    });
    b.addEventListener('animationend', function () { b.remove(); });
    arena.appendChild(b);
  }

  spawn();
  spawnId = setInterval(spawn, 1100);
  gameCleanup = function () { clearInterval(spawnId); };
};

/* ──────────────────────────────────────
   5. BREATHING CLICK
────────────────────────────────────── */
GAMES.breathingClick = function (area) {
  const PHASES = [
    { label: 'Breathe In',  secs: 4, expand: true  },
    { label: 'Hold',        secs: 2, expand: true  },
    { label: 'Breathe Out', secs: 4, expand: false },
  ];
  let running = false, phaseIdx = 0, countdown = 0, cycles = 0, ivl = null;

  area.innerHTML = `
    <div class="g-title">Breathing Game</div>
    <div class="g-sub">Follow the orb — click to begin</div>
    <div id="breath-orb">Tap to start</div>
    <div class="g-score" id="br-score"></div>`;

  const orb = area.querySelector('#breath-orb');
  const sc  = area.querySelector('#br-score');

  function nextPhase() {
    const p = PHASES[phaseIdx % PHASES.length];
    orb.textContent = p.label;
    orb.className = p.expand ? 'expand' : '';
    countdown = p.secs;
    sc.textContent = p.label + ' — ' + countdown + 's  |  Cycles: ' + cycles;

    ivl = setInterval(function () {
      countdown--;
      sc.textContent = p.label + ' — ' + countdown + 's  |  Cycles: ' + cycles;
      if (countdown <= 0) {
        clearInterval(ivl);
        if (p.label === 'Breathe Out') { cycles++; }
        phaseIdx++;
        if (cycles >= 5) {
          orb.textContent = '🌟 5 Cycles!';
          orb.className = '';
          sc.textContent = 'Wonderful! You completed 5 breath cycles.';
          running = false;
          return;
        }
        nextPhase();
      }
    }, 1000);
  }

  orb.addEventListener('click', function () {
    if (!running) { running = true; nextPhase(); }
  });

  gameCleanup = function () { clearInterval(ivl); };
};

/* ──────────────────────────────────────
   6. SLIDING PUZZLE (3×3)
────────────────────────────────────── */
GAMES.slidingPuzzle = function (area) {
  const EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
  let tiles = [...EMOJIS, null], moves = 0;

  function shuffle() {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    moves = 0;
  }

  area.innerHTML = `
    <div class="g-title">Sliding Puzzle</div>
    <div class="g-sub">Arrange 1–8 in order (row by row)</div>
    <div class="pz-grid" id="pz-grid"></div>
    <div class="g-score" id="pz-score">Moves: 0</div>
    <button class="g-btn" id="pz-shuffle">Shuffle</button>`;

  const grid = area.querySelector('#pz-grid');
  const sc   = area.querySelector('#pz-score');

  function render() {
    grid.innerHTML = '';
    tiles.forEach(function (t, i) {
      const tile = document.createElement('div');
      tile.className = 'pz-tile ' + (t === null ? 'empty' : 'filled');
      tile.textContent = t || '';
      tile.addEventListener('click', function () { move(i); });
      grid.appendChild(tile);
    });
  }

  function move(i) {
    const blank = tiles.indexOf(null);
    const row = function (n) { return Math.floor(n / 3); };
    const col = function (n) { return n % 3; };
    const adj = (row(i) === row(blank) && Math.abs(col(i) - col(blank)) === 1) ||
                (col(i) === col(blank) && Math.abs(row(i) - row(blank)) === 1);
    if (!adj) return;
    [tiles[i], tiles[blank]] = [tiles[blank], tiles[i]];
    moves++;
    sc.textContent = 'Moves: ' + moves;
    render();
    const goal = [...EMOJIS, null];
    if (tiles.every(function (t, i) { return t === goal[i]; })) {
      sc.textContent = '🎉 Solved in ' + moves + ' moves!';
    }
  }

  area.querySelector('#pz-shuffle').addEventListener('click', function () {
    shuffle(); render();
    sc.textContent = 'Moves: 0';
  });

  shuffle();
  render();
};

/* ──────────────────────────────────────
   7. QUICK TAP
────────────────────────────────────── */
GAMES.quickTap = function (area) {
  let score = 0, timeLeft = 10, ivl = null, running = false;

  area.innerHTML = `
    <div class="g-title">Quick Tap</div>
    <div class="g-sub">Tap as fast as you can in 10 seconds!</div>
    <div class="g-score" id="qt-score">Score: 0 · Time: 10s</div>
    <div id="tap-circle">TAP!</div>
    <button class="g-btn" id="qt-start">Start</button>`;

  const circle = area.querySelector('#tap-circle');
  const sc     = area.querySelector('#qt-score');
  const startB = area.querySelector('#qt-start');

  circle.addEventListener('click', function () {
    if (!running) return;
    score++;
    sc.textContent = 'Score: ' + score + ' · Time: ' + timeLeft + 's';
  });

  startB.addEventListener('click', function () {
    score = 0; timeLeft = 10; running = true;
    startB.disabled = true;
    sc.textContent = 'Score: 0 · Time: 10s';
    ivl = setInterval(function () {
      timeLeft--;
      sc.textContent = 'Score: ' + score + ' · Time: ' + timeLeft + 's';
      if (timeLeft <= 0) {
        clearInterval(ivl);
        running = false;
        sc.textContent = '🎯 Final: ' + score + ' taps!';
        startB.textContent = 'Play Again';
        startB.disabled = false;
      }
    }, 1000);
  });

  gameCleanup = function () { clearInterval(ivl); };
};

/* ──────────────────────────────────────
   8. RELAX RHYTHM
────────────────────────────────────── */
GAMES.relaxRhythm = function (area) {
  const TOTAL = 8;
  let clicks = 0, running = false, ivl = null;

  area.innerHTML = `
    <div class="g-title">Relax Rhythm</div>
    <div class="g-sub">Click on every glow — follow the pulse</div>
    <div id="rhythm-ring">Press Begin</div>
    <div class="rh-dots" id="rh-dots"></div>
    <div class="g-score" id="rh-score">0 / ` + TOTAL + `</div>
    <button class="g-btn" id="rh-start">Begin</button>`;

  const ring  = area.querySelector('#rhythm-ring');
  const dots  = area.querySelector('#rh-dots');
  const sc    = area.querySelector('#rh-score');
  const startB= area.querySelector('#rh-start');

  for (let i = 0; i < TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'rh-dot';
    dots.appendChild(d);
  }

  function pulse() {
    ring.classList.add('pulsing');
    ring.textContent = 'Tap ✨';
    setTimeout(function () {
      ring.classList.remove('pulsing');
      ring.textContent = 'Wait…';
    }, 650);
  }

  ring.addEventListener('click', function () {
    if (!running) return;
    clicks++;
    sc.textContent = clicks + ' / ' + TOTAL;
    const dotList = dots.querySelectorAll('.rh-dot');
    if (clicks <= TOTAL) { dotList[clicks - 1].classList.add('on'); }
    if (clicks >= TOTAL) {
      clearInterval(ivl);
      running = false;
      ring.textContent = '🌙 Zen!';
      sc.textContent = 'Perfect rhythm!';
      startB.disabled = false;
      startB.textContent = 'Again';
    }
  });

  startB.addEventListener('click', function () {
    clicks = 0; running = true;
    dots.querySelectorAll('.rh-dot').forEach(function (d) { d.classList.remove('on'); });
    sc.textContent = '0 / ' + TOTAL;
    startB.disabled = true;
    clearInterval(ivl);
    ivl = setInterval(pulse, 1800);
    pulse();
  });

  gameCleanup = function () { clearInterval(ivl); };
};
