"use strict";

// ===== INDEXEDDB (outbox / antrean offline) =====
// Tanpa library. Satu store "outbox" dengan keyPath "id".
// Item: { id, action, payload, queuedAt, retryCount }

var DB_NAMA = "abm-outbox";
var DB_VERSI = 1;
var STORE_OUTBOX = "outbox";

function bukaDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAMA, DB_VERSI);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
      }
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

// Tulis (atau perbarui) satu item antrean.
function tambahOutbox(item) {
  return bukaDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_OUTBOX, "readwrite");
      tx.objectStore(STORE_OUTBOX).put(item);
      tx.oncomplete = function () {
        db.close();
        resolve();
      };
      tx.onerror = function () {
        db.close();
        reject(tx.error);
      };
    });
  });
}

// Ambil semua antrean yang belum terkirim.
function ambilSemuaOutbox() {
  return bukaDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_OUTBOX, "readonly");
      var req = tx.objectStore(STORE_OUTBOX).getAll();
      req.onsuccess = function () {
        db.close();
        resolve(req.result || []);
      };
      req.onerror = function () {
        db.close();
        reject(req.error);
      };
    });
  });
}

// Hapus satu item dari antrean (setelah berhasil terkirim).
function hapusOutbox(id) {
  return bukaDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_OUTBOX, "readwrite");
      tx.objectStore(STORE_OUTBOX).delete(id);
      tx.oncomplete = function () {
        db.close();
        resolve();
      };
      tx.onerror = function () {
        db.close();
        reject(tx.error);
      };
    });
  });
}
