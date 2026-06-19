/* ========================================
   MOODPLAY ADMIN — admin.js
   Firebase Realtime Database — live listeners
   ======================================== */
 
// ── Change this password! ──
const ADMIN_CREDS = {
  admin: 'admin123',
};

// ── Firebase DB reference (initialised in admin.html) ── 
const db = firebase.database();

// ── Mood meta ──
const MOOD_META = {
  happy:   { emoji:'😄', color:'#f7c948' },
  sad:     { emoji:'😢', color:'#64b5f6' },
  stressed:{ emoji:'😰', color:'#81c784' },
  bored:   { emoji:'😑', color:'#ff8a65' },
  tired:   { emoji:'😴', color:'#ce93d8' },
};
const PALETTE = ['#f7c948','#64b5f6','#81c784','#ff8a65','#ce93d8','#7e91ff','#f48fb1','#80cbc4'];

// ── Shared state (filled by Firebase listeners) ──
let _reg         = {};   // /users  snapshot
let _activeUsers = {};   // /active snapshot
let _feed        = [];   // /feed   array (newest first)
let _listenersOn = false;

// ============================================================
//  ADMIN AUTH
// ============================================================
function adminLogin() {
  const u   = document.getElementById('adminUser').value.trim();
  const p   = document.getElementById('adminPass').value;
  const err = document.getElementById('adminErr');

  if (ADMIN_CREDS[u] && ADMIN_CREDS[u] === p) {
    document.getElementById('adminAuth').style.display = 'none';
    startListeners();
  } else {
    err.textContent = 'Invalid credentials.';
  }
}

document.getElementById('adminUser').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('adminPass').focus(); });
document.getElementById('adminPass').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });

// ============================================================
//  FIREBASE REAL-TIME LISTENERS
//  These fire automatically whenever data changes in Firebase.
//  No polling needed — the dashboard updates itself instantly.
// ============================================================
function startListeners() {
  if (_listenersOn) return;
  _listenersOn = true;

  document.getElementById('lastRefresh').textContent = 'Connecting…';

  // ── 1. /users  — registered user profiles ──
  db.ref('users').on('value', snap => {
    _reg = snap.val() || {};
    renderAll();
  });

  // ── 2. /active — who is online right now ──
  db.ref('active').on('value', snap => {
    _activeUsers = snap.val() || {};
    renderAll();
  });

  // ── 3. /feed — last 50 events (newest first) ──
  db.ref('feed').limitToLast(50).on('value', snap => {
    const raw = snap.val() || {};
    // Firebase push keys are chronological — reverse so newest is first
    _feed = Object.values(raw).reverse();
    renderAll();
  });
}

// ── Called whenever any listener fires ──
function renderAll() {
  renderStats();
  renderMoodDist();
  renderTimeline();
  renderUsersTable();
  renderOnlineList();
  renderFeed();
  renderAlerts();
  document.getElementById('lastRefresh').textContent = 'Live · updated ' + new Date().toLocaleTimeString();
}

// Manual refresh button — force re-render from cached state
function loadData() {
  renderAll();
}

// ============================================================
//  STAT CARDS
// ============================================================
function renderStats() {
  const onlineCount   = Object.keys(_activeUsers).length;
  const totalUsers    = Object.keys(_reg).length;
  const totalSessions = Object.values(_reg).reduce((a, u) => a + (u.sessions || 0), 0);

  const today      = new Date().toDateString();
  const todayFeed  = _feed.filter(e => new Date(e.ts).toDateString() === today && e.action === 'start');
  const moodCounts = {};
  todayFeed.forEach(e => { moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });
  const topMood = Object.entries(moodCounts).sort((a,b) => b[1]-a[1])[0];

  document.getElementById('s-online').textContent  = onlineCount;
  document.getElementById('sd-online').textContent = onlineCount > 0 ? `${onlineCount} active session${onlineCount>1?'s':''}` : 'No active sessions';
  document.getElementById('s-total').textContent   = totalSessions;
  document.getElementById('sd-total').textContent  = `${todayFeed.length} today`;
  document.getElementById('s-users').textContent   = totalUsers;

  if (topMood) {
    const mm = MOOD_META[topMood[0]];
    document.getElementById('s-topmood').textContent  = mm ? mm.emoji : topMood[0];
    document.getElementById('sd-topmood').textContent = `${topMood[0]} · ${topMood[1]} time${topMood[1]>1?'s':''}`;
  } else {
    document.getElementById('s-topmood').textContent  = '—';
    document.getElementById('sd-topmood').textContent = 'No data today';
  }
}

