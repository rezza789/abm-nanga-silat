"use strict";

// ===== SERVICE WORKER =====
// Pre-cache semua aset saat install, cache-first untuk aset statis.
// Permintaan ke Apps Script (POST lintas-origin) TIDAK pernah disentuh -> network-only.

var CACHE_NAMA = "abm-v1";

var ASET_PRACACHE = [
  "index.html",
  "css/style.css",
  "js/config.js",
  "js/api.js",
  "js/db.js",
  "js/auth.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(CACHE_NAMA)
      .then(function (cache) {
        return cache.addAll(ASET_PRACACHE);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (daftar) {
        return Promise.all(
          daftar
            .filter(function (nama) {
              return nama !== CACHE_NAMA;
            })
            .map(function (nama) {
              return caches.delete(nama);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  // Non-GET (termasuk POST ke Apps Script) -> network-only, jangan cache.
  if (req.method !== "GET") {
    return;
  }

  // Lintas-origin (URL Apps Script script.google.com) -> network-only.
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        return cached;
      }
      // Navigasi halaman utama saat offline -> pakai index.html dari cache.
      if (req.mode === "navigate") {
        return caches.match("index.html");
      }
      return fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var salinan = resp.clone();
          caches.open(CACHE_NAMA).then(function (cache) {
            cache.put(req, salinan);
          });
        }
        return resp;
      });
    })
  );
});

// Background Sync (Android Chrome): beri tahu halaman untuk mengirim antrean.
self.addEventListener("sync", function (e) {
  if (e.tag === "flush") {
    e.waitUntil(
      self.clients.matchAll().then(function (klien) {
        klien.forEach(function (k) {
          k.postMessage({ type: "flush" });
        });
      })
    );
  }
});
