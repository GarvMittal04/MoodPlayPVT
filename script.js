'use strict';
/* ════════════════════════════════════════
   MOODPLAY v2 · script.js
   Auth · AI · Games · History · Analytics · Leaderboard
════════════════════════════════════════ */

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const MOOD_META = {
  happy:   { emoji:'😄', label:'Happy',   color:'#f7c948', spotify:'37i9dQZF1DXdPec7aLTmlC' },
  sad:     { emoji:'😢', label:'Sad',     color:'#64b5f6', spotify:'37i9dQZF1DX2pSTOxoPbx9' },
  stressed:{ emoji:'😰', label:'Stressed',color:'#81c784', spotify:'37i9dQZF1DWXe9gFZP0gtP' },
  bored:   { emoji:'😑', label:'Bored',   color:'#ff8a65', spotify:'37i9dQZF1DX1lVhptIYRda' },
  tired:   { emoji:'😴', label:'Tired',   color:'#ce93d8', spotify:'37i9dQZF1DWZd79rJ6a7lp' },
};
const MOOD_GAMES = {
  happy:   { games:['reactionSpeed','colorMatch'],   labels:['Reaction Speed','Color Match'] },
  sad:     { games:['slidingPuzzle','bubblePop'],     labels:['Simple Puzzle','Calm Bubble Pop'] },
  stressed:{ games:['breathingClick','bubblePop'],   labels:['Breathing Game','Bubble Pop'] },
  bored:   { games:['memoryMatch','quickTap'],        labels:['Memory Match','Quick Tap'] },
  tired:   { games:['slidingPuzzle','relaxRhythm'],  labels:['Slow Puzzle','Relax Rhythm'] },
};
const GAME_NAMES = { reactionSpeed:'Reaction Speed', colorMatch:'Color Match', slidingPuzzle:'Sliding Puzzle', bubblePop:'Bubble Pop', breathingClick:'Breathing Click', memoryMatch:'Memory Match', quickTap:'Quick Tap', relaxRhythm:'Relax Rhythm' };

// ─────────────────────────────────────────
// DATABASE (localStorage)
// ─────────────────────────────────────────
const DB = {
  get users()    { return JSON.parse(localStorage.getItem('mp_users') || '{}'); },
  setUsers(v)    { localStorage.setItem('mp_users', JSON.stringify(v)); },
  get sessions() { return JSON.parse(localStorage.getItem('mp_sessions') || '[]'); },
  setSessions(v) { localStorage.setItem('mp_sessions', JSON.stringify(v)); },
  get scores()   { return JSON.parse(localStorage.getItem('mp_scores') || '[]'); },
  setScores(v)   { localStorage.setItem('mp_scores', JSON.stringify(v)); },
  get apiKey()   { return localStorage.getItem('mp_apikey') || ''; },
  setApiKey(v)   { localStorage.setItem('mp_apikey', v); },
  get curUser()  { return localStorage.getItem('mp_cur') || null; },
  setCurUser(v)  { v ? localStorage.setItem('mp_cur', v) : localStorage.removeItem('mp_cur'); },
};

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let currentMood     = null;
let activeTab       = 1;
let gameCleanup     = null;
let detectedMood    = null;
let lbMode          = 'all';
let chartInstances  = {};

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

// ─────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────
const NAV_PAGES = ['page-history','page-analytics','page-leaderboard','page-mood'];

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.remove('nav-offset');
  });
  const pg = document.getElementById(id);
  pg.classList.add('active');
  if (DB.curUser && NAV_PAGES.includes(id)) pg.classList.add('nav-offset');

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === id);
  });

  // Trigger page init
  if (id === 'page-history')    renderHistory();
  if (id === 'page-analytics')  initAnalytics();
  if (id === 'page-leaderboard') renderLeaderboard();
}

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────
function hashPw(user, pw) { return btoa(user + ':' + pw + ':mp2024'); }

function login(username, password) {
  const users = DB.users;
  if (!users[username]) { toast('User not found', 'error'); return; }
  if (users[username].pw !== hashPw(username, password)) { toast('Wrong password', 'error'); return; }
  DB.setCurUser(username);
  onLoggedIn();
}

function register(username, password, confirm) {
  if (!username.trim()) { toast('Enter a username', 'error'); return; }
  if (username.length < 3) { toast('Username must be 3+ chars', 'error'); return; }
  if (password.length < 4) { toast('Password must be 4+ chars', 'error'); return; }
  if (password !== confirm) { toast('Passwords do not match', 'error'); return; }
  const users = DB.users;
  if (users[username]) { toast('Username taken', 'error'); return; }
  users[username] = { pw: hashPw(username, password), createdAt: Date.now() };
  DB.setUsers(users);
  DB.setCurUser(username);
  toast('Account created! 🎉', 'success');
  onLoggedIn();
}

