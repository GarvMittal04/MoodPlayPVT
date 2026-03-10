/* ========================================
   MOODPLAY — script.js
   Firebase Realtime Database backend
   ======================================== */

// ── Gemini API key (replace with yours from aistudio.google.com) ──
const GEMINI_API_KEY = 'AIzaSyDemo_replace_with_your_key';

// ── Firebase DB reference (firebase initialised in index.html) ──
const db = firebase.database();

// ============================================================
//  MOOD DATA
// ============================================================
const MOODS = {
  happy:   { emoji:'😄', label:'Happy',   color:'#f7c948', ytSrc:'https://www.youtube.com/embed/JdqL89ZZwFw?autoplay=1',   games:['reactionSpeed','colorMatch'],   gameLabels:['Reaction Speed','Color Match']  },
  sad:     { emoji:'😢', label:'Sad',     color:'#64b5f6', ytSrc:'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1',   games:['slidingPuzzle','bubblePop'],    gameLabels:['Simple Puzzle','Calm Bubbles'] },
  stressed:{ emoji:'😰', label:'Stressed',color:'#81c784', ytSrc:'https://www.youtube.com/embed/lFcSrYw-ARY?autoplay=1',   games:['breathingClick','bubblePop'],   gameLabels:['Breathing Click','Bubble Relax'] },
  bored:   { emoji:'😑', label:'Bored',   color:'#ff8a65', ytSrc:'https://www.youtube.com/embed/5yx6BWlEVcY?autoplay=1',   games:['memoryMatch','quickTap'],       gameLabels:['Memory Match','Quick Tap']  },
  tired:   { emoji:'😴', label:'Tired',   color:'#ce93d8', ytSrc:'https://www.youtube.com/embed/1ZYbU82GVz4?autoplay=1',   games:['slidingPuzzle','relaxRhythm'], gameLabels:['Slow Puzzle','Relax Rhythm'] },
};

// ============================================================
//  FIREBASE BACKEND — writes live data for admin dashboard
// ============================================================
const Backend = {

  /**
   * Called when a user starts or ends a mood session.
   * Writes to: /active/{user}  /feed  /users/{user}
   */
  async push(username, mood, action) {
    try {
      const ts  = Date.now();
      const evt = { user: username, mood, action, ts, device: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop' };

      // Active session marker (admin sees who is online right now)
      if (action === 'start') {
        await db.ref(`active/${username}`).set(evt);
      } else {
        await db.ref(`active/${username}`).remove().catch(() => {});
      }

      // Append to global feed (admin live feed — capped at 300 by Cloud/admin)
      await db.ref('feed').push(evt);

      // Update user registry
      const userRef  = db.ref(`users/${username}`);
      const snap     = await userRef.once('value');
      const existing = snap.val() || { joined: ts, sessions: 0, moods: {} };

      if (action === 'start') {
        existing.sessions          = (existing.sessions || 0) + 1;
        existing.moods             = existing.moods || {};
        existing.moods[mood]       = (existing.moods[mood] || 0) + 1;
      }
      existing.lastMood  = mood;
      existing.lastSeen  = ts;
      existing.online    = action === 'start';
      existing.avatar    = username[0].toUpperCase();
      await userRef.set(existing);

    } catch (e) {
      console.warn('Firebase Backend.push error:', e);
    }
  },

  /** Save completed session to /history/{user} */
  async pushHistory(username, entry) {
    try {
      await db.ref(`history/${username}`).push(entry);
    } catch (e) {
      console.warn('Firebase Backend.pushHistory error:', e);
    }
  },
};

// ============================================================
//  LOCAL STORAGE HELPER  (auth + local analytics only)
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
//  INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  initOrbs();
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
  document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
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
    if (users[u])     { err.textContent = 'Username already taken.'; return; }
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
    const moods = ['happy','sad','stressed','bored','tired'];
    const hist  = Array.from({ length: 14 }, (_, i) => ({
      mood: moods[Math.floor(Math.random() * 5)],
      ts: Date.now() - i * 43200000,
      duration: Math.floor(Math.random() * 20 + 3),
    }));
    LS.set('history_demo', hist);
  }
  document.getElementById('auth-username').value = 'demo';
  document.getElementById('auth-password').value = 'demo';
  doAuth();
}

