// Service worker: menyimpan file aplikasi di HP supaya bisa dibuka offline.
// Naikkan angka VERSI setiap kali kamu mengubah file, supaya cache lama diganti.
const VERSI = 'kitaspace-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

// Saat di-install: simpan semua file ke cache
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
// Saat aktif: hapus cache versi lama
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k)))));
});
// Setiap permintaan: ambil dari cache dulu, kalau tidak ada baru ke internet
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
