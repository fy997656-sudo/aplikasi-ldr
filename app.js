// =====================================================
// KitaSpace - PROTOTYPE FRONTEND (semua data di localStorage)
// Catatan: ini hanya untuk belajar & coba UI. Login, chat realtime,
// dan lokasi antar HP yang SUNGGUHAN butuh backend (lihat penjelasan).
// =====================================================

const KEY = 'kitaspace_v1';                 // nama "laci" di localStorage
const $ = id => document.getElementById(id); // shortcut ambil elemen

// ---------- 1. DATA DUMMY ----------
const USERS = [
  { id: 'a', name: 'Kamu',     email: 'kamu@kita.app' },
  { id: 'b', name: 'Pasangan', email: 'dia@kita.app' },
];
const DEMO_PASSWORD = 'kita1234';

function freshData() {
  const t = Date.now();
  return {
    chat: [
      { from: 'b', text: 'Hai sayang 💕', t: t - 3600000 },
      { from: 'a', text: 'Hai! Lagi apa?', t: t - 3500000 },
    ],
    home: { lat: -6.2, lng: 106.8166, radius: 100 },
    u: {   // data tiap pengguna
      a: { share: false, online: true, history: false, loc: null },
      b: { share: true,  online: true, history: false,
           loc: { lat: -6.2002, lng: 106.8168, t: t - 120000 } },
    },
  };
}
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || freshData(); }
  catch { return freshData(); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

let db = load();       // seluruh data aplikasi
let me = null;         // user yang sedang login
let watchId = null;    // id pelacakan lokasi (null = tidak sedang jalan)
const other = () => USERS.find(u => u.id !== me.id);

// ---------- 2. LOGIN ----------
// Password di-hash (SHA-256) sebelum dibandingkan, jadi tidak pernah
// disimpan/dibandingkan sebagai teks biasa. Di aplikasi nyata, hash
// dilakukan di SERVER (pakai bcrypt/argon2), bukan di browser.
async function hash(text) {
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return btoa(text); // cadangan sederhana kalau browser tidak mendukung
}
$('btnLogin').onclick = async () => {
  const id = $('email').value.trim().toLowerCase();
  const pass = $('pass').value;
  const user = USERS.find(u => u.email === id || u.name.toLowerCase() === id);
  const ok = user && (await hash(pass)) === (await hash(DEMO_PASSWORD));
  if (!ok) { $('loginErr').textContent = 'Email/password salah'; return; }
  me = user;
  localStorage.setItem(KEY + '_me', me.id);
  startApp();
};
$('btnLogout').onclick = () => { stopSharing(); localStorage.removeItem(KEY + '_me'); location.reload(); };

function startApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  db.u[me.id].online = db.u[me.id].online; save();
  go('dash');
}

// ---------- 3. NAVIGASI ----------
function go(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('v-' + name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
  render();
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.go));

// ---------- 4. CHAT ----------
// Alurnya: ambil teks -> push ke db.chat -> save -> render ulang.
function sendMsg() {
  const text = $('msgInput').value.trim();
  if (!text) return;
  db.chat.push({ from: me.id, text, t: Date.now() });
  save();
  $('msgInput').value = '';
  renderChat();
}
$('btnSend').onclick = sendMsg;
$('msgInput').onkeydown = e => { if (e.key === 'Enter') sendMsg(); };

function renderChat() {
  const box = $('msgs');
  box.innerHTML = '';
  db.chat.forEach(m => {
    const sender = USERS.find(u => u.id === m.from).name;
    const d = document.createElement('div');
    d.className = 'bubble ' + (m.from === me.id ? 'me' : 'them');
    // textContent (bukan innerHTML) supaya pesan tidak bisa menyisipkan HTML
    d.textContent = m.text;
    const s = document.createElement('small');
    s.textContent = sender + ' · ' + fmtTime(m.t);
    d.appendChild(s);
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;   // auto-scroll ke pesan terbaru
}

// ---------- 5. GEOLOCATION (hanya setelah user menekan tombol) ----------
function startSharing() {
  if (!navigator.geolocation) { $('locMsg').textContent = 'Browser tidak mendukung lokasi.'; return; }
  if (watchId !== null) return;                 // sudah jalan
  $('locMsg').textContent = '';
  // watchPosition memicu popup izin dari browser. Kalau ditolak -> onError.
  watchId = navigator.geolocation.watchPosition(onPos, onError, { enableHighAccuracy: true });
  db.u[me.id].share = true; save(); render();
}
function onPos(pos) {
  db.u[me.id].loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
  save(); render();
}
function onError(err) {
  $('locMsg').textContent = err.code === 1
    ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.'
    : 'Lokasi tidak tersedia.';
  stopSharing();
}
function stopSharing() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; } // berhenti total
  if (!db) return;
  const u = db.u[me ? me.id : 'a'];
  u.share = false; u.loc = null;                // hapus lokasi terakhir
  save(); render();
}
$('btnShare').onclick = startSharing;
$('btnStop').onclick = stopSharing;
$('btnStop2').onclick = stopSharing;

