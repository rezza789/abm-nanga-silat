"use strict";

// ===== KOMUNIKASI DENGAN APPS SCRIPT =====
// Batasan keras (lihat arsitektur-teknis.md):
// - WAJIB Content-Type: text/plain (bukan application/json) agar tidak memicu preflight
// - Token dikirim DI DALAM BODY (bukan header custom)
// - Respons selalu JSON: {ok:true, data:...} atau {ok:false, error:"..."}

// Memanggil aksi backend. Berhasil -> mengembalikan data.
// Gagal -> melempar Error; error jaringan ditandai properti `jaringan = true`.
async function callApi(action, payload) {
  var token = getToken();
  if (!token) {
    throw new Error("Belum masuk. Silakan login ulang.");
  }

  var body = JSON.stringify({ token: token, action: action, payload: payload || {} });

  var resp;
  try {
    resp = await fetch(APP_CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body
    });
  } catch (err) {
    var eJaringan = new Error("Jaringan tidak tersedia");
    eJaringan.jaringan = true;
    throw eJaringan;
  }

  var teks;
  try {
    teks = await resp.text();
  } catch (err) {
    var eJaringan2 = new Error("Respons tidak terbaca (jaringan putus)");
    eJaringan2.jaringan = true;
    throw eJaringan2;
  }

  var hasil;
  try {
    hasil = JSON.parse(teks);
  } catch (err) {
    var eFormat = new Error("Respons server tidak terbaca: " + teks.slice(0, 120));
    throw eFormat;
  }

  if (!hasil || hasil.ok !== true) {
    var eServer = new Error(hasil && hasil.error ? hasil.error : "Terjadi kesalahan di server");
    throw eServer;
  }

  return hasil.data;
}