function logout() {
  stopGame();
  DB.setCurUser(null);
  document.body.className = '';
  document.getElementById('app-nav').classList.add('hidden');
  document.getElementById('spotifyPlayer').src = '';
  showPage('page-landing');
}

function onLoggedIn() {
  const user = DB.curUser;
  document.getElementById('nav-user-badge').textContent = '👤 ' + user;
  document.getElementById('mood-greeting').textContent = 'Hey ' + user + ', how are you feeling?';
  document.getElementById('app-nav').classList.remove('hidden');
  showPage('page-mood');
}

// ─────────────────────────────────────────
// AI MOOD DETECTION
// ─────────────────────────────────────────
async function detectMoodAI() {
  const text = document.getElementById('ai-input').value.trim();
  if (!text) { toast('Please describe how you feel', 'error'); return; }
  const apiKey = DB.apiKey;
  if (!apiKey) { toast('Add your Anthropic API key in ⚙️ Settings', 'error'); return; }

  const btn  = document.getElementById('btn-ai-detect');
  const bTxt = document.getElementById('ai-btn-text');
  btn.disabled = true;
  bTxt.textContent = '🔍 Detecting…';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: 'You are a mood detection assistant. Analyze the user\'s text and return ONLY valid JSON (no markdown, no code blocks): {"mood":"<happy|sad|stressed|bored|tired>","confidence":<0-100>,"reason":"<one sentence>"}',
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'API error ' + res.status); }
    const data = await res.json();
    let raw = data.content.map(c => c.text || '').join('').trim();
    // Strip any markdown code fences
    raw = raw.replace(/```[a-z]*\n?/g,'').replace(/```/g,'').trim();
    const parsed = JSON.parse(raw);
    if (!MOOD_META[parsed.mood]) throw new Error('Unknown mood: ' + parsed.mood);
    detectedMood = parsed.mood;
    const meta = MOOD_META[parsed.mood];
    document.getElementById('ai-result-emoji').textContent = meta.emoji;
    document.getElementById('ai-result-name').textContent  = meta.label;
    document.getElementById('ai-result-reason').textContent= parsed.reason;
    document.getElementById('ai-result-conf').textContent  = `Confidence: ${parsed.confidence}%`;
    document.getElementById('ai-result').classList.remove('hidden');
    toast('Mood detected: ' + meta.label + ' ' + meta.emoji, 'success');
  } catch (err) {
    toast('Detection failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    bTxt.textContent = '✨ Detect My Mood';
  }
}

// ─────────────────────────────────────────
// SELECT MOOD & START SESSION
// ─────────────────────────────────────────
function selectMood(mood, method = 'manual', aiReason = '') {
  currentMood = mood;
  const meta = MOOD_META[mood];
  const games = MOOD_GAMES[mood];

  // Record session
  const sessions = DB.sessions;
  sessions.push({ username: DB.curUser, mood, timestamp: Date.now(), method, aiReason });
  DB.setSessions(sessions);

  // Apply accent
  document.body.className = 'mood-' + mood;

  // Badge
  document.getElementById('activeMoodBadge').textContent = meta.emoji + ' ' + meta.label;

  // Tab labels
  document.getElementById('tab1Btn').textContent = games.labels[0];
  document.getElementById('tab2Btn').textContent = games.labels[1];
  document.getElementById('tab1Btn').classList.add('active');
  document.getElementById('tab2Btn').classList.remove('active');

  // Spotify
  document.getElementById('spotifyPlayer').src =
    `https://open.spotify.com/embed/playlist/${meta.spotify}?utm_source=generator&theme=0`;

  // Load game 1
  activeTab = 1;
  loadGame(games.games[0]);

  showPage('page-games');
}

function switchTab(n) {
  activeTab = n;
  document.getElementById('tab1Btn').classList.toggle('active', n === 1);
  document.getElementById('tab2Btn').classList.toggle('active', n === 2);
  stopGame();
  loadGame(MOOD_GAMES[currentMood].games[n - 1]);
}

// ─────────────────────────────────────────
// SCORE RECORDING
// ─────────────────────────────────────────
function recordScore(game, score) {
  const user = DB.curUser;
  if (!user || score <= 0) return;
  const s = DB.scores;
  s.push({ username: user, game, score, timestamp: Date.now() });
  DB.setScores(s);
}

// ─────────────────────────────────────────
// GAME ENGINE
// ─────────────────────────────────────────
function stopGame() {
  if (typeof gameCleanup === 'function') { gameCleanup(); gameCleanup = null; }
}
function loadGame(name) {
  stopGame();
  const vp = document.getElementById('gameViewport');
  vp.innerHTML = '';
  GAMES[name](vp);
}

