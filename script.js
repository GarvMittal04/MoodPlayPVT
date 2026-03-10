/* ========================================
   MOODPLAY — script.js
   Auth · Navigation · Backend · Games
   ======================================== */

// ============================================================
//  CONFIG  —  replace with your real keys
// ============================================================
const GEMINI_API_KEY = 'AIzaSyDemo_replace_with_your_key';
// Get a free Gemini key at: https://aistudio.google.com

// ============================================================
//  MOOD DATA
// ============================================================
const MOODS = {
  happy: {
    emoji: '😄', label: 'Happy', color: '#f7c948',
    ytSrc: 'https://www.youtube.com/embed/JdqL89ZZwFw?autoplay=1',
    games: ['reactionSpeed', 'colorMatch'],
    gameLabels: ['Reaction Speed', 'Color Match'],
  },
  sad: {
    emoji: '😢', label: 'Sad', color: '#64b5f6',
    ytSrc: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1',
    games: ['slidingPuzzle', 'bubblePop'],
    gameLabels: ['Simple Puzzle', 'Calm Bubbles'],
  },
  stressed: {
    emoji: '😰', label: 'Stressed', color: '#81c784',
    ytSrc: 'https://www.youtube.com/embed/lFcSrYw-ARY?autoplay=1',
    games: ['breathingClick', 'bubblePop'],
    gameLabels: ['Breathing Click', 'Bubble Relax'],
  },
  bored: {
    emoji: '😑', label: 'Bored', color: '#ff8a65',
    ytSrc: 'https://www.youtube.com/embed/5yx6BWlEVcY?autoplay=1',
    games: ['memoryMatch', 'quickTap'],
    gameLabels: ['Memory Match', 'Quick Tap'],
  },
  tired: {
    emoji: '😴', label: 'Tired', color: '#ce93d8',
    ytSrc: 'https://www.youtube.com/embed/1ZYbU82GVz4?autoplay=1',
    games: ['slidingPuzzle', 'relaxRhythm'],
    gameLabels: ['Slow Puzzle', 'Relax Rhythm'],
  },
};

// ============================================================
//  SHARED BACKEND — window.storage (persistent, cross-session)
// ============================================================
const Backend = {
  /**
   * Push a mood event to the shared backend so the admin can see it.
   * @param {string} username
   * @param {string|null} mood
   * @param {'start'|'end'} action
   */
  async push(username, mood, action) {
    try {
      const evt = {
        user: username,
        mood,
        action,
        ts: Date.now(),
        device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      };

      // Per-user active mood (admin reads these)
      if (action === 'start') {
        await window.storage.set('active:' + username, JSON.stringify(evt), true);
      } else {
        try { await window.storage.delete('active:' + username, true); } catch (_) {}
      }

      // Global event feed (admin live feed)
      let feed = [];
      try {
        const r = await window.storage.get('feed:events', true);
        feed = r ? JSON.parse(r.value) : [];
      } catch (_) { feed = []; }
      feed.unshift(evt);
      if (feed.length > 300) feed = feed.slice(0, 300);
      await window.storage.set('feed:events', JSON.stringify(feed), true);

      // Users registry (admin user table)
      let reg = {};
      try {
        const r = await window.storage.get('users:reg', true);
        reg = r ? JSON.parse(r.value) : {};
      } catch (_) { reg = {}; }
      if (!reg[username]) reg[username] = { joined: Date.now(), sessions: 0, moods: {} };
      if (action === 'start') {
        reg[username].sessions = (reg[username].sessions || 0) + 1;
        reg[username].moods[mood] = (reg[username].moods[mood] || 0) + 1;
      }
      reg[username].lastMood  = mood;
      reg[username].lastSeen  = Date.now();
      reg[username].online    = action === 'start';
      reg[username].avatar    = username[0].toUpperCase();
      await window.storage.set('users:reg', JSON.stringify(reg), true);

    } catch (e) {
      console.warn('Backend sync error:', e);
    }
  },

  /** Append a completed session entry to the user's shared history */
  async pushHistory(username, entry) {
    try {
      let hist = [];
      try {
        const r = await window.storage.get('hist:' + username, true);
        hist = r ? JSON.parse(r.value) : [];
      } catch (_) { hist = []; }
      hist.unshift(entry);
      if (hist.length > 60) hist = hist.slice(0, 60);
      await window.storage.set('hist:' + username, JSON.stringify(hist), true);
    } catch (e) {
      console.warn('History push error:', e);
    }
  },
};