// ---------- 6. RUMUS HAVERSINE (jarak 2 titik di bumi, hasil meter) ----------
function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000;                              // jari-jari bumi (meter)
  const rad = d => d * Math.PI / 180;             // derajat -> radian
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function homeStatus(loc) {
  const h = db.home;
  if (!loc || h.lat == null) return '⚪ Data lokasi belum tersedia';
  return distance(loc.lat, loc.lng, h.lat, h.lng) <= h.radius
    ? '🏠 Kemungkinan berada di rumah (lokasi terakhir berada dalam radius rumah)'
    : '📍 Di luar area rumah';
}

// ---------- 7. RUMAH & PRIVASI ----------
$('btnSaveHome').onclick = () => {
  const lat = parseFloat($('hLat').value), lng = parseFloat($('hLng').value);
  if (isNaN(lat) || isNaN(lng)) { $('homeMsg').textContent = 'Isi latitude & longitude dulu.'; return; }
  db.home = { lat, lng, radius: parseFloat($('hRad').value) || 100 };
  save(); $('homeMsg').textContent = 'Tersimpan ✔';
};
$('btnHereHome').onclick = () => {
  // Ambil lokasi SEKALI saja (getCurrentPosition), bukan terus-menerus
  navigator.geolocation.getCurrentPosition(p => {
    $('hLat').value = p.coords.latitude; $('hLng').value = p.coords.longitude;
  }, () => { $('homeMsg').textContent = 'Izin lokasi ditolak.'; });
};
$('pShare').onchange = e => e.target.checked ? startSharing() : stopSharing();
$('pOnlineChk').onchange = e => { db.u[me.id].online = e.target.checked; save(); };
$('pHist').onchange = e => { db.u[me.id].history = e.target.checked; save(); };

// ---------- 8. RENDER (isi tampilan dari data) ----------
function fmtTime(t) { return new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
function render() {
  const mine = db.u[me.id], p = other(), pd = db.u[p.id];
  // Dashboard
  $('meName').textContent = me.name;
  $('meStatus').textContent = mine.online ? 'Status: Online' : 'Status: disembunyikan';
  $('pName').textContent = p.name;
  $('pOnline').textContent = pd.online ? 'Online' : '';
  $('pLoc').textContent = pd.share ? '🟢 Sedang berbagi lokasi' : '⚪ Tidak berbagi lokasi';
  $('pHome').textContent = pd.share ? homeStatus(pd.loc) : '';
  $('pTime').textContent = pd.share && pd.loc ? 'Last update: ' + fmtTime(pd.loc.t) : '';
  // Lokasi saya
  $('myLoc').textContent = mine.share && mine.loc
    ? `Lat ${mine.loc.lat.toFixed(5)}, Lng ${mine.loc.lng.toFixed(5)}` : 'Tidak berbagi lokasi';
  $('myTime').textContent = mine.loc ? 'Diperbarui: ' + fmtTime(mine.loc.t) : '';
  // Lokasi pasangan
  $('pStatus').textContent = pd.share ? '🟢 Sedang berbagi lokasi' : '⚪ Tidak berbagi';
  $('pCoord').textContent = pd.share && pd.loc ? `Lat ${pd.loc.lat.toFixed(5)}, Lng ${pd.loc.lng.toFixed(5)}` : 'Lokasi: -';
  $('pUpdated').textContent = pd.loc && pd.share ? 'Last updated: ' + fmtTime(pd.loc.t) : '';
  $('pMaps').classList.toggle('hidden', !(pd.share && pd.loc));
  if (pd.loc) $('pMaps').href = `https://www.google.com/maps?q=${pd.loc.lat},${pd.loc.lng}`;
  // Rumah & privasi
  $('hLat').value = db.home.lat ?? ''; $('hLng').value = db.home.lng ?? ''; $('hRad').value = db.home.radius;
  $('pShare').checked = mine.share; $('pOnlineChk').checked = mine.online; $('pHist').checked = mine.history;
  renderChat();
}

// ---------- 9. TEMA & START ----------
$('btnTheme').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  localStorage.setItem(KEY + '_theme', dark ? 'dark' : 'light');
};
document.documentElement.dataset.theme = localStorage.getItem(KEY + '_theme') || 'light';
// Tab/jendela lain mengubah data? Muat ulang supaya chat "terasa realtime" di prototype.
window.addEventListener('storage', e => { if (e.key === KEY && me) { db = load(); render(); } });
// Auto-login kalau sebelumnya sudah masuk
const saved = USERS.find(u => u.id === localStorage.getItem(KEY + '_me'));
if (saved) { me = saved; startApp(); }

// ---------- 10. PWA: daftarkan service worker (supaya bisa di-install & offline) ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW gagal:', err));
}