const GAMES = {};

/* ── 1. REACTION SPEED ── */
GAMES.reactionSpeed = function(vp) {
  let state = 'idle', t0 = 0, timer = null;
  vp.innerHTML = `<div class="game-title">Reaction Speed</div><div class="game-subtitle">Click when the box turns yellow!</div><div id="reaction-box">Click to Start</div><div class="game-score" id="rx-score"></div>`;
  const box = vp.querySelector('#reaction-box');
  const sc  = vp.querySelector('#rx-score');
  box.addEventListener('click', function() {
    if (state === 'idle' || state === 'result') {
      state = 'wait'; box.textContent = 'Wait…'; box.className = 'wait'; sc.textContent = '';
      timer = setTimeout(function() {
        state = 'go'; box.textContent = 'NOW!'; box.className = 'go'; t0 = Date.now();
      }, 1500 + Math.random() * 3000);
    } else if (state === 'wait') {
      clearTimeout(timer); state = 'result';
      box.textContent = '😬 Too early! Click to retry'; box.className = '';
    } else if (state === 'go') {
      const ms = Date.now() - t0; state = 'result';
      box.className = ''; box.textContent = ms + ' ms — Click to retry';
      const pts = Math.max(1000 - ms, 0);
      const rank = ms < 200 ? '⚡ Lightning!' : ms < 350 ? '🔥 Fast!' : ms < 500 ? '👍 Good' : '🐢 Try again';
      sc.textContent = rank + ' (Score: ' + Math.round(pts) + ')';
      recordScore('reactionSpeed', Math.round(pts));
    }
  });
  gameCleanup = function() { clearTimeout(timer); };
};

/* ── 2. COLOR MATCH ── */
GAMES.colorMatch = function(vp) {
  const COLORS = [
    {name:'Red',hex:'#e74c3c'},{name:'Blue',hex:'#3498db'},{name:'Green',hex:'#2ecc71'},
    {name:'Yellow',hex:'#f1c40f'},{name:'Purple',hex:'#9b59b6'},{name:'Orange',hex:'#e67e22'},
  ];
  let score = 0, lives = 3, target;
  vp.innerHTML = `<div class="game-title">Color Match</div><div class="game-subtitle">Tap the circle matching the colour above</div><div class="color-match-target" id="cm-t"></div><div class="color-match-options" id="cm-o"><button></button><button></button><button></button><button></button></div><div class="game-score" id="cm-s">Score: 0  ❤️ 3</div>`;
  const tgt  = vp.querySelector('#cm-t');
  const opts = vp.querySelectorAll('#cm-o button');
  const sc   = vp.querySelector('#cm-s');
  function pick() {
    const pool = [...COLORS].sort(()=>Math.random()-.5).slice(0,4);
    target = pool[Math.floor(Math.random()*4)];
    tgt.style.background = target.hex;
    opts.forEach(function(b,i){b.style.background=pool[i].hex;b.dataset.c=pool[i].name;});
    sc.textContent = 'Score: '+score+'  ❤️ '+lives;
  }
  opts.forEach(function(b){
    b.addEventListener('click', function(){
      if(lives<=0) return;
      if(b.dataset.c===target.name){ score++; sc.textContent='✅ Correct!'; }
      else{ lives--; if(lives<=0){sc.textContent='💀 Game Over! Score: '+score; recordScore('colorMatch',score); return;} sc.textContent='❌ Nope! Lives: '+lives; }
      setTimeout(pick,550);
    });
  });
  pick();
};

/* ── 3. MEMORY MATCH ── */
GAMES.memoryMatch = function(vp) {
  const ICONS = ['🌸','🦋','🌙','⭐','🍀','🌈','🎵','🦄'];
  const deck  = [...ICONS,...ICONS].sort(()=>Math.random()-.5);
  let flipped=[], matched=0, locked=false, moves=0;
  vp.innerHTML = `<div class="game-title">Memory Match</div><div class="game-subtitle">Find all 8 matching pairs</div><div class="memory-grid" id="mm-g"></div><div class="game-score" id="mm-s">Moves: 0</div>`;
  const grid = vp.querySelector('#mm-g');
  const sc   = vp.querySelector('#mm-s');
  deck.forEach(function(icon,i){
    const c = document.createElement('div');
    c.className='mem-card';
    c.innerHTML='<div class="mem-card-inner"><div class="mem-card-front">?</div><div class="mem-card-back">'+icon+'</div></div>';
    c.dataset.icon=icon;
    c.addEventListener('click', function(){
      if(locked||c.classList.contains('flipped')||c.dataset.done) return;
      c.classList.add('flipped'); flipped.push(c);
      if(flipped.length===2){
        locked=true; moves++; sc.textContent='Moves: '+moves;
        const[a,b]=flipped;
        if(a.dataset.icon===b.dataset.icon){
          a.dataset.done=b.dataset.done='1'; matched++; flipped=[]; locked=false;
          if(matched===ICONS.length){ sc.textContent='🎉 Solved in '+moves+' moves!'; recordScore('memoryMatch',Math.max(200-moves,10)); }
        } else {
          setTimeout(function(){a.classList.remove('flipped');b.classList.remove('flipped');flipped=[];locked=false;},900);
        }
      }
    });
    grid.appendChild(c);
  });
};

