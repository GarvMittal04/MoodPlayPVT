# 🎮 MoodPlay — Complete Project

A mood-based game & music platform with **real-time admin dashboard**, **Gemini AI mood detection**, **analytics**, and **leaderboard**.

---
 
## 📁 Project Structure

```
moodplay/
│
├── index.html       ← Main user-facing app (login, games, music, analytics)
├── style.css        ← All styles for index.html
├── script.js        ← All JavaScript for index.html
│
├── admin.html       ← Admin real-time dashboard
├── admin.css        ← Admin dashboard styles
├── admin.js         ← Admin dashboard logic
│
└── README.md        ← This file
```

---

## 🚀 How to Run

### Option A — Open directly in browser
1. Download all 6 files into the **same folder**
2. Open `index.html` in your browser to use MoodPlay
3. Open `admin.html` in another tab/window for the admin dashboard

> ⚠️ Both files must be in the same folder so CSS/JS links work correctly.

### Option B — Host on a web server
Upload all 6 files to any static hosting:
- [GitHub Pages](https://pages.github.com)
- [Netlify](https://netlify.com) — drag & drop the folder
- [Vercel](https://vercel.com)
- Any Apache/Nginx server

---

## 🔑 API Keys

### Gemini AI (Free)
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Create a free API key
3. Open `script.js` and replace:
   ```js
   const GEMINI_API_KEY = 'AIzaSyDemo_replace_with_your_key';
   ```
   with your real key.

### Music (YouTube — Free)
Music is embedded via YouTube iframes — no API key needed.
To change playlists, edit the `ytSrc` values in the `MOODS` object in `script.js`.

---

## 🛡️ Admin Dashboard

**Login credentials** (change these in `admin.js`):
```
Username: admin
Password: admin123
```

To change, edit the `ADMIN_CREDS` object in `admin.js`:
```js
const ADMIN_CREDS = {
  admin: 'admin123',
  yourusername: 'yourpassword',
};
```

### What the admin can see:
| Feature | Description |
|---|---|
| 🟢 Online Now | Live list of users currently playing, with their active mood |
| ⚡ Live Feed | Real-time stream of every mood event across all users |
| 📊 Mood Distribution | Bar chart showing frequency of each mood |
| 📈 Activity Timeline | Canvas chart of the last 20 mood sessions |
| 👥 All Users | Table with online/offline status, current mood, session count |
| 🔔 Smart Alerts | Auto-generated alerts (stressed users, high activity, new signups) |

The dashboard **auto-refreshes every 8 seconds**.

---

## 🎮 Games

| Game | Best For |
|---|---|
| Reaction Speed | Happy — fast & energetic |
| Color Match | Happy — bright & stimulating |
| Simple Puzzle | Sad / Tired — gentle focus |
| Calm Bubbles | Sad / Stressed — relaxing pop |
| Breathing Click | Stressed — guided breathing |
| Memory Match | Bored — mental challenge |
| Quick Tap | Bored — fast stimulation |
| Relax Rhythm | Tired — slow rhythmic clicks |

---

## 🎵 Music Playlists

| Mood | YouTube Playlist |
|---|---|
| 😄 Happy | Upbeat Lo-Fi Mix |
| 😢 Sad | Lofi Girl — Sad Beats |
| 😰 Stressed | Calming Nature Sounds |
| 😑 Bored | Energetic Chill Mix |
| 😴 Tired | Sleep & Relax Music |

---

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend Storage**: `window.storage` persistent API (cross-session shared storage)
- **AI**: Google Gemini 2.0 Flash API
- **Music**: YouTube iFrame Embed (free)
- **Auth**: localStorage (client-side, no server needed)
- **Fonts**: Google Fonts (Playfair Display + Nunito)

---

## 🔒 User Accounts

User accounts are stored in **localStorage** — they persist per browser.
For a production app, replace the `LS` helper in `script.js` with real backend calls.

---

## ✏️ Customisation

### Add a new mood
1. Add to the `MOODS` object in `script.js`
2. Add a `.mood-card` button in `index.html`
3. Add hover style in `style.css`
4. Add accent override at bottom of `style.css`

### Change the admin refresh interval
In `admin.js`, find:
```js
refreshTimer = setInterval(loadData, 8000);
```
Change `8000` (ms) to your preferred interval.

### Add more games
In `script.js`, add a new function to `GAMES`:
```js
GAMES.myNewGame = function(vp) {
  vp.innerHTML = `...your HTML...`;
  // game logic here
  gameCleanup._fn = () => { /* cleanup timers */ };
};
```
Then reference it in a mood's `games` array.

---

## 📱 Responsive

Works on mobile, tablet, and desktop. The bottom navigation collapses gracefully on small screens.

---

## 📄 License

Free to use, modify, and distribute for personal and commercial projects.