function loginUser(username) {
  currentUser = username;
  LS.set('session', username);
  document.getElementById('landing-avatar').textContent   = username[0].toUpperCase();
  document.getElementById('landing-username').textContent = `Hi, ${username}! 👋`;
  document.getElementById('bottomNav').classList.add('visible');
  document.getElementById('syncBadge').classList.add('visible');
  showPage('page-landing');
}

function logout() {
  if (moodStartTime && currentMood) saveMoodSession();
  else if (currentUser && currentMood) Backend.push(currentUser, currentMood, 'end');
  else if (currentUser) Backend.push(currentUser, 'none', 'end').catch(() => {});
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
  badge.textContent        = data.emoji + ' ' + data.label;
  badge.style.borderColor  = data.color;
  badge.style.color        = data.color;

  document.getElementById('tab1Btn').textContent = data.gameLabels[0];
  document.getElementById('tab2Btn').textContent = data.gameLabels[1];
  document.getElementById('ytPlayer').src        = data.ytSrc;

  activeTab = 1;
  updateTabBtns();
  loadGame(data.games[0]);

  // 🔥 Push to Firebase — admin sees this instantly
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
//  SESSION SAVING
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

  // 🔥 Firebase writes
  Backend.pushHistory(currentUser, entry);
  Backend.push(currentUser, currentMood, 'end');

  // Update local user stats for leaderboard
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
  const d = new Date();
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

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
Reply ONLY as JSON, no extra text: {"mood":"<mood>","message":"<one warm encouraging sentence>"}

User says: "${text}"`;

  try {
    let detectedMood = 'bored', message = '';

    if (GEMINI_API_KEY.includes('Demo_replace')) {
      // Keyword fallback when no API key
      const t = text.toLowerCase();
      if      (t.match(/happy|great|amazing|joy|excit|good|love/)) detectedMood = 'happy';
      else if (t.match(/sad|cry|depress|lonely|miss|upset|down/))  detectedMood = 'sad';
      else if (t.match(/stress|anxious|overwhelm|worry|pressure/)) detectedMood = 'stressed';
      else if (t.match(/tired|exhaust|sleep|fatigue|drain/))       detectedMood = 'tired';
      message = "Let's find the right vibe for you 🌟";
    } else {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }] }) }
      );
      const data   = await res.json();
      const raw    = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
      detectedMood = parsed.mood    || 'bored';
      message      = parsed.message || '';
    }

    const emoji = MOODS[detectedMood]?.emoji || '😐';
    resultEl.innerHTML = `<span style="font-size:1.8rem">${emoji}</span> Gemini detects: <strong style="color:var(--accent)">${detectedMood}</strong><br><span style="font-size:.82rem">${message}</span>`;
    setTimeout(() => selectMood(detectedMood), 1800);

  } catch (err) {
    resultEl.textContent = 'Gemini error: ' + err.message;
  }
}

// ============================================================
//  ANALYTICS  (reads local history)
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

  const counts = { happy:0, sad:0, stressed:0, bored:0, tired:0 };
  hist.forEach(h => { if (h.mood in counts) counts[h.mood]++; });
  const max    = Math.max(...Object.values(counts), 1);
  const colors = { happy:'#f7c948', sad:'#64b5f6', stressed:'#81c784', bored:'#ff8a65', tired:'#ce93d8' };
  const emojis = { happy:'😄', sad:'😢', stressed:'😰', bored:'😑', tired:'😴' };

  document.getElementById('barChart').innerHTML = Object.entries(counts).map(([mood, count]) => `
    <div class="bar-row">
      <div class="bar-label">${emojis[mood]} ${mood}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${count/max*100}%;background:${colors[mood]}"></div></div>
      <div class="bar-count" style="color:${colors[mood]}">${count}</div>
    </div>`).join('');

  const recent = [...hist].reverse().slice(0, 15);
  document.getElementById('historyList').innerHTML = recent.length
    ? recent.map(h => `
        <div class="history-item">
          <div class="history-emoji">${emojis[h.mood]||'😐'}</div>
          <div style="flex:1">
            <div class="history-mood">${h.mood.charAt(0).toUpperCase()+h.mood.slice(1)}</div>
            <div class="history-time">${new Date(h.ts).toLocaleString()}</div>
          </div>
          <div class="history-duration">${h.duration||1}m</div>
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
  const labels  = { sessions:'sessions played', streak:'day streak', variety:'moods explored' };
  const palette = ['#f7c948','#64b5f6','#81c784','#ff8a65','#ce93d8','#7e91ff','#f48fb1'];

  const sorted = Object.entries(users)
    .map(([n,d]) => ({ name:n, avatar:d.avatar||n[0].toUpperCase(), score:d[metric]||0 }))
    .sort((a,b) => b.score - a.score).slice(0,10);

  const rankClass = i => i===0?'gold':i===1?'silver':i===2?'bronze':'';
  const rankEmoji = i => i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;

  document.getElementById('lbList').innerHTML = sorted.length
    ? sorted.map((u,i) => `
        <div class="lb-row${u.name===currentUser?' lb-you':''}">
          <div class="lb-rank ${rankClass(i)}">${rankEmoji(i)}</div>
          <div class="lb-avatar" style="background:${palette[i%palette.length]}">${u.avatar}</div>
          <div style="flex:1"><div class="lb-name">${u.name}${u.name===currentUser?' (you)':''}</div><div class="lb-sub">${labels[metric]}</div></div>
          <div class="lb-score">${u.score}</div>
        </div>`).join('')
    : '<div class="empty-state">No players yet!</div>';
}