/* ── 4. BUBBLE POP ── */
GAMES.bubblePop = function(vp) {
  let score=0, spawnId=null;
  const COLORS=['#f7c948','#64b5f6','#81c784','#ff8a65','#ce93d8','#7e91ff'];
  const ICONS=['🫧','✨','💫','🌟','🎈'];
  vp.innerHTML = `<div class="game-title">Bubble Pop</div><div class="game-subtitle">Pop them before they escape! 30s challenge</div><div class="game-score" id="bp-s">Score: 0</div><div id="bubble-arena"></div>`;
  const arena=vp.querySelector('#bubble-arena');
  const sc   =vp.querySelector('#bp-s');
  let timeLeft=30, timerEl=null;
  function spawn(){
    const sz=42+Math.random()*36;
    const b=document.createElement('div');
    b.className='bubble';
    b.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(5+Math.random()*82)+'%;background:'+COLORS[Math.floor(Math.random()*COLORS.length)]+';animation-duration:'+(2.5+Math.random()*2.5)+'s';
    b.textContent=ICONS[Math.floor(Math.random()*ICONS.length)];
    b.addEventListener('click',function(e){e.stopPropagation();score++;sc.textContent='Score: '+score+' | Time: '+timeLeft+'s';b.remove();});
    b.addEventListener('animationend',function(){b.remove();});
    arena.appendChild(b);
  }
  spawn(); spawnId=setInterval(spawn,1000);
  timerEl=setInterval(function(){
    timeLeft--;
    sc.textContent='Score: '+score+' | Time: '+timeLeft+'s';
    if(timeLeft<=0){clearInterval(spawnId);clearInterval(timerEl);sc.textContent='🎯 Final: '+score+' pops!';recordScore('bubblePop',score);}
  },1000);
  gameCleanup=function(){clearInterval(spawnId);clearInterval(timerEl);};
};

/* ── 5. BREATHING CLICK ── */
GAMES.breathingClick = function(vp) {
  const PHASES=[{name:'Breathe In',secs:4,expand:true},{name:'Hold',secs:2,expand:true},{name:'Breathe Out',secs:4,expand:false}];
  let running=false,pi=0,cd=0,cycles=0,ivl=null;
  vp.innerHTML=`<div class="game-title">Breathing Game</div><div class="game-subtitle">Follow the circle — tap to begin</div><div id="breath-circle">Tap to start</div><div class="game-score" id="br-s"></div>`;
  const orb=vp.querySelector('#breath-circle');
  const sc =vp.querySelector('#br-s');
  function nextPhase(){
    const p=PHASES[pi%PHASES.length];
    orb.textContent=p.name; orb.className=p.expand?'expand':''; cd=p.secs;
    sc.textContent=p.name+' — '+cd+'s  |  Cycles: '+cycles;
    ivl=setInterval(function(){
      cd--; sc.textContent=p.name+' — '+cd+'s  |  Cycles: '+cycles;
      if(cd<=0){
        clearInterval(ivl);
        if(p.name==='Breathe Out'){cycles++; recordScore('breathingClick',cycles*20);}
        pi++;
        if(cycles>=5){orb.textContent='🌟 5 Cycles!';orb.className='';sc.textContent='Amazing! You completed 5 breath cycles.';running=false;return;}
        nextPhase();
      }
    },1000);
  }
  orb.addEventListener('click',function(){if(!running){running=true;nextPhase();}});
  gameCleanup=function(){clearInterval(ivl);};
};