// ============================================================
//  MOOD DISTRIBUTION
// ============================================================
function renderMoodDist() {
  const counts = { happy:0, sad:0, stressed:0, bored:0, tired:0 };
  _feed.filter(e => e.action === 'start').forEach(e => { if (e.mood in counts) counts[e.mood]++; });

  const total = Object.values(counts).reduce((a,b) => a+b, 0) || 1;
  const max   = Math.max(...Object.values(counts), 1);

  document.getElementById('dist-updated').textContent = `${total} total events`;
  document.getElementById('moodDist').innerHTML = Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .map(([mood, count]) => {
      const mm  = MOOD_META[mood] || { emoji:'😐', color:'#888' };
      const pct = Math.round(count/total*100);
      const w   = Math.round(count/max*100);
      return `<div class="mood-bar-row">
        <div class="mood-bar-emoji">${mm.emoji}</div>
        <div class="mood-bar-name">${mood}</div>
        <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${w}%;background:${mm.color}"></div></div>
        <div class="mood-bar-pct" style="color:${mm.color}">${pct}%</div>
        <div class="mood-bar-count">${count}</div>
      </div>`;
    }).join('');
}

// ============================================================
//  ACTIVITY TIMELINE  (canvas chart)
// ============================================================
function renderTimeline() {
  const canvas = document.getElementById('timelineCanvas');
  const wrap   = canvas.parentElement;
  canvas.width  = wrap.offsetWidth  * 2;
  canvas.height = wrap.offsetHeight * 2;
  canvas.style.width  = wrap.offsetWidth  + 'px';
  canvas.style.height = wrap.offsetHeight + 'px';

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const events = _feed.filter(e => e.action === 'start').slice(0, 20).reverse();

  if (!events.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font      = '26px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No sessions yet — open MoodPlay and pick a mood!', W/2, H/2);
    return;
  }

  const moodColors = { happy:'#f7c948', sad:'#64b5f6', stressed:'#81c784', bored:'#ff8a65', tired:'#ce93d8' };
  const pad  = 44;
  const barW = (W - pad*2) / events.length;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  for (let i=0;i<=4;i++){const y=pad+(H-pad*2)*(i/4);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();}

  events.forEach((e, i) => {
    const color = moodColors[e.mood] || '#888';
    const x     = pad + i*barW + barW*0.15;
    const bw    = barW*0.7;
    const barH  = H - pad*2;
    const grad  = ctx.createLinearGradient(0,pad,0,H-pad);
    grad.addColorStop(0, color); grad.addColorStop(1, color+'44');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, pad, bw, barH, [4,4,0,0]); ctx.fill();
    ctx.font = `${Math.min(22, barW*0.7)}px serif`; ctx.textAlign='center';
    ctx.fillText(MOOD_META[e.mood]?.emoji||'?', x+bw/2, pad-8);
  });
}