// ============================================================
//  UTILITIES
// ============================================================
function showToast(msg, duration=2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function initOrbs() {
  const container = document.getElementById('bgOrbs');
  const palette   = ['#f7c948','#64b5f6','#81c784','#ff8a65','#ce93d8','#7e91ff'];
  for (let i = 0; i < 7; i++) {
    const orb  = document.createElement('div');
    orb.className = 'orb';
    const size    = 220 + Math.random() * 300;
    orb.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;background:${palette[i%palette.length]};animation-delay:${Math.random()*8}s;animation-duration:${14+Math.random()*12}s;`;
    container.appendChild(orb);
  }
}

// ============================================================
//  GAME ENGINE
// ============================================================
const gameCleanup = {};
function stopCurrentGame() { if (gameCleanup._fn) { gameCleanup._fn(); gameCleanup._fn = null; } }
function loadGame(name)     { stopCurrentGame(); const vp = document.getElementById('gameViewport'); vp.innerHTML = ''; GAMES[name](vp); }

const GAMES = {};

GAMES.reactionSpeed = function(vp) {
  let state='idle', st=0, timer=null;
  vp.innerHTML=`<div class="game-title">Reaction Speed</div><div class="game-subtitle">Click when the box turns yellow!</div><div id="reaction-box">Click to Start</div><div class="game-score" id="rxScore"></div>`;
  const box=vp.querySelector('#reaction-box'), sc=vp.querySelector('#rxScore');
  box.addEventListener('click',()=>{
    if(state==='idle'||state==='result'){state='wait';box.textContent='Wait…';box.className='wait';sc.textContent='';timer=setTimeout(()=>{state='ready';box.textContent='NOW!';box.className='go';st=Date.now();},1500+Math.random()*3000);}
    else if(state==='wait'){clearTimeout(timer);state='result';box.textContent='Too early! Retry';box.className='';sc.textContent='😬 Too soon!';}
    else if(state==='ready'){const ms=Date.now()-st;state='result';box.textContent=`${ms}ms — Retry`;box.className='';sc.textContent=ms<200?'🔥 Lightning!':ms<350?'⚡ Fast!':ms<500?'👍 Good':'🐢 Keep trying';}
  });
  gameCleanup._fn=()=>clearTimeout(timer);
};

GAMES.colorMatch = function(vp) {
  const C=[{name:'Red',hex:'#e74c3c'},{name:'Blue',hex:'#3498db'},{name:'Green',hex:'#2ecc71'},{name:'Yellow',hex:'#f1c40f'},{name:'Purple',hex:'#9b59b6'},{name:'Orange',hex:'#e67e22'}];
  let score=0,lives=3,target=null;
  vp.innerHTML=`<div class="game-title">Color Match</div><div class="game-subtitle">Tap the matching colour</div><div class="color-match-target"></div><div class="color-match-options"><button></button><button></button><button></button><button></button></div><div class="game-score" id="cmScore"></div>`;
  const sc=vp.querySelector('#cmScore');
  function pick(){const s=[...C].sort(()=>Math.random()-.5).slice(0,4);target=s[Math.floor(Math.random()*4)];vp.querySelector('.color-match-target').style.background=target.hex;vp.querySelectorAll('.color-match-options button').forEach((b,i)=>{b.style.background=s[i].hex;b.dataset.color=s[i].name;});sc.textContent=`Score:${score} ❤️${lives}`;}
  vp.querySelectorAll('.color-match-options button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.color===target.name){score++;sc.textContent='✅ Correct!';}else{lives--;sc.textContent=lives>0?'❌ Nope!':'💀 Game Over';if(!lives)return;}setTimeout(pick,600);}));
  pick();
};

GAMES.memoryMatch = function(vp) {
  const P=['🍎','🍊','🍋','🍇','🍓','🎸','🎺','🎹'];
  let cards=[...P,...P].sort(()=>Math.random()-.5).map((e,i)=>({id:i,emoji:e,flipped:false,matched:false})),sel=[],locked=false,moves=0;
  vp.innerHTML=`<div class="game-title">Memory Match</div><div class="game-subtitle">Find all the pairs!</div><div class="memory-grid" id="memGrid"></div><div class="game-score" id="memScore">Moves:0</div>`;
  const grid=vp.querySelector('#memGrid'),sc=vp.querySelector('#memScore');
  function render(){grid.innerHTML='';cards.forEach(c=>{const el=document.createElement('div');el.className='mem-card'+(c.flipped||c.matched?' flipped':'');el.innerHTML=`<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">${c.emoji}</div></div>`;el.addEventListener('click',()=>flip(c.id));grid.appendChild(el);});}
  function flip(id){if(locked)return;const c=cards.find(x=>x.id===id);if(c.flipped||c.matched)return;c.flipped=true;sel.push(c);render();if(sel.length===2){moves++;sc.textContent=`Moves:${moves}`;locked=true;setTimeout(()=>{if(sel[0].emoji===sel[1].emoji)sel.forEach(x=>x.matched=true);else sel.forEach(x=>x.flipped=false);sel=[];locked=false;render();if(cards.every(x=>x.matched))sc.textContent=`🎉 Done in ${moves} moves!`;},900);}}
  render();
};

GAMES.bubblePop = function(vp) {
  let score=0,t=null;
  vp.innerHTML=`<div class="game-title">Bubble Pop</div><div class="game-subtitle">Pop bubbles before they escape!</div><div class="game-score" id="bpScore">Score:0</div><div id="bubble-arena"></div>`;
  const arena=vp.querySelector('#bubble-arena'),sc=vp.querySelector('#bpScore');
  const E=['😊','🌟','💎','🎈','🌈','🍀','✨','🦋'],C=['#f7c948','#64b5f6','#81c784','#ff8a65','#ce93d8','#7e91ff'];
  function spawn(){const b=document.createElement('div');b.className='bubble';const sz=44+Math.random()*32;b.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*85}%;background:${C[Math.floor(Math.random()*C.length)]};animation-duration:${3.5+Math.random()*2}s;`;b.textContent=E[Math.floor(Math.random()*E.length)];b.addEventListener('click',()=>{score++;sc.textContent=`Score:${score}`;b.remove();});arena.appendChild(b);b.addEventListener('animationend',()=>b.remove());}
  spawn();t=setInterval(spawn,1200);
  gameCleanup._fn=()=>clearInterval(t);
};

GAMES.breathingClick = function(vp) {
  const ph=[{name:'Breathe In',duration:4,cls:'expand'},{name:'Hold',duration:2,cls:'expand'},{name:'Breathe Out',duration:4,cls:''}];
  vp.innerHTML=`<div class="game-title">Breathing Click</div><div class="game-subtitle">Follow the breathing circle</div><div id="breath-circle">Tap to start</div><div class="game-score" id="bxScore"></div>`;
  const cir=vp.querySelector('#breath-circle'),sc=vp.querySelector('#bxScore');
  let pi=0,cd=0,run=false,iv=null,score=0;
  cir.addEventListener('click',()=>{if(!run){run=true;next();}});
  function next(){const p=ph[pi%ph.length];cir.textContent=p.name;cir.className=p.cls?'expand':'';cd=p.duration;sc.textContent=`${p.name} — ${cd}s | Cycles:${score}`;iv=setInterval(()=>{cd--;sc.textContent=`${p.name} — ${cd}s | Cycles:${score}`;if(cd<=0){clearInterval(iv);if(p.name==='Breathe Out')score++;pi++;if(score>=5){cir.textContent='🌟 Well done!';cir.className='';sc.textContent='5 cycles complete!';run=false;return;}next();}},1000);}
  gameCleanup._fn=()=>clearInterval(iv);
};

GAMES.slidingPuzzle = function(vp) {
  const E=['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
  let tiles=[...E,null],moves=0;
  function sh(){for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}}sh();
  vp.innerHTML=`<div class="game-title">Sliding Puzzle</div><div class="game-subtitle">Arrange 1–8 in order</div><div class="puzzle-grid" id="pg"></div><div class="game-score" id="pzScore">Moves:0</div><button class="game-btn" id="pzR">Shuffle</button>`;
  const grid=vp.querySelector('#pg'),sc=vp.querySelector('#pzScore');
  function render(){grid.innerHTML='';tiles.forEach((t,i)=>{const el=document.createElement('div');el.className='puzzle-tile'+(t===null?' empty':'');el.textContent=t||'';el.addEventListener('click',()=>mv(i));grid.appendChild(el);});}
  function mv(i){const b=tiles.indexOf(null);const r=x=>Math.floor(x/3),c=x=>x%3;if((r(i)===r(b)&&Math.abs(c(i)-c(b))===1)||(c(i)===c(b)&&Math.abs(r(i)-r(b))===1)){[tiles[i],tiles[b]]=[tiles[b],tiles[i]];moves++;sc.textContent=`Moves:${moves}`;render();if(tiles.every((t,i)=>t===([...E,null])[i]))sc.textContent=`🎉 Solved in ${moves}!`;}}
  vp.querySelector('#pzR').addEventListener('click',()=>{tiles=[...E,null];sh();moves=0;sc.textContent='Moves:0';render();});
  render();
};

GAMES.quickTap = function(vp) {
  let score=0,tl=10,iv=null,run=false;
  vp.innerHTML=`<div class="game-title">Quick Tap</div><div class="game-subtitle">Tap as fast as you can in 10s!</div><div class="game-score" id="qtScore">Score:0|Time:10s</div><div id="tap-target">TAP!</div><button class="game-btn" id="qtS">Start</button>`;
  const tgt=vp.querySelector('#tap-target'),sc=vp.querySelector('#qtScore'),sb=vp.querySelector('#qtS');
  tgt.addEventListener('click',()=>{if(!run)return;score++;sc.textContent=`Score:${score}|Time:${tl}s`;tgt.style.transform='scale(.92)';setTimeout(()=>tgt.style.transform='',80);});
  sb.addEventListener('click',()=>{score=0;tl=10;run=true;sb.disabled=true;iv=setInterval(()=>{tl--;sc.textContent=`Score:${score}|Time:${tl}s`;if(tl<=0){clearInterval(iv);run=false;sc.textContent=`🎯 Final:${score} taps!`;sb.disabled=false;sb.textContent='Again';}},1000);});
  gameCleanup._fn=()=>clearInterval(iv);
};

GAMES.relaxRhythm = function(vp) {
  const L=8;let iv=null,run=false,clicks=0;
  vp.innerHTML=`<div class="game-title">Relax Rhythm</div><div class="game-subtitle">Follow the pulse</div><div id="rhythm-ring">Click to sync</div><div class="rhythm-dots" id="rd"></div><div class="game-score" id="rrScore">Clicks:0/${L}</div><button class="game-btn" id="rrS">Begin</button>`;
  const ring=vp.querySelector('#rhythm-ring'),dots=vp.querySelector('#rd'),sc=vp.querySelector('#rrScore'),sb=vp.querySelector('#rrS');
  for(let i=0;i<L;i++){const d=document.createElement('div');d.className='rhythm-dot';dots.appendChild(d);}
  function pulse(){ring.classList.add('pulse');ring.textContent='Tap!';setTimeout(()=>{ring.classList.remove('pulse');ring.textContent='Click to sync';},600);}
  ring.addEventListener('click',()=>{if(!run)return;clicks++;sc.textContent=`Clicks:${clicks}/${L}`;const dd=dots.querySelectorAll('.rhythm-dot');if(clicks<=L)dd[clicks-1].classList.add('lit');if(clicks>=L){clearInterval(iv);run=false;ring.textContent='🌙 Relaxed!';sc.textContent='Perfect rhythm!';sb.disabled=false;}});
  sb.addEventListener('click',()=>{clicks=0;run=true;dots.querySelectorAll('.rhythm-dot').forEach(d=>d.classList.remove('lit'));sc.textContent=`Clicks:0/${L}`;sb.disabled=true;clearInterval(iv);iv=setInterval(pulse,1800);pulse();});
  gameCleanup._fn=()=>clearInterval(iv);
};