/* ── 6. SLIDING PUZZLE ── */
GAMES.slidingPuzzle = function(vp) {
  const EM=['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
  let tiles=[...EM,null], moves=0;
  function shuffle(){for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}moves=0;}
  vp.innerHTML=`<div class="game-title">Sliding Puzzle</div><div class="game-subtitle">Arrange 1–8 in order</div><div class="puzzle-grid" id="pz-g"></div><div class="game-score" id="pz-s">Moves: 0</div><button class="game-btn" id="pz-r">Shuffle</button>`;
  const grid=vp.querySelector('#pz-g');
  const sc  =vp.querySelector('#pz-s');
  function render(){
    grid.innerHTML='';
    tiles.forEach(function(t,i){
      const d=document.createElement('div');
      d.className='puzzle-tile '+(t===null?'empty':'');
      d.textContent=t||'';
      d.addEventListener('click',function(){
        const blank=tiles.indexOf(null);
        const row=n=>Math.floor(n/3), col=n=>n%3;
        if((row(i)===row(blank)&&Math.abs(col(i)-col(blank))===1)||(col(i)===col(blank)&&Math.abs(row(i)-row(blank))===1)){
          [tiles[i],tiles[blank]]=[tiles[blank],tiles[i]]; moves++;
          sc.textContent='Moves: '+moves; render();
          if(tiles.every((t,i)=>t===[...EM,null][i])){sc.textContent='🎉 Solved in '+moves+' moves!';recordScore('slidingPuzzle',Math.max(200-moves,5));}
        }
      });
      grid.appendChild(d);
    });
  }
  vp.querySelector('#pz-r').addEventListener('click',function(){shuffle();render();sc.textContent='Moves: 0';});
  shuffle(); render();
};

/* ── 7. QUICK TAP ── */
GAMES.quickTap = function(vp) {
  let score=0,timeLeft=10,ivl=null,running=false;
  vp.innerHTML=`<div class="game-title">Quick Tap</div><div class="game-subtitle">Tap as fast as you can in 10 seconds!</div><div class="game-score" id="qt-s">Score: 0 · Time: 10s</div><div id="tap-target">TAP!</div><button class="game-btn" id="qt-start">Start</button>`;
  const tgt  =vp.querySelector('#tap-target');
  const sc   =vp.querySelector('#qt-s');
  const startB=vp.querySelector('#qt-start');
  tgt.addEventListener('click',function(){
    if(!running) return;
    score++; sc.textContent='Score: '+score+' · Time: '+timeLeft+'s';
  });
  startB.addEventListener('click',function(){
    score=0;timeLeft=10;running=true;startB.disabled=true;
    sc.textContent='Score: 0 · Time: 10s';
    ivl=setInterval(function(){
      timeLeft--; sc.textContent='Score: '+score+' · Time: '+timeLeft+'s';
      if(timeLeft<=0){clearInterval(ivl);running=false;sc.textContent='🎯 Final: '+score+' taps!';recordScore('quickTap',score);startB.disabled=false;startB.textContent='Play Again';}
    },1000);
  });
  gameCleanup=function(){clearInterval(ivl);};
};

/* ── 8. RELAX RHYTHM ── */
GAMES.relaxRhythm = function(vp) {
  const TOTAL=8; let clicks=0,running=false,ivl=null;
  vp.innerHTML=`<div class="game-title">Relax Rhythm</div><div class="game-subtitle">Click on every glow — follow the pulse</div><div id="rhythm-ring">Press Begin</div><div class="rhythm-dots" id="rh-d"></div><div class="game-score" id="rh-s">0 / ${TOTAL}</div><button class="game-btn" id="rh-start">Begin</button>`;
  const ring =vp.querySelector('#rhythm-ring');
  const dots =vp.querySelector('#rh-d');
  const sc   =vp.querySelector('#rh-s');
  const startB=vp.querySelector('#rh-start');
  for(let i=0;i<TOTAL;i++){const d=document.createElement('div');d.className='rhythm-dot';dots.appendChild(d);}
  function pulse(){ring.classList.add('pulse');ring.textContent='Tap ✨';setTimeout(function(){ring.classList.remove('pulse');ring.textContent='Wait…';},650);}
  ring.addEventListener('click',function(){
    if(!running) return;
    clicks++; sc.textContent=clicks+' / '+TOTAL;
    dots.querySelectorAll('.rhythm-dot')[clicks-1]?.classList.add('lit');
    if(clicks>=TOTAL){clearInterval(ivl);running=false;ring.textContent='🌙 Zen!';sc.textContent='Perfect rhythm complete!';recordScore('relaxRhythm',TOTAL*10);startB.disabled=false;startB.textContent='Again';}
  });
  startB.addEventListener('click',function(){
    clicks=0;running=true;dots.querySelectorAll('.rhythm-dot').forEach(d=>d.classList.remove('lit'));
    sc.textContent='0 / '+TOTAL;startB.disabled=true;clearInterval(ivl);ivl=setInterval(pulse,1800);pulse();
  });
  gameCleanup=function(){clearInterval(ivl);};
};