// ============================================================
//  LOCAL STORAGE HELPER (user auth & local data)
// ============================================================
const LS = {
  get(k)    { try { return JSON.parse(localStorage.getItem('mp_' + k)); } catch { return null; } },
  set(k, v) { localStorage.setItem('mp_' + k, JSON.stringify(v)); },
  del(k)    { localStorage.removeItem('mp_' + k); },
};

// ============================================================
//  STATE
// ============================================================
let currentUser    = null;
let currentMood    = null;
let activeTab      = 1;
let moodStartTime  = null;
let aiInputVisible = false;

// ============================================================
//  INITIALISE ON DOM READY
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  initOrbs();
  // Auto-login from saved session
  const saved = LS.get('session');
  if (saved) {
    const users = LS.get('users') || {};
    if (users[saved]) loginUser(saved);
  }
});

// ============================================================
//  AUTH
// ============================================================
function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-btn-text').textContent = tab === 'login' ? 'Login' : 'Create Account';
  document.getElementById('auth-email').style.display  = tab === 'signup' ? 'block' : 'none';
  document.getElementById('auth-err').textContent      = '';
  switchAuthTab._tab = tab;
}
switchAuthTab._tab = 'login';

function doAuth() {
  const u   = document.getElementById('auth-username').value.trim();
  const p   = document.getElementById('auth-password').value;
  const e   = document.getElementById('auth-email').value.trim();
  const err = document.getElementById('auth-err');

  if (!u || !p) { err.textContent = 'Please fill in all fields.'; return; }

  const users = LS.get('users') || {};

  if (switchAuthTab._tab === 'signup') {
    if (users[u])   { err.textContent = 'Username already taken.'; return; }
    if (p.length < 4) { err.textContent = 'Password must be ≥ 4 characters.'; return; }
    users[u] = { password: p, email: e, joined: Date.now(), avatar: u[0].toUpperCase() };
    LS.set('users', users);
    showToast('Account created! 🎉');
  } else {
    if (!users[u] || users[u].password !== p) { err.textContent = 'Invalid username or password.'; return; }
  }

  loginUser(u);
}

function demoLogin() {
  const users = LS.get('users') || {};
  if (!users['demo']) {
    users['demo'] = { password: 'demo', email: 'demo@moodplay.app', joined: Date.now() - 7 * 86400000, avatar: 'D' };
    LS.set('users', users);
    // Seed demo history
    const hist  = [];
    const moods = ['happy', 'sad', 'stressed', 'bored', 'tired'];
    for (let i = 13; i >= 0; i--) {
      hist.push({ mood: moods[Math.floor(Math.random() * 5)], ts: Date.now() - i * 43200000, duration: Math.floor(Math.random() * 20 + 3) });
    }
    LS.set('history_demo', hist);
  }
  document.getElementById('auth-username').value = 'demo';
  document.getElementById('auth-password').value = 'demo';
  doAuth();
}

function loginUser(username) {
  currentUser = username;
  LS.set('session', username);
  document.getElementById('landing-avatar').textContent  = username[0].toUpperCase();
  document.getElementById('landing-username').textContent = `Hi, ${username}! 👋`;
  document.getElementById('bottomNav').classList.add('visible');
  document.getElementById('syncBadge').classList.add('visible');
  showPage('page-landing');
}

function logout() {
  if (moodStartTime && currentMood) saveMoodSession();
  Backend.push(currentUser, currentMood || 'none', 'end');
  LS.del('session');
  currentUser = null;
  document.getElementById('bottomNav').classList.remove('visible');
  document.getElementById('syncBadge').classList.remove('visible');
  document.body.className = '';
  stopCurrentGame();
  document.getElementById('ytPlayer').src = '';
  showPage('page-auth');
}