// ============================================================
//  ALL USERS TABLE
// ============================================================
function renderUsersTable() {
  const users = Object.entries(_reg).sort((a,b) => (b[1].lastSeen||0)-(a[1].lastSeen||0));
  document.getElementById('users-count').textContent = `${users.length} users`;

  document.getElementById('usersBody').innerHTML = users.length
    ? users.map(([name, data], i) => {
        const isOnline   = !!_activeUsers[name];
        const activeMood = _activeUsers[name]?.mood || data.lastMood;
        const mm         = activeMood ? MOOD_META[activeMood] : null;
        const lastSeen   = data.lastSeen ? timeAgo(data.lastSeen) : 'Never';
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:9px">
            <div class="u-avatar" style="background:${PALETTE[i%PALETTE.length]}">${data.avatar||name[0].toUpperCase()}</div>
            <span class="user-name">${name}</span>
          </div></td>
          <td><div class="online-badge ${isOnline?'online':'offline'}"><div class="od"></div>${isOnline?'Online':'Offline'}</div></td>
          <td>${mm?`<div class="mood-chip" style="color:${mm.color};border-color:${mm.color}40;background:${mm.color}12">${mm.emoji} ${activeMood}</div>`:'<span style="color:var(--muted);font-size:.8rem">—</span>'}</td>
          <td style="font-weight:700;color:var(--accent)">${data.sessions||0}</td>
          <td style="color:var(--muted);font-size:.8rem">${lastSeen}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="empty">No users yet.<br>Share your MoodPlay link so people can sign up!</td></tr>';
}

// ============================================================
//  ONLINE USERS  (right panel)
// ============================================================
function renderOnlineList() {
  const list = Object.entries(_activeUsers);
  document.getElementById('online-count').textContent = list.length;

  document.getElementById('onlineList').innerHTML = list.length
    ? list.map(([name, data], i) => {
        const mm    = MOOD_META[data.mood] || { emoji:'😐', color:'#888' };
        const since = timeAgo(data.ts);
        return `<div class="online-user-card" style="--c:${mm.color}">
          <div style="width:34px;height:34px;border-radius:50%;background:${PALETTE[i%PALETTE.length]};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem;color:#0b0e1a;flex-shrink:0">${name[0].toUpperCase()}</div>
          <div style="flex:1">
            <div class="online-user-name">${name}</div>
            <div class="online-user-mood">${mm.emoji} feeling <strong style="color:${mm.color}">${data.mood}</strong></div>
            <div class="online-since">Since ${since}</div>
          </div>
          <div class="pulse-ring" style="background:${mm.color}"></div>
        </div>`;
      }).join('')
    : '<div class="empty">No users online right now.<br>They\'ll appear here when they pick a mood.</div>';
}

// ============================================================
//  LIVE FEED  (right panel)
// ============================================================
function renderFeed() {
  const recent = _feed.slice(0, 30);
  document.getElementById('feed-count').textContent = `${_feed.length} events`;

  document.getElementById('feedList').innerHTML = recent.length
    ? recent.map((e, i) => {
        const mm = MOOD_META[e.mood] || { emoji:'😐', color:'#888' };
        const action = e.action === 'start'
          ? `started feeling <strong style="color:${mm.color}">${e.mood} ${mm.emoji}</strong>`
          : `ended ${mm.emoji} ${e.mood} session`;
        return `<div class="feed-item">
          <div class="feed-avatar" style="background:${PALETTE[i%PALETTE.length]}">${e.user[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0"><div class="feed-user">${e.user}</div><div class="feed-action">${action}</div></div>
          <div class="feed-time">${timeAgo(e.ts)}</div>
        </div>`;
      }).join('')
    : '<div class="empty">No events yet.<br>Open MoodPlay and pick a mood — it shows up here instantly!</div>';
}

// ============================================================
//  SMART ALERTS
// ============================================================
function renderAlerts() {
  const alerts  = [];
  const today   = new Date().toDateString();
  const todayF  = _feed.filter(e => new Date(e.ts).toDateString()===today && e.action==='start');

  const stressedNow = Object.entries(_activeUsers).filter(([,d]) => d.mood==='stressed');
  if (stressedNow.length)
    alerts.push({ type:'warn', icon:'😰', msg:`${stressedNow.length} user${stressedNow.length>1?'s are':' is'} currently stressed: ${stressedNow.map(([n])=>n).join(', ')}` });

  const sadNow = Object.entries(_activeUsers).filter(([,d]) => d.mood==='sad');
  if (sadNow.length)
    alerts.push({ type:'info', icon:'😢', msg:`${sadNow.length} user${sadNow.length>1?'s are':' is'} feeling sad right now` });

  if (todayF.length >= 10)
    alerts.push({ type:'success', icon:'🔥', msg:`High engagement — ${todayF.length} mood sessions today!` });

  const mc={};todayF.forEach(e=>{mc[e.mood]=(mc[e.mood]||0)+1;});
  const top=Object.entries(mc).sort((a,b)=>b[1]-a[1])[0];
  if (top && top[1]>=3)
    alerts.push({ type:'info', icon:MOOD_META[top[0]]?.emoji||'📊', msg:`"${top[0]}" is the dominant mood today (${top[1]} sessions)` });

  const newToday = Object.values(_reg).filter(u => new Date(u.joined).toDateString()===today).length;
  if (newToday)
    alerts.push({ type:'success', icon:'🎉', msg:`${newToday} new user${newToday>1?'s':''} joined today!` });

  if (!alerts.length)
    alerts.push({ type:'info', icon:'✅', msg:'Everything looks normal. No alerts.' });

  document.getElementById('alertList').innerHTML = alerts
    .map(a=>`<div class="alert-item ${a.type}"><div class="alert-icon">${a.icon}</div><div>${a.msg}</div></div>`)
    .join('');
}

// ============================================================
//  HELPERS
// ============================================================
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return 'just now';
  if (d < 3600000)  return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