// ─────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────
function renderHistory() {
  const user   = DB.curUser;
  const filter = document.getElementById('history-filter').value;
  let items = DB.sessions
    .filter(s => s.username === user && (filter === 'all' || s.mood === filter))
    .slice().reverse();

  const list = document.getElementById('history-list');
  if (!items.length) {
    list.innerHTML = '<div class="history-empty">No sessions yet. Start playing! 🎮</div>';
    return;
  }

  // Get scores for each session (by timestamp proximity)
  list.innerHTML = items.map(function(s) {
    const meta = MOOD_META[s.mood];
    const dt   = new Date(s.timestamp);
    const dateStr = dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' · ' + dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const reason = s.aiReason ? `<div style="font-size:.75rem;color:var(--muted);margin-top:3px">💬 ${s.aiReason}</div>` : '';
    return `<div class="history-item">
      <div class="hi-emoji">${meta.emoji}</div>
      <div class="hi-info">
        <div class="hi-mood">${meta.label}</div>
        <div class="hi-date">${dateStr}</div>
        ${reason}
      </div>
      <div>
        <span class="hi-badge ${s.method}">${s.method === 'ai' ? '🤖 AI' : '🖱️ Manual'}</span>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────
function getStreak(username) {
  const sessions = DB.sessions.filter(s => s.username === username);
  if (!sessions.length) return 0;
  const dates = [...new Set(sessions.map(s => new Date(s.timestamp).toISOString().split('T')[0]))].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i-1]) - new Date(dates[i])) / 86400000;
    if (diff === 1) streak++; else break;
  }
  return streak;
}

function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  chartInstances = {};
}

function initAnalytics() {
  destroyCharts();
  const user     = DB.curUser;
  const sessions = DB.sessions.filter(s => s.username === user);
  const scores   = DB.scores.filter(s => s.username === user);

  // Fav mood
  const moodCounts = {};
  sessions.forEach(s => { moodCounts[s.mood] = (moodCounts[s.mood]||0)+1; });
  const favMood = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0];
  const favMeta = favMood ? MOOD_META[favMood[0]] : null;

  // Best score
  const bestScore = scores.length ? Math.max(...scores.map(s=>s.score)) : 0;

  // Stats grid
  document.getElementById('stats-grid').innerHTML = [
    {val: sessions.length,                             label: 'Total Sessions'},
    {val: favMeta ? favMeta.emoji+' '+favMeta.label : '—', label: 'Favourite Mood'},
    {val: getStreak(user) + ' 🔥',                    label: 'Day Streak'},
    {val: bestScore,                                   label: 'Best Score'},
  ].map(s=>`<div class="stat-card"><div class="stat-value">${s.val}</div><div class="stat-label">${s.label}</div></div>`).join('');

  // Chart 1: Mood donut
  const moods = Object.keys(MOOD_META);
  const moodData   = moods.map(m => moodCounts[m]||0);
  const moodColors = moods.map(m => MOOD_META[m].color);
  const ctx1 = document.getElementById('chart-mood-donut').getContext('2d');
  chartInstances.donut = new Chart(ctx1, {
    type: 'doughnut',
    data: { labels: moods.map(m=>MOOD_META[m].label+' '+MOOD_META[m].emoji), datasets:[{ data:moodData, backgroundColor:moodColors, borderColor:'rgba(0,0,0,0.2)', borderWidth:2 }] },
    options: { responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'rgba(232,234,246,0.7)', font:{family:'Nunito',size:11} } }, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.parsed} sessions` } } }, cutout:'62%' }
  });

  // Chart 2: Weekly sessions bar
  const days7 = Array.from({length:7}, (_,i) => {
    const d = new Date(Date.now() - (6-i)*86400000);
    return { key: d.toISOString().split('T')[0], label: d.toLocaleDateString('en-US',{weekday:'short'}) };
  });
  const weekData = days7.map(d => sessions.filter(s => new Date(s.timestamp).toISOString().split('T')[0]===d.key).length);
  const ctx2 = document.getElementById('chart-weekly').getContext('2d');
  chartInstances.weekly = new Chart(ctx2, {
    type: 'bar',
    data: { labels: days7.map(d=>d.label), datasets:[{ label:'Sessions', data:weekData, backgroundColor:'rgba(247,201,72,0.6)', borderColor:'#f7c948', borderWidth:1, borderRadius:8 }] },
    options: { responsive:true, scales:{ x:{ticks:{color:'rgba(232,234,246,0.6)',font:{family:'Nunito'}},grid:{color:'rgba(255,255,255,0.04)'}}, y:{ticks:{color:'rgba(232,234,246,0.6)',font:{family:'Nunito'},stepSize:1},grid:{color:'rgba(255,255,255,0.06)'}} }, plugins:{ legend:{display:false} } }
  });

  // Chart 3: Game avg scores
  const gameKeys = Object.keys(GAME_NAMES);
  const avgScores = gameKeys.map(function(g) {
    const gs = scores.filter(s=>s.game===g);
    return gs.length ? Math.round(gs.reduce((a,b)=>a+b.score,0)/gs.length) : 0;
  });
  const ctx3 = document.getElementById('chart-games').getContext('2d');
  chartInstances.games = new Chart(ctx3, {
    type: 'bar',
    data: { labels: gameKeys.map(g=>GAME_NAMES[g]), datasets:[{ label:'Avg Score', data:avgScores, backgroundColor:['rgba(247,201,72,.6)','rgba(247,201,72,.5)','rgba(100,181,246,.6)','rgba(100,181,246,.5)','rgba(129,199,132,.6)','rgba(255,138,101,.6)','rgba(255,138,101,.5)','rgba(206,147,216,.6)'], borderRadius:8 }] },
    options: { responsive:true, indexAxis:'y', scales:{ x:{ticks:{color:'rgba(232,234,246,0.6)',font:{family:'Nunito'}},grid:{color:'rgba(255,255,255,0.06)'}}, y:{ticks:{color:'rgba(232,234,246,0.7)',font:{family:'Nunito',size:11}},grid:{color:'rgba(255,255,255,0.04)'}} }, plugins:{ legend:{display:false} } }
  });
}