// ============================================================
//  NAVIGATION
// ============================================================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function navTo(dest) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (dest === 'home') {
    document.getElementById('nav-home').classList.add('active');
    showPage('page-landing');
  } else if (dest === 'analytics') {
    document.getElementById('nav-analytics').classList.add('active');
    renderAnalytics();
    showPage('page-analytics');
  } else if (dest === 'leaderboard') {
    document.getElementById('nav-leaderboard').classList.add('active');
    renderLeaderboard('sessions');
    showPage('page-leaderboard');
  }
}

function goToMoodSelection() {
  stopCurrentGame();
  document.getElementById('ytPlayer').src = '';
  if (moodStartTime && currentMood) saveMoodSession();
  showPage('page-mood');
}

// ============================================================
//  MOOD SELECTION
// ============================================================
function selectMood(mood) {
  currentMood   = mood;
  moodStartTime = Date.now();
  const data    = MOODS[mood];

  document.body.className = 'mood-' + mood;

  const badge = document.getElementById('activeMoodBadge');
  badge.textContent    = data.emoji + ' ' + data.label;
  badge.style.borderColor = data.color;
  badge.style.color       = data.color;

  document.getElementById('tab1Btn').textContent = data.gameLabels[0];
  document.getElementById('tab2Btn').textContent = data.gameLabels[1];
  document.getElementById('ytPlayer').src        = data.ytSrc;

  activeTab = 1;
  updateTabBtns();
  loadGame(data.games[0]);

  // Push to admin backend
  Backend.push(currentUser, mood, 'start');

  showPage('page-games');
}

function switchTab(tab) {
  activeTab = tab;
  updateTabBtns();
  stopCurrentGame();
  loadGame(MOODS[currentMood].games[tab - 1]);
}

function updateTabBtns() {
  document.getElementById('tab1Btn').classList.toggle('active', activeTab === 1);
  document.getElementById('tab2Btn').classList.toggle('active', activeTab === 2);
}

// ============================================================
//  MOOD HISTORY & SESSION SAVING
// ============================================================
function saveMoodSession() {
  if (!currentUser || !currentMood) return;

  const key      = 'history_' + currentUser;
  const hist     = LS.get(key) || [];
  const duration = Math.max(1, Math.round((Date.now() - moodStartTime) / 60000));
  const entry    = { mood: currentMood, ts: Date.now(), duration };

  hist.push(entry);
  if (hist.length > 100) hist.shift();
  LS.set(key, hist);

  // Push to shared backend
  Backend.pushHistory(currentUser, entry);
  Backend.push(currentUser, currentMood, 'end');

  // Update local user stats
  const users = LS.get('users') || {};
  if (users[currentUser]) {
    users[currentUser].sessions = (users[currentUser].sessions || 0) + 1;
    users[currentUser].variety  = new Set(hist.map(h => h.mood)).size;
    users[currentUser].streak   = calcStreak(hist);
    LS.set('users', users);
  }

  moodStartTime = null;
}

