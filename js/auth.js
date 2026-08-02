"use strict";

// ===== LOGIN GOOGLE (GIS Token Client) =====
// Hasilnya ID token (JWT). Token disimpan di memori + localStorage.
// Catatan: token tidak boleh disimpan di IndexedDB.

var TOKEN_SIMPAN = "abm_token";
var _tokenAktif = null;

try {
  _tokenAktif = localStorage.getItem(TOKEN_SIMPAN);
} catch (err) {
  _tokenAktif = null;
}

var _gisDimuat = false;
var _gisInit = false;

// Memuat library Google Identity Services secara dinamis.
function muatGis() {
  return new Promise(function (resolve, reject) {
    if (_gisDimuat) {
      resolve();
      return;
    }
    if (typeof window.google !== "undefined" && window.google.accounts) {
      _gisDimuat = true;
      resolve();
      return;
    }
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = function () {
      _gisDimuat = true;
      resolve();
    };
    s.onerror = function () {
      reject(new Error("Gagal memuat Google Sign-In"));
    };
    document.head.appendChild(s);
  });
}

// Menyiapkan tombol "Masuk dengan Google" di elemen #google-signin.
function initAuth() {
  if (_gisInit) {
    return;
  }

  if (!APP_CONFIG.CLIENT_ID || String(APP_CONFIG.CLIENT_ID).indexOf("GANTI_") === 0) {
    tampilkanCatatanLogin("CLIENT_ID belum diisi di js/config.js. Hubungi admin kantor.");
    return;
  }

  muatGis()
    .then(function () {
      google.accounts.id.initialize({
        client_id: APP_CONFIG.CLIENT_ID,
        callback: function (respons) {
          if (respons && respons.credential) {
            _tokenAktif = respons.credential;
            try {
              localStorage.setItem(TOKEN_SIMPAN, respons.credential);
            } catch (err) {
              // penyimpanan penuh / privat: lanjutkan dengan token di memori saja
            }
            if (window.onLoginCallback) {
              window.onLoginCallback();
            }
          }
        }
      });

      var el = document.getElementById("google-signin");
      if (el) {
        google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 280
        });
      }
      _gisInit = true;
    })
    .catch(function (err) {
      tampilkanCatatanLogin("Google Sign-In gagal dimuat. Periksa koneksi internet lalu muat ulang.");
    });
}

// Mengembalikan ID token saat ini, atau null jika belum login.
function getToken() {
  return _tokenAktif;
}

// Keluar: hentikan auto-select GIS, hapus simpanan, muat ulang.
function logout() {
  if (typeof window.google !== "undefined" && window.google.accounts) {
    try {
      google.accounts.id.disableAutoSelect();
    } catch (err) {
      // abaikan
    }
  }
  _tokenAktif = null;
  try {
    localStorage.removeItem(TOKEN_SIMPAN);
  } catch (err) {
    // abaikan
  }
  window.location.reload();
}

// Pesan kecil di layar login.
function tampilkanCatatanLogin(pesan) {
  var el = document.getElementById("login-catatan");
  if (el) {
    el.textContent = pesan;
    el.classList.remove("tersembunyi");
  }
}