// ─────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────
function getLeaderboardData(mode) {
  const sessions = DB.sessions;
  const scores   = DB.scores;
  const users    = DB.users;
  const curUser  = DB.curUser;

  let filteredScores = scores;
  let filteredSessions = sessions;
  if (mode === 'week') {
    const weekAgo = Date.now() - 7*86400000;
    filteredScores   = scores.filter(s=>s.timestamp>weekAgo);
    filteredSessions = sessions.filter(s=>s.timestamp>weekAgo);
  }

  const data = {};
  Object.keys(users).forEach(function(u) {
    const us = filteredScores.filter(s=>s.username===u);
    const sess = filteredSessions.filter(s=>s.username===u);
    const moodC = {};
    sess.forEach(s=>{moodC[s.mood]=(moodC[s.mood]||0)+1;});
    const fav = Object.entries(moodC).sort((a,b)=>b[1]-a[1])[0];
    data[u] = {
      username: u,
      totalScore: us.reduce((a,b)=>a+b.score,0),
      gamesPlayed: us.length,
      favMood: fav ? MOOD_META[fav[0]].emoji : '—',
      isMe: u === curUser,
    };
  });

  return Object.values(data).filter(d=>d.gamesPlayed>0).sort((a,b)=>b.totalScore-a.totalScore);
}