function calcStreak(history) {
  if (!history.length) return 0;
  const days = new Set(history.map(h => new Date(h.ts).toDateString()));
  let streak = 0;
  let d = new Date();
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Save session when user closes the tab
window.addEventListener('beforeunload', () => {
  if (moodStartTime && currentMood) saveMoodSession();
});

// ============================================================
//  GEMINI AI MOOD DETECTION
// ============================================================
function toggleAiInput() {
  aiInputVisible = !aiInputVisible;
  document.getElementById('aiInputBox').classList.toggle('visible', aiInputVisible);
  if (aiInputVisible) document.getElementById('aiTextInput').focus();
}

async function detectMoodWithGemini() {
  const text     = document.getElementById('aiTextInput').value.trim();
  const resultEl = document.getElementById('aiResult');

  if (!text) { showToast('Tell me how you feel first 💭'); return; }

  resultEl.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';

  const prompt = `Classify the user's mood into exactly one of: happy, sad, stressed, bored, tired.
Reply ONLY as JSON with no extra text: {"mood":"<mood>","message":"<one warm encouraging sentence>"}

User says: "${text}"`;

  try {
    let detectedMood = 'bored';
    let message      = '';

    if (GEMINI_API_KEY.includes('Demo_replace')) {
      // ── Keyword fallback (no API key) ──
      const t = text.toLowerCase();
      if      (t.match(/happy|great|amazing|joy|excit|good|love/)) detectedMood = 'happy';
      else if (t.match(/sad|cry|depress|lonely|miss|upset|down/))  detectedMood = 'sad';
      else if (t.match(/stress|anxious|overwhelm|worry|pressure/)) detectedMood = 'stressed';
      else if (t.match(/tired|exhaust|sleep|fatigue|drain/))       detectedMood = 'tired';
      message = "Let's find the right vibe for you 🌟";
    } else {
      // ── Real Gemini API call ──
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data   = await res.json();
      const raw    = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      detectedMood = parsed.mood    || 'bored';
      message      = parsed.message || '';
    }

    const emoji = MOODS[detectedMood]?.emoji || '😐';
    resultEl.innerHTML = `
      <span style="font-size:1.8rem">${emoji}</span>
      Gemini detects: <strong style="color:var(--accent)">${detectedMood}</strong><br>
      <span style="font-size:.82rem">${message}</span>`;

    setTimeout(() => selectMood(detectedMood), 1800);

  } catch (err) {
    resultEl.textContent = 'Gemini error: ' + err.message;
  }
}

// ============================================================
//  ANALYTICS
// ============================================================
function renderAnalytics() {
  if (!currentUser) return;

  const hist    = LS.get('history_' + currentUser) || [];
  const total   = hist.length;
  const mins    = hist.reduce((a, h) => a + (h.duration || 0), 0);
  const streak  = calcStreak(hist);
  const variety = new Set(hist.map(h => h.mood)).size;

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><div class="stat-val">${total}</div><div class="stat-label">Sessions</div></div>
    <div class="stat-card"><div class="stat-val">${mins}m</div><div class="stat-label">Time Played</div></div>
    <div class="stat-card"><div class="stat-val">${streak}</div><div class="stat-label">Day Streak 🔥</div></div>
    <div class="stat-card"><div class="stat-val">${variety}/5</div><div class="stat-label">Moods Tried</div></div>`;

  const counts = { happy: 0, sad: 0, stressed: 0, bored: 0, tired: 0 };
  hist.forEach(h => { if (h.mood in counts) counts[h.mood]++; });
  const max    = Math.max(...Object.values(counts), 1);
  const colors = { happy: '#f7c948', sad: '#64b5f6', stressed: '#81c784', bored: '#ff8a65', tired: '#ce93d8' };
  const emojis = { happy: '😄', sad: '😢', stressed: '😰', bored: '😑', tired: '😴' };

  document.getElementById('barChart').innerHTML = Object.entries(counts).map(([mood, count]) => `
    <div class="bar-row">
      <div class="bar-label">${emojis[mood]} ${mood}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(count / max) * 100}%;background:${colors[mood]}"></div>
      </div>
      <div class="bar-count" style="color:${colors[mood]}">${count}</div>
    </div>`).join('');

  const recent = [...hist].reverse().slice(0, 15);
  document.getElementById('historyList').innerHTML = recent.length
    ? recent.map(h => `
        <div class="history-item">
          <div class="history-emoji">${emojis[h.mood] || '😐'}</div>
          <div style="flex:1">
            <div class="history-mood">${h.mood.charAt(0).toUpperCase() + h.mood.slice(1)}</div>
            <div class="history-time">${new Date(h.ts).toLocaleString()}</div>
          </div>
          <div class="history-duration">${h.duration || 1}m</div>
        </div>`).join('')
    : '<div class="empty-state">No sessions yet. Play a game!</div>';
}

// ============================================================
//  LEADERBOARD
// ============================================================
function renderLeaderboard(metric, event) {
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  if (event?.target) event.target.classList.add('active');

  const users   = LS.get('users') || {};
  const labels  = { sessions: 'sessions played', streak: 'day streak', variety: 'moods explored' };
  const palette = ['#f7c948', '#64b5f6', '#81c784', '#ff8a65', '#ce93d8', '#7e91ff', '#f48fb1'];

  const sorted = Object.entries(users)
    .map(([n, d]) => ({ name: n, avatar: d.avatar || n[0].toUpperCase(), score: d[metric] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const rankEmoji = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  document.getElementById('lbList').innerHTML = sorted.length
    ? sorted.map((u, i) => `
        <div class="lb-row${u.name === currentUser ? ' lb-you' : ''}">
          <div class="lb-rank ${rankClass(i)}">${rankEmoji(i)}</div>
          <div class="lb-avatar" style="background:${palette[i % palette.length]}">${u.avatar}</div>
          <div style="flex:1">
            <div class="lb-name">${u.name}${u.name === currentUser ? ' (you)' : ''}</div>
            <div class="lb-sub">${labels[metric]}</div>
          </div>
          <div class="lb-score">${u.score}</div>
        </div>`).join('')
    : '<div class="empty-state">No players yet!</div>';
}

// ============================================================
//  UTILITIES
// ============================================================
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function initOrbs() {
  const container = document.getElementById('bgOrbs');
  const palette   = ['#f7c948', '#64b5f6', '#81c784', '#ff8a65', '#ce93d8', '#7e91ff'];
  for (let i = 0; i < 7; i++) {
    const orb  = document.createElement('div');
    orb.className = 'orb';
    const size = 220 + Math.random() * 300;
    orb.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%; top:${Math.random() * 100}%;
      background:${palette[i % palette.length]};
      animation-delay:${Math.random() * 8}s;
      animation-duration:${14 + Math.random() * 12}s;`;
    container.appendChild(orb);
  }
}