function renderLeaderboard() {
  const data = getLeaderboardData(lbMode);
  const table = document.getElementById('lb-table');
  if (!data.length) {
    table.innerHTML = '<div class="lb-empty">No scores yet — play some games to appear here! 🎮</div>';
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  const classes = ['gold','silver','bronze'];
  table.innerHTML = data.map(function(d,i) {
    const rankDisp = i<3 ? `<span class="lb-rank ${classes[i]}">${medals[i]}</span>` : `<span class="lb-rank">#${i+1}</span>`;
    const letter = d.username.charAt(0).toUpperCase();
    return `<div class="lb-row${d.isMe?' me':''}">
      ${rankDisp}
      <div class="lb-avatar">${letter}</div>
      <div class="lb-info">
        <div class="lb-username">${d.username}${d.isMe?' (you)':''}</div>
        <div class="lb-sub">🕹️ ${d.gamesPlayed} games · ${d.favMood} fav mood</div>
      </div>
      <div>
        <div class="lb-score">${d.totalScore.toLocaleString()}</div>
        <div class="lb-score-sub">total score</div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// BACKGROUND ORBS
// ─────────────────────────────────────────
(function initOrbs() {
  const container = document.getElementById('bgOrbs');
  const palette   = ['#f7c948','#64b5f6','#81c784','#ff8a65','#ce93d8','#7e91ff'];
  for (let i = 0; i < 7; i++) {
    const orb  = document.createElement('div');
    orb.className = 'orb';
    const size = 220 + Math.random()*300;
    orb.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;background:${palette[i%palette.length]};animation-delay:${Math.random()*8}s;animation-duration:${14+Math.random()*12}s;`;
    container.appendChild(orb);
  }
})();

// ─────────────────────────────────────────
// DOM READY — BIND ALL EVENTS
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // ── Landing ──
  document.getElementById('btn-landing-start').addEventListener('click', function() {
    if (DB.curUser) showPage('page-mood'); else showPage('page-auth');
  });

  // ── Auth tabs ──
  document.getElementById('auth-tab-login').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('auth-tab-register').classList.remove('active');
    document.getElementById('auth-form-login').classList.remove('hidden');
    document.getElementById('auth-form-register').classList.add('hidden');
  });
  document.getElementById('auth-tab-register').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('auth-tab-login').classList.remove('active');
    document.getElementById('auth-form-register').classList.remove('hidden');
    document.getElementById('auth-form-login').classList.add('hidden');
  });
  document.getElementById('switch-to-register').addEventListener('click', function() { document.getElementById('auth-tab-register').click(); });
  document.getElementById('switch-to-login').addEventListener('click', function() { document.getElementById('auth-tab-login').click(); });

  // ── Login ──
  document.getElementById('btn-login').addEventListener('click', function() {
    login(document.getElementById('login-username').value.trim(), document.getElementById('login-password').value);
  });
  document.getElementById('login-password').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('btn-login').click(); });

  // ── Register ──
  document.getElementById('btn-register').addEventListener('click', function() {
    register(document.getElementById('reg-username').value.trim(), document.getElementById('reg-password').value, document.getElementById('reg-confirm').value);
  });

  // ── Nav buttons ──
  document.querySelectorAll('.nav-btn[data-page]').forEach(function(b) {
    b.addEventListener('click', function() { showPage(b.dataset.page); });
  });
  document.getElementById('nav-logout').addEventListener('click', logout);
  document.getElementById('nav-settings').addEventListener('click', function() {
    document.getElementById('api-key-input').value = DB.apiKey;
    document.getElementById('settings-modal').classList.remove('hidden');
  });

  // ── Mood detection tabs ──
  document.getElementById('dtab-manual').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('dtab-ai').classList.remove('active');
    document.getElementById('detect-manual').classList.remove('hidden');
    document.getElementById('detect-ai').classList.add('hidden');
  });
  document.getElementById('dtab-ai').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('dtab-manual').classList.remove('active');
    document.getElementById('detect-ai').classList.remove('hidden');
    document.getElementById('detect-manual').classList.add('hidden');
  });

  // ── Mood cards ──
  document.querySelectorAll('.mood-card').forEach(function(card) {
    card.addEventListener('click', function() { selectMood(card.dataset.mood, 'manual'); });
  });

  // ── AI detect ──
  document.getElementById('btn-ai-detect').addEventListener('click', detectMoodAI);
  document.getElementById('btn-ai-confirm').addEventListener('click', function() {
    if (detectedMood) {
      const reason = document.getElementById('ai-result-reason').textContent;
      selectMood(detectedMood, 'ai', reason);
    }
  });

  // ── Games back button ──
  document.getElementById('btn-back-games').addEventListener('click', function() {
    stopGame();
    document.getElementById('spotifyPlayer').src = '';
    showPage('page-mood');
  });

  // ── Game tabs ──
  document.getElementById('tab1Btn').addEventListener('click', function() { switchTab(1); });
  document.getElementById('tab2Btn').addEventListener('click', function() { switchTab(2); });

  // ── History filter ──
  document.getElementById('history-filter').addEventListener('change', renderHistory);

  // ── Leaderboard tabs ──
  document.getElementById('lb-tab-all').addEventListener('click', function() {
    lbMode='all'; this.classList.add('active'); document.getElementById('lb-tab-week').classList.remove('active'); renderLeaderboard();
  });
  document.getElementById('lb-tab-week').addEventListener('click', function() {
    lbMode='week'; this.classList.add('active'); document.getElementById('lb-tab-all').classList.remove('active'); renderLeaderboard();
  });

  // ── Settings modal ──
  document.getElementById('modal-close').addEventListener('click', function() { document.getElementById('settings-modal').classList.add('hidden'); });
  document.getElementById('settings-modal').addEventListener('click', function(e) { if(e.target===this) this.classList.add('hidden'); });
  document.getElementById('btn-save-key').addEventListener('click', function() {
    const key = document.getElementById('api-key-input').value.trim();
    DB.setApiKey(key);
    toast(key ? 'API key saved ✅' : 'API key cleared', 'success');
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.getElementById('btn-clear-data').addEventListener('click', function() {
    if (confirm('Delete all YOUR sessions and scores? This cannot be undone.')) {
      const user = DB.curUser;
      DB.setSessions(DB.sessions.filter(s=>s.username!==user));
      DB.setScores(DB.scores.filter(s=>s.username!==user));
      toast('Your data cleared', 'info');
      document.getElementById('settings-modal').classList.add('hidden');
    }
  });

  // ── Auto-login if session persists ──
  if (DB.curUser) { onLoggedIn(); }
});