// ============================================================
//  GAME ENGINE
// ============================================================
const gameCleanup = {};

function stopCurrentGame() {
  if (gameCleanup._fn) { gameCleanup._fn(); gameCleanup._fn = null; }
}

function loadGame(name) {
  stopCurrentGame();
  const vp = document.getElementById('gameViewport');
  vp.innerHTML = '';
  GAMES[name](vp);
}

const GAMES = {};

// ─── 1. REACTION SPEED ────────────────────────────────────
GAMES.reactionSpeed = function (vp) {
  let state = 'idle', startTime = 0, timer = null;

  vp.innerHTML = `
    <div class="game-title">Reaction Speed</div>
    <div class="game-subtitle">Click when the box turns yellow!</div>
    <div id="reaction-box">Click to Start</div>
    <div class="game-score" id="rxScore"></div>`;

  const box     = vp.querySelector('#reaction-box');
  const scoreEl = vp.querySelector('#rxScore');

  box.addEventListener('click', () => {
    if (state === 'idle' || state === 'result') {
      state = 'wait';
      box.textContent = 'Wait…';
      box.className   = 'wait';
      scoreEl.textContent = '';
      timer = setTimeout(() => {
        state           = 'ready';
        box.textContent = 'NOW!';
        box.className   = 'go';
        startTime       = Date.now();
      }, 1500 + Math.random() * 3000);

    } else if (state === 'wait') {
      clearTimeout(timer);
      state = 'result';
      box.textContent     = 'Too early! Retry';
      box.className       = '';
      scoreEl.textContent = '😬 Too soon!';

    } else if (state === 'ready') {
      const ms = Date.now() - startTime;
      state           = 'result';
      box.textContent = `${ms}ms — Retry`;
      box.className   = '';
      scoreEl.textContent = ms < 200 ? '🔥 Lightning!' : ms < 350 ? '⚡ Fast!' : ms < 500 ? '👍 Good' : '🐢 Keep trying';
    }
  });

  gameCleanup._fn = () => clearTimeout(timer);
};

// ─── 2. COLOR MATCH ───────────────────────────────────────
GAMES.colorMatch = function (vp) {
  const COLORS = [
    { name: 'Red',    hex: '#e74c3c' },
    { name: 'Blue',   hex: '#3498db' },
    { name: 'Green',  hex: '#2ecc71' },
    { name: 'Yellow', hex: '#f1c40f' },
    { name: 'Purple', hex: '#9b59b6' },
    { name: 'Orange', hex: '#e67e22' },
  ];
  let score = 0, lives = 3, target = null;

  vp.innerHTML = `
    <div class="game-title">Color Match</div>
    <div class="game-subtitle">Tap the circle matching the colour above</div>
    <div class="color-match-target"></div>
    <div class="color-match-options">
      <button></button><button></button><button></button><button></button>
    </div>
    <div class="game-score" id="cmScore"></div>`;

  const scoreEl = vp.querySelector('#cmScore');

  function pick() {
    const shuffled = [...COLORS].sort(() => Math.random() - 0.5).slice(0, 4);
    target = shuffled[Math.floor(Math.random() * shuffled.length)];
    vp.querySelector('.color-match-target').style.background = target.hex;
    vp.querySelectorAll('.color-match-options button').forEach((btn, i) => {
      btn.style.background = shuffled[i].hex;
      btn.dataset.color    = shuffled[i].name;
    });
    scoreEl.textContent = `Score: ${score}  ❤️ ${lives}`;
  }

  vp.querySelectorAll('.color-match-options button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.color === target.name) {
        score++;
        scoreEl.textContent = '✅ Correct!';
      } else {
        lives--;
        scoreEl.textContent = lives > 0 ? '❌ Nope!' : '💀 Game Over';
        if (!lives) return;
      }
      setTimeout(pick, 600);
    });
  });

  pick();
};

// ─── 3. MEMORY MATCH ──────────────────────────────────────
GAMES.memoryMatch = function (vp) {
  const PAIRS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🎸', '🎺', '🎹'];
  let cards   = [...PAIRS, ...PAIRS]
    .sort(() => Math.random() - 0.5)
    .map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
  let selected = [], locked = false, moves = 0;

  vp.innerHTML = `
    <div class="game-title">Memory Match</div>
    <div class="game-subtitle">Find all the pairs!</div>
    <div class="memory-grid" id="memGrid"></div>
    <div class="game-score" id="memScore">Moves: 0</div>`;

  const grid    = vp.querySelector('#memGrid');
  const scoreEl = vp.querySelector('#memScore');

  function render() {
    grid.innerHTML = '';
    cards.forEach(c => {
      const el = document.createElement('div');
      el.className = 'mem-card' + (c.flipped || c.matched ? ' flipped' : '');
      el.innerHTML = `<div class="mem-card-inner">
        <div class="mem-card-front"></div>
        <div class="mem-card-back">${c.emoji}</div>
      </div>`;
      el.addEventListener('click', () => flip(c.id));
      grid.appendChild(el);
    });
  }

  function flip(id) {
    if (locked) return;
    const c = cards.find(x => x.id === id);
    if (c.flipped || c.matched) return;
    c.flipped = true;
    selected.push(c);
    render();
    if (selected.length === 2) {
      moves++;
      scoreEl.textContent = `Moves: ${moves}`;
      locked = true;
      setTimeout(() => {
        if (selected[0].emoji === selected[1].emoji) selected.forEach(x => x.matched = true);
        else selected.forEach(x => x.flipped = false);
        selected = [];
        locked   = false;
        render();
        if (cards.every(x => x.matched)) scoreEl.textContent = `🎉 Done in ${moves} moves!`;
      }, 900);
    }
  }

  render();
};

// ─── 4. BUBBLE POP ────────────────────────────────────────
GAMES.bubblePop = function (vp) {
  let score = 0, spawnTimer = null;

  vp.innerHTML = `
    <div class="game-title">Bubble Pop</div>
    <div class="game-subtitle">Pop bubbles before they escape!</div>
    <div class="game-score" id="bpScore">Score: 0</div>
    <div id="bubble-arena"></div>`;

  const arena   = vp.querySelector('#bubble-arena');
  const scoreEl = vp.querySelector('#bpScore');
  const EMOJIS  = ['😊', '🌟', '💎', '🎈', '🌈', '🍀', '✨', '🦋'];
  const COLORS  = ['#f7c948', '#64b5f6', '#81c784', '#ff8a65', '#ce93d8', '#7e91ff'];

  function spawnBubble() {
    const b    = document.createElement('div');
    b.className = 'bubble';
    const size = 44 + Math.random() * 32;
    b.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 85}%;
      background:${COLORS[Math.floor(Math.random() * COLORS.length)]};
      animation-duration:${3.5 + Math.random() * 2}s;`;
    b.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    b.addEventListener('click', () => { score++; scoreEl.textContent = `Score: ${score}`; b.remove(); });
    b.addEventListener('animationend', () => b.remove());
    arena.appendChild(b);
  }

  spawnBubble();
  spawnTimer = setInterval(spawnBubble, 1200);
  gameCleanup._fn = () => clearInterval(spawnTimer);
};

// ─── 5. BREATHING CLICK ───────────────────────────────────
GAMES.breathingClick = function (vp) {
  const PHASES = [
    { name: 'Breathe In',  duration: 4, cls: 'expand' },
    { name: 'Hold',        duration: 2, cls: 'expand' },
    { name: 'Breathe Out', duration: 4, cls: '' },
  ];
  let phaseIdx = 0, countdown = 0, running = false, interval = null, score = 0;

  vp.innerHTML = `
    <div class="game-title">Breathing Click</div>
    <div class="game-subtitle">Follow the breathing circle — tap to begin</div>
    <div id="breath-circle">Tap to start</div>
    <div class="game-score" id="bxScore"></div>`;

  const circle  = vp.querySelector('#breath-circle');
  const scoreEl = vp.querySelector('#bxScore');

  circle.addEventListener('click', () => { if (!running) { running = true; nextPhase(); } });

  function nextPhase() {
    const p = PHASES[phaseIdx % PHASES.length];
    circle.textContent = p.name;
    circle.className   = p.cls ? 'expand' : '';
    countdown          = p.duration;
    update(p.name, countdown);
    interval = setInterval(() => {
      countdown--;
      update(p.name, countdown);
      if (countdown <= 0) {
        clearInterval(interval);
        if (p.name === 'Breathe Out') score++;
        phaseIdx++;
        if (score >= 5) {
          circle.textContent  = '🌟 Well done!';
          circle.className    = '';
          scoreEl.textContent = '5 cycles complete!';
          running = false;
          return;
        }
        nextPhase();
      }
    }, 1000);
  }

  function update(name, cd) {
    scoreEl.textContent = `${name} — ${cd}s  |  Cycles: ${score}`;
  }

  gameCleanup._fn = () => clearInterval(interval);
};

// ─── 6. SLIDING PUZZLE ────────────────────────────────────
GAMES.slidingPuzzle = function (vp) {
  const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
  let tiles = [...EMOJIS, null], moves = 0;

  function shuffle() {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
  }
  shuffle();

  vp.innerHTML = `
    <div class="game-title">Sliding Puzzle</div>
    <div class="game-subtitle">Arrange 1–8 in order</div>
    <div class="puzzle-grid" id="puzzleGrid"></div>
    <div class="game-score" id="pzScore">Moves: 0</div>
    <button class="game-btn" id="pzReset">Shuffle</button>`;

  const grid    = vp.querySelector('#puzzleGrid');
  const scoreEl = vp.querySelector('#pzScore');

  function render() {
    grid.innerHTML = '';
    tiles.forEach((t, i) => {
      const tile = document.createElement('div');
      tile.className   = 'puzzle-tile' + (t === null ? ' empty' : '');
      tile.textContent = t || '';
      tile.addEventListener('click', () => tryMove(i));
      grid.appendChild(tile);
    });
  }

  function tryMove(i) {
    const blank = tiles.indexOf(null);
    const row   = x => Math.floor(x / 3);
    const col   = x => x % 3;
    const adj   = (row(i) === row(blank) && Math.abs(col(i) - col(blank)) === 1) ||
                  (col(i) === col(blank) && Math.abs(row(i) - row(blank)) === 1);
    if (!adj) return;
    [tiles[i], tiles[blank]] = [tiles[blank], tiles[i]];
    moves++;
    scoreEl.textContent = `Moves: ${moves}`;
    render();
    const goal = [...EMOJIS, null];
    if (tiles.every((t, idx) => t === goal[idx])) scoreEl.textContent = `🎉 Solved in ${moves} moves!`;
  }

  vp.querySelector('#pzReset').addEventListener('click', () => {
    tiles = [...EMOJIS, null];
    shuffle();
    moves = 0;
    scoreEl.textContent = 'Moves: 0';
    render();
  });

  render();
};

// ─── 7. QUICK TAP ─────────────────────────────────────────
GAMES.quickTap = function (vp) {
  let score = 0, timeLeft = 10, interval = null, running = false;

  vp.innerHTML = `
    <div class="game-title">Quick Tap</div>
    <div class="game-subtitle">Tap as fast as you can in 10 seconds!</div>
    <div class="game-score" id="qtScore">Score: 0 | Time: 10s</div>
    <div id="tap-target">TAP!</div>
    <button class="game-btn" id="qtStart">Start</button>`;

  const target   = vp.querySelector('#tap-target');
  const scoreEl  = vp.querySelector('#qtScore');
  const startBtn = vp.querySelector('#qtStart');

  target.addEventListener('click', () => {
    if (!running) return;
    score++;
    scoreEl.textContent     = `Score: ${score} | Time: ${timeLeft}s`;
    target.style.transform  = 'scale(0.92)';
    setTimeout(() => target.style.transform = '', 80);
  });

  startBtn.addEventListener('click', () => {
    score = 0; timeLeft = 10; running = true;
    startBtn.disabled = true;
    interval = setInterval(() => {
      timeLeft--;
      scoreEl.textContent = `Score: ${score} | Time: ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(interval);
        running = false;
        scoreEl.textContent  = `🎯 Final Score: ${score} taps!`;
        startBtn.disabled    = false;
        startBtn.textContent = 'Play Again';
      }
    }, 1000);
  });

  gameCleanup._fn = () => clearInterval(interval);
};

// ─── 8. RELAX RHYTHM ──────────────────────────────────────
GAMES.relaxRhythm = function (vp) {
  const PATTERN_LEN = 8;
  let interval = null, running = false, clicks = 0;

  vp.innerHTML = `
    <div class="game-title">Relax Rhythm</div>
    <div class="game-subtitle">Follow the pulse — click on each glow</div>
    <div id="rhythm-ring">Click to sync</div>
    <div class="rhythm-dots" id="rDots"></div>
    <div class="game-score" id="rrScore">Clicks: 0 / ${PATTERN_LEN}</div>
    <button class="game-btn" id="rrStart">Begin</button>`;

  const ring     = vp.querySelector('#rhythm-ring');
  const dotsEl   = vp.querySelector('#rDots');
  const scoreEl  = vp.querySelector('#rrScore');
  const startBtn = vp.querySelector('#rrStart');

  for (let i = 0; i < PATTERN_LEN; i++) {
    const d = document.createElement('div');
    d.className = 'rhythm-dot';
    dotsEl.appendChild(d);
  }

  function pulse() {
    ring.classList.add('pulse');
    ring.textContent = 'Tap!';
    setTimeout(() => { ring.classList.remove('pulse'); ring.textContent = 'Click to sync'; }, 600);
  }

  ring.addEventListener('click', () => {
    if (!running) return;
    clicks++;
    scoreEl.textContent = `Clicks: ${clicks} / ${PATTERN_LEN}`;
    const dots = dotsEl.querySelectorAll('.rhythm-dot');
    if (clicks <= PATTERN_LEN) dots[clicks - 1].classList.add('lit');
    if (clicks >= PATTERN_LEN) {
      clearInterval(interval);
      running             = false;
      ring.textContent    = '🌙 Relaxed!';
      scoreEl.textContent = 'Perfect rhythm completed!';
      startBtn.disabled   = false;
    }
  });

  startBtn.addEventListener('click', () => {
    clicks = 0; running = true;
    dotsEl.querySelectorAll('.rhythm-dot').forEach(d => d.classList.remove('lit'));
    scoreEl.textContent = `Clicks: 0 / ${PATTERN_LEN}`;
    startBtn.disabled   = true;
    clearInterval(interval);
    interval = setInterval(pulse, 1800);
    pulse();
  });

  gameCleanup._fn = () => clearInterval(interval);
};
