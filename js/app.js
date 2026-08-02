"use strict";

// ===== LOGIKA UTAMA APLIKASI =====
// Alur: login (GIS) -> layar menu -> form -> write-ahead ke outbox -> kirim.
// Offline-first: data ditulis ke IndexedDB DULU, lalu dicoba kirim.
// Flush otomatis saat: app dibuka, event online, dan Background Sync.

var SIMPAN_USER = "abm_user";
var SIMPAN_MASTER = "abm_master";
var TTL_MASTER = 60 * 60 * 1000; // 1 jam

var state = {
  user: null,
  master: null,
  formSekarang: null
};

var sedangFlush = false;
var timerToast = null;

// ---------- UTIL ----------

function $(id) {
  return document.getElementById(id);
}

function tanggalHariIni() {
  var d = new Date();
  var bulan = String(d.getMonth() + 1).padStart(2, "0");
  var tgl = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + bulan + "-" + tgl;
}

function buatIdAntrian() {
  return "q-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
}

function angka(nilai) {
  if (nilai === "" || nilai === null || nilai === undefined) {
    return "";
  }
  var n = Number(String(nilai).replace(",", "."));
  return isNaN(n) ? "" : n;
}

function formatRupiah(n) {
  var nilai = Number(n || 0);
  return "Rp " + nilai.toLocaleString("id-ID");
}

function tampilkanToast(pesan, jenis) {
  var el = $("toast");
  el.textContent = pesan;
  el.className = "toast " + (jenis || "info");
  void el.offsetWidth; // paksa reflow agar transisi berjalan
  el.classList.add("tampil");
  clearTimeout(timerToast);
  timerToast = setTimeout(function () {
    el.classList.remove("tampil");
  }, 4000);
}

function tampilkanPesanLogin(pesan) {
  var el = $("login-error");
  el.textContent = pesan;
  el.classList.remove("tersembunyi");
}

function simpanUser(data) {
  state.user = data;
  try {
    localStorage.setItem(
      SIMPAN_USER,
      JSON.stringify({ nama: data.nama || "", email: data.email || "", peran: data.peran || "" })
    );
  } catch (err) {
    // abaikan
  }
}

function bacaUserCache() {
  try {
    var mentah = localStorage.getItem(SIMPAN_USER);
    return mentah ? JSON.parse(mentah) : null;
  } catch (err) {
    return null;
  }
}

// ---------- LAYAR ----------

function tampilkanLayarLogin() {
  $("layar-login").classList.remove("tersembunyi");
  $("layar-utama").classList.add("tersembunyi");
}

function tampilkanLayarUtama(user) {
  $("layar-login").classList.add("tersembunyi");
  $("layar-utama").classList.remove("tersembunyi");
  $("nama-user").textContent = user.nama || user.email || "-";
  $("peran-user").textContent = user.peran || "";
  tampilkanMenu();
}

function tampilkanMenu() {
  $("isi-form").innerHTML = "";
  $("isi-menu").classList.remove("tersembunyi");

  var grid = document.createElement("div");
  grid.className = "menu-grid";

  MENU.forEach(function (m) {
    var tombol = document.createElement("button");
    tombol.type = "button";
    tombol.className = "menu-item";
    tombol.innerHTML =
      '<span class="menu-label">' + m.label + "</span>" +
      '<span class="menu-deskripsi">' + m.deskripsi + "</span>";
    tombol.addEventListener("click", function () {
      tampilkanForm(m.id);
    });
    grid.appendChild(tombol);
  });

  $("isi-menu").innerHTML = "";
  $("isi-menu").appendChild(grid);
}

// ---------- FORM (definisi) ----------

var MENU = [
  { id: "angkutan", label: "Angkutan", deskripsi: "Tiket angkutan tanah / batu" },
  { id: "bbm", label: "BBM", deskripsi: "Masuk, keluar, beli langsung" },
  { id: "hm", label: "HM Operator", deskripsi: "Jam kerja alat" },
  { id: "pengeluaran", label: "Pengeluaran", deskripsi: "Sparepart & operasional" },
  { id: "kas", label: "Kas", deskripsi: "Uang kas lapangan" }
];

var FORM = {
  angkutan: {
    aksi: "insertAngkutan",
    judul: "Tiket Angkutan",
    kolom: [
      { nama: "tanggal", label: "Tanggal", tipe: "date", wajib: true, awal: tanggalHariIni() },
      { nama: "no_spb", label: "No SPB / SPT", tipe: "text", wajib: true, placeholder: "Contoh: 59474" },
      { nama: "no_lambung", label: "No Lambung", tipe: "master", master: "unit", wajib: true, placeholder: "Ketik atau pilih, mis. ABMS-04" },
      { nama: "no_polisi", label: "No Polisi", tipe: "text", placeholder: "Contoh: KB 8916 WC" },
      { nama: "nama_supir", label: "Nama Supir", tipe: "master", master: "supir", wajib: true, placeholder: "Ketik atau pilih" },
      { nama: "kode_spk", label: "Kode SPK", tipe: "master", master: "spk", wajib: true, placeholder: "Contoh: SPK-107-TNKE" },
      { nama: "jenis_angkutan", label: "Jenis Angkutan", tipe: "select", opsi: ["TANAH", "BATU"], wajib: true },
      { nama: "kategori_jarak", label: "Kategori Jarak", tipe: "master", master: "jarak", wajib: true, placeholder: "Contoh: 0-5" },
      { nama: "volume_m3", label: "Volume (m3)", tipe: "number", wajib: true, placeholder: "Contoh: 4" },
      { nama: "jumlah_bucket", label: "Jumlah Bucket", tipe: "number", placeholder: "Contoh: 5" },
      { nama: "jam_berangkat", label: "Jam Berangkat", tipe: "time" },
      { nama: "jam_tiba", label: "Jam Tiba", tipe: "time" },
      { nama: "jam_bongkar", label: "Jam Bongkar", tipe: "time" },
      { nama: "lokasi_muat", label: "Lokasi Muat", tipe: "text", placeholder: "Contoh: NAJIN BLOK E-11" },
      { nama: "lokasi_bongkar", label: "Lokasi Bongkar", tipe: "text", placeholder: "Contoh: G-56/55" },
      { nama: "tipe_tiket", label: "Tipe Tiket", tipe: "select", opsi: ["BIASA", "TITIPAN"], awal: "BIASA", wajib: true },
      { tipe: "catatan", id: "catatan-titipan", teks: "Tiket titipan belum tentu masuk BAPP, tidak dihitung ke gaji." }
    ],
    buatPayload: function (fd, item) {
      return {
        tanggal: fd.tanggal,
        no_spb: fd.no_spb,
        no_lambung: fd.no_lambung,
        no_polisi: fd.no_polisi,
        nama_supir: fd.nama_supir,
        kode_spk: fd.kode_spk,
        jenis_angkutan: fd.jenis_angkutan,
        kategori_jarak: fd.kategori_jarak,
        volume_m3: angka(fd.volume_m3),
        jumlah_bucket: angka(fd.jumlah_bucket),
        jam_berangkat: fd.jam_berangkat,
        jam_tiba: fd.jam_tiba,
        jam_bongkar: fd.jam_bongkar,
        lokasi_muat: fd.lokasi_muat,
        lokasi_bongkar: fd.lokasi_bongkar,
        tipe_tiket: fd.tipe_tiket
      };
    },
    bindSetelah: function (form) {
      var tipe = form.querySelector('[name="tipe_tiket"]');
      var catatan = form.querySelector("#catatan-titipan");
      if (tipe && catatan) {
        function perbarui() {
          catatan.classList.toggle("tersembunyi", tipe.value !== "TITIPAN");
        }
        tipe.addEventListener("change", perbarui);
        perbarui();
      }
    }
  },

  bbm: {
    aksi: "insertBbm",
    judul: "BBM",
    kolom: [
      { nama: "tanggal", label: "Tanggal", tipe: "date", wajib: true, awal: tanggalHariIni() },
      { nama: "jenis", label: "Jenis", tipe: "select", opsi: ["MASUK", "KELUAR", "BELI_LANGSUNG"], wajib: true },
      { nama: "unit", label: "Unit", tipe: "master", master: "unit", wajib: true, placeholder: "Ketik atau pilih, mis. EXCA-23" },
      { nama: "nama_pengguna", label: "Nama Pengguna", tipe: "text", wajib: true, placeholder: "Siapa yang pakai" },
      { nama: "jumlah_liter", label: "Jumlah (liter)", tipe: "number", wajib: true, placeholder: "Contoh: 46" },
      { nama: "harga_per_liter", label: "Harga per Liter (Rp)", tipe: "number", wajib: true, placeholder: "Contoh: 20000" },
      { nama: "total_bbm", label: "Total", tipe: "total", id: "total-bbm" },
      { tipe: "blok", id: "blok-pinjam",
        isi: [
          { nama: "pinjam", label: "Pinjam (BBM DT Warga)", tipe: "checkbox" },
          { tipe: "catatan", id: "catatan-pinjam", teks: "BBM pinjam DT Warga: akan dipotong dari pembayaran mingguan." }
        ]
      },
      { nama: "sumber_dana", label: "Sumber Dana", tipe: "text", placeholder: "Contoh: ANITA / KAS_SITE" },
      { nama: "catatan", label: "Catatan", tipe: "textarea", placeholder: "Keterangan tambahan (opsional)" },
      { nama: "link_foto", label: "Link Foto (opsional)", tipe: "text", placeholder: "https://..." }
    ],
    buatPayload: function (fd, item) {
      return {
        id: item.id,
        tanggal: fd.tanggal,
        jenis: fd.jenis,
        unit: fd.unit,
        nama_pengguna: fd.nama_pengguna,
        kategori: fd.unit,
        jumlah_liter: angka(fd.jumlah_liter),
        harga_per_liter: angka(fd.harga_per_liter),
        pinjam: fd.pinjam,
        sumber_dana: fd.sumber_dana,
        catatan: fd.catatan,
        link_foto: fd.link_foto
      };
    },
    bindSetelah: function (form) {
      var jenis = form.querySelector('[name="jenis"]');
      var unit = form.querySelector('[name="unit"]');
      var blok = form.querySelector("#blok-pinjam");
      var liter = form.querySelector('[name="jumlah_liter"]');
      var harga = form.querySelector('[name="harga_per_liter"]');
      var total = form.querySelector("#total-bbm");

      function unitAdalahWarga(nilai) {
        var m = state.master || {};
        var ditemukan = null;
        (m.unit || []).forEach(function (u) {
          if (u.no_lambung === nilai) {
            ditemukan = u;
          }
        });
        if (ditemukan) {
          return ditemukan.jenis_unit === "DT_WARGA";
        }
        return /warga|wrg/i.test(nilai || "");
      }

      function perbaruiPinjam() {
        if (!blok) {
          return;
        }
        var tampil = jenis && jenis.value === "KELUAR" && unitAdalahWarga(unit ? unit.value : "");
        blok.classList.toggle("tersembunyi", !tampil);
        if (!tampil) {
          var cek = form.querySelector('[name="pinjam"]');
          if (cek) {
            cek.checked = false;
          }
        }
      }

      function perbaruiTotal() {
        if (total) {
          var hasil = angka(liter ? liter.value : "") * angka(harga ? harga.value : "");
          total.textContent = hasil ? "Total: " + formatRupiah(hasil) : "";
        }
      }

      if (jenis) {
        jenis.addEventListener("change", perbaruiPinjam);
      }
      if (unit) {
        unit.addEventListener("input", perbaruiPinjam);
        unit.addEventListener("change", perbaruiPinjam);
      }
      if (liter) {
        liter.addEventListener("input", perbaruiTotal);
      }
      if (harga) {
        harga.addEventListener("input", perbaruiTotal);
      }
      perbaruiPinjam();
      perbaruiTotal();
    }
  },

  hm: {
    aksi: "insertHm",
    judul: "HM Operator",
    kolom: [
      { nama: "tanggal", label: "Tanggal", tipe: "date", wajib: true, awal: tanggalHariIni() },
      { nama: "nama_operator", label: "Nama Operator", tipe: "master", master: "operator", wajib: true, placeholder: "Ketik atau pilih" },
      { nama: "no_lambung", label: "No Lambung", tipe: "master", master: "unit", wajib: true, placeholder: "Ketik atau pilih, mis. EXCA-23" },
      { nama: "tipe_alat", label: "Tipe Alat", tipe: "master", master: "tipe", placeholder: "Terisi otomatis, boleh diedit" },
      { nama: "hm_awal", label: "HM Awal", tipe: "number", wajib: true, placeholder: "Contoh: 909.3" },
      { nama: "hm_akhir", label: "HM Akhir", tipe: "number", wajib: true, placeholder: "Contoh: 916.2" },
      { nama: "total_hm", label: "Total HM", tipe: "total", id: "total-hm" },
      { nama: "bbm", label: "BBM (liter)", tipe: "number", placeholder: "Contoh: 161" },
      { nama: "kegiatan", label: "Kegiatan", tipe: "text", placeholder: "Contoh: BIKIN JALAN QUARRY" },
      { nama: "lokasi", label: "Lokasi", tipe: "text", placeholder: "Contoh: QUARRY TUBA" },
      { nama: "catatan", label: "Catatan", tipe: "textarea", placeholder: "Keterangan (opsional)" }
    ],
    buatPayload: function (fd, item) {
      return {
        id: item.id,
        tanggal: fd.tanggal,
        nama_operator: fd.nama_operator,
        no_lambung: fd.no_lambung,
        tipe_alat: fd.tipe_alat,
        hm_awal: angka(fd.hm_awal),
        hm_akhir: angka(fd.hm_akhir),
        bbm: angka(fd.bbm),
        kegiatan: fd.kegiatan,
        lokasi: fd.lokasi,
        catatan: fd.catatan
      };
    },
    bindSetelah: function (form) {
      var lambung = form.querySelector('[name="no_lambung"]');
      var tipe = form.querySelector('[name="tipe_alat"]');
      var awal = form.querySelector('[name="hm_awal"]');
      var akhir = form.querySelector('[name="hm_akhir"]');
      var total = form.querySelector("#total-hm");

      function isiTipe() {
        if (!tipe || !lambung) {
          return;
        }
        if (tipe.value) {
          return; // jangan timpa yang sudah diketik manual
        }
        var m = state.master || {};
        (m.unit || []).forEach(function (u) {
          if (u.no_lambung === lambung.value && u.tipe_alat) {
            tipe.value = u.tipe_alat;
          }
        });
      }

      function perbaruiTotal() {
        if (total) {
          var hasil = angka(akhir ? akhir.value : "") - angka(awal ? awal.value : "");
          total.textContent = !isNaN(hasil) && hasil ? "Total HM: " + hasil : "";
        }
      }

      if (lambung) {
        lambung.addEventListener("change", isiTipe);
        lambung.addEventListener("blur", isiTipe);
      }
      if (awal) {
        awal.addEventListener("input", perbaruiTotal);
      }
      if (akhir) {
        akhir.addEventListener("input", perbaruiTotal);
      }
      perbaruiTotal();
    }
  },

  pengeluaran: {
    aksi: "insertPengeluaran",
    judul: "Pengeluaran",
    kolom: [
      { nama: "tanggal", label: "Tanggal", tipe: "date", wajib: true, awal: tanggalHariIni() },
      { nama: "kategori", label: "Kategori", tipe: "select", opsi: ["SPAREPART", "OPERASIONAL", "MATERIAL", "LAINNYA"], wajib: true },
      { nama: "unit", label: "Unit", tipe: "master", master: "unit", wajib: true, placeholder: "Ketik atau pilih, mis. EXCA-23" },
      { nama: "keterangan", label: "Keterangan", tipe: "text", wajib: true, placeholder: "Rincian barang / pekerjaan" },
      { nama: "qty", label: "Qty", tipe: "number", wajib: true, placeholder: "Contoh: 2" },
      { nama: "satuan", label: "Satuan", tipe: "text", wajib: true, placeholder: "PCS / UNIT / ORANG / dll" },
      { nama: "nominal_satuan", label: "Nominal per Satuan (Rp)", tipe: "number", wajib: true, placeholder: "Contoh: 2069040" },
      { nama: "total_pengeluaran", label: "Total", tipe: "total", id: "total-pengeluaran" },
      { nama: "sumber_dana", label: "Sumber Dana", tipe: "text", placeholder: "Contoh: ANITA / KAS_SITE" },
      { nama: "link_foto", label: "Link Foto (opsional)", tipe: "text", placeholder: "https://..." },
      { nama: "lokasi_kerja", label: "Lokasi Kerja", tipe: "text", placeholder: "Contoh: QUARRY TUBA" }
    ],
    buatPayload: function (fd, item) {
      return {
        id: item.id,
        tanggal: fd.tanggal,
        kategori: fd.kategori,
        unit: fd.unit,
        keterangan: fd.keterangan,
        qty: angka(fd.qty),
        satuan: fd.satuan,
        nominal_satuan: angka(fd.nominal_satuan),
        sumber_dana: fd.sumber_dana,
        link_foto: fd.link_foto,
        lokasi_kerja: fd.lokasi_kerja
      };
    },
    bindSetelah: function (form) {
      var qty = form.querySelector('[name="qty"]');
      var nominal = form.querySelector('[name="nominal_satuan"]');
      var total = form.querySelector("#total-pengeluaran");

      function perbaruiTotal() {
        if (total) {
          var hasil = angka(qty ? qty.value : "") * angka(nominal ? nominal.value : "");
          total.textContent = hasil ? "Total: " + formatRupiah(hasil) : "";
        }
      }

      if (qty) {
        qty.addEventListener("input", perbaruiTotal);
      }
      if (nominal) {
        nominal.addEventListener("input", perbaruiTotal);
      }
      perbaruiTotal();
    }
  },

  kas: {
    aksi: "insertKas",
    judul: "Kas",
    kolom: [
      { nama: "tanggal", label: "Tanggal", tipe: "date", wajib: true, awal: tanggalHariIni() },
      { nama: "jenis", label: "Jenis", tipe: "select", opsi: ["MASUK", "KELUAR"], wajib: true },
      { nama: "kategori", label: "Kategori", tipe: "select", opsi: ["TRANSFER_KANTOR", "PENGELUARAN", "LAINNYA"], wajib: true },
      { nama: "nama", label: "Nama", tipe: "text", wajib: true, placeholder: "Penerima / pengirim" },
      { nama: "total_nominal", label: "Total Nominal (Rp)", tipe: "number", wajib: true, placeholder: "Contoh: 5000000" },
      { nama: "sumber_dana", label: "Sumber Dana", tipe: "text", placeholder: "Contoh: KANTOR" },
      { nama: "link_bukti", label: "Link Bukti (opsional)", tipe: "text", placeholder: "https://..." },
      { nama: "catatan", label: "Catatan", tipe: "textarea", placeholder: "Keterangan (opsional)" }
    ],
    buatPayload: function (fd, item) {
      return {
        id: item.id,
        tanggal: fd.tanggal,
        jenis: fd.jenis,
        kategori: fd.kategori,
        nama: fd.nama,
        total_nominal: angka(fd.total_nominal),
        sumber_dana: fd.sumber_dana,
        link_bukti: fd.link_bukti,
        catatan: fd.catatan
      };
    },
    bindSetelah: function (form) {
      // tidak ada logika khusus
    }
  }
};

// ---------- RENDER FORM ----------

function tampilkanForm(idForm) {
  var def = FORM[idForm];
  if (!def) {
    return;
  }
  state.formSekarang = idForm;
  $("isi-menu").classList.add("tersembunyi");
  $("isi-form").innerHTML = "";

  var kartu = document.createElement("div");
  kartu.className = "form-kartu";

  var judulBaris = document.createElement("div");
  judulBaris.className = "form-judul";
  var tombolKembali = document.createElement("button");
  tombolKembali.type = "button";
  tombolKembali.className = "tombol-kecil";
  tombolKembali.textContent = "Menu";
  tombolKembali.addEventListener("click", tampilkanMenu);
  var h2 = document.createElement("h2");
  h2.textContent = def.judul;
  judulBaris.appendChild(tombolKembali);
  judulBaris.appendChild(h2);
  kartu.appendChild(judulBaris);

  var form = document.createElement("form");
  form.id = "form-data";
  form.noValidate = false;

  def.kolom.forEach(function (k) {
    form.appendChild(buatField(k));
  });

  var tombolSimpan = document.createElement("button");
  tombolSimpan.type = "submit";
  tombolSimpan.className = "tombol";
  tombolSimpan.textContent = "Simpan";
  form.appendChild(tombolSimpan);

  kartu.appendChild(form);
  $("isi-form").appendChild(kartu);

  form.addEventListener("submit", function (e) {
    kirimForm(e, def);
  });

  if (def.bindSetelah) {
    def.bindSetelah(form);
  }

  window.scrollTo(0, 0);
}

function buatField(k) {
  var bungkus = document.createElement("div");
  bungkus.className = "kolom-field";

  // tipe khusus: catatan statis
  if (k.tipe === "catatan") {
    bungkus.className = "kolom-field";
    bungkus.id = k.id || "";
    var cat = document.createElement("div");
    cat.className = "catatan tersembunyi";
    cat.textContent = k.teks || "";
    bungkus.appendChild(cat);
    return bungkus;
  }

  // tipe khusus: blok berisi beberapa field (mis. checkbox + catatan)
  if (k.tipe === "blok") {
    bungkus.id = k.id || "";
    var isi = document.createElement("div");
    isi.className = "blok-isi";
    (k.isi || []).forEach(function (sub) {
      isi.appendChild(buatField(sub));
    });
    bungkus.appendChild(isi);
    return bungkus;
  }

  // tipe khusus: total otomatis (teks hasil hitung)
  if (k.tipe === "total") {
    var elTotal = document.createElement("div");
    elTotal.id = k.id || "";
    elTotal.className = "total-live";
    bungkus.appendChild(elTotal);
    return bungkus;
  }

  if (k.tipe !== "checkbox") {
    var label = document.createElement("label");
    label.textContent = k.label + (k.wajib ? " *" : "");
    label.setAttribute("for", "field-" + k.nama);
    bungkus.appendChild(label);
  }

  var input;
  if (k.tipe === "select") {
    input = document.createElement("select");
    input.id = "field-" + k.nama;
    input.name = k.nama;
    (k.opsi || []).forEach(function (o) {
      var op = document.createElement("option");
      op.value = o;
      op.textContent = o;
      if (k.awal === o) {
        op.selected = true;
      }
      input.appendChild(op);
    });
  } else if (k.tipe === "checkbox") {
    var kotak = document.createElement("div");
    kotak.className = "kotak-cek";
    input = document.createElement("input");
    input.type = "checkbox";
    input.id = "field-" + k.nama;
    input.name = k.nama;
    input.value = "YA";
    var teksCek = document.createElement("span");
    teksCek.textContent = k.label || "";
    kotak.appendChild(input);
    kotak.appendChild(teksCek);
    bungkus.appendChild(kotak);
    return bungkus;
  } else if (k.tipe === "textarea") {
    input = document.createElement("textarea");
    input.id = "field-" + k.nama;
    input.name = k.nama;
    input.rows = 3;
  } else {
    input = document.createElement("input");
    input.id = "field-" + k.nama;
    input.name = k.nama;
    input.type = k.tipe === "master" ? "text" : k.tipe;
    if (k.tipe === "number") {
      input.step = "any";
      input.inputMode = "decimal";
    }
  }

  if (k.awal && (k.tipe === "date" || k.tipe === "select")) {
    input.value = k.awal;
  }
  if (k.placeholder) {
    input.placeholder = k.placeholder;
  }
  if (k.wajib) {
    input.required = true;
  }
  if (k.master) {
    input.setAttribute("list", "datalist-" + k.master);
    input.autocomplete = "off";
  }

  bungkus.appendChild(input);
  return bungkus;
}

// ---------- KIRIM FORM (write-ahead -> kirim) ----------

function ambilNilaiForm(form, kolom) {
  var data = {};
  kolom.forEach(function (k) {
    if (!k.nama) {
      return;
    }
    var el = form.querySelector('[name="' + k.nama + '"]');
    if (!el) {
      return;
    }
    if (el.type === "checkbox") {
      data[k.nama] = el.checked ? "YA" : "";
    } else {
      data[k.nama] = (el.value || "").trim();
    }
  });
  return data;
}

async function kirimForm(event, def) {
  event.preventDefault();
  var form = event.target;
  var fd = ambilNilaiForm(form, def.kolom);

  var idBaru = buatIdAntrian();
  var item = {
    id: idBaru,
    action: def.aksi,
    payload: def.buatPayload(fd, { id: idBaru }),
    queuedAt: new Date().toISOString(),
    retryCount: 0
  };

  // 1. TULIS DULU ke outbox (write-ahead) - data aman walau sinyal mati.
  try {
    await tambahOutbox(item);
  } catch (err) {
    tampilkanToast("Gagal menyimpan di HP: " + err.message, "error");
    return;
  }
  await perbaruiStatusAntrean();

  // 2. Baru coba kirim ke server.
  try {
    var data = await callApi(def.aksi, item.payload);
    await hapusOutbox(item.id);
    await perbaruiStatusAntrean();
    if (data && data.status === "DUPLIKAT") {
      tampilkanToast("Data sudah pernah ada", "info");
    } else {
      tampilkanToast("Tersimpan", "sukses");
    }
  } catch (err) {
    if (err.jaringan) {
      tampilkanToast("Tersimpan di HP, akan terkirim saat sinyal ada", "info");
    } else {
      // Kesalahan server (mis. format salah): tetap tinggal di antrean,
      // biarkan terlihat di daftar antrean untuk dicek admin.
      tampilkanToast("Gagal terkirim: " + err.message, "error");
    }
  }

  // 3. Form direset agar bisa langsung isi data berikutnya.
  tampilkanForm(state.formSekarang);
}

// ---------- ANTREAN & SINKRONISASI ----------

async function perbaruiStatusAntrean() {
  try {
    var items = await ambilSemuaOutbox();
    var el = $("status-antrean");
    if (items.length === 0) {
      el.classList.add("tersembunyi");
      return;
    }
    el.classList.remove("tersembunyi");
    $("teks-antrean").textContent =
      items.length + " data belum terkirim (tersimpan di HP)";
  } catch (err) {
    // IndexedDB tidak tersedia: abaikan, biarkan bar tersembunyi
  }
}

async function flushAntrean() {
  if (sedangFlush) {
    return;
  }
  sedangFlush = true;
  var terkirim = 0;
  try {
    if (!getToken()) {
      return;
    }
    var items = await ambilSemuaOutbox();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        await callApi(item.action, item.payload);
        await hapusOutbox(item.id);
        terkirim++;
      } catch (err) {
        if (err.jaringan) {
          break; // sinyal hilang lagi: berhenti, sisanya menunggu
        }
        // error server: naikkan retryCount, lanjut ke berikutnya
        item.retryCount = (item.retryCount || 0) + 1;
        try {
          await tambahOutbox(item);
        } catch (err2) {
          // abaikan
        }
      }
    }
    if (terkirim > 0) {
      tampilkanToast(terkirim + " data terkirim", "sukses");
    }
  } catch (err) {
    // abaikan
  } finally {
    sedangFlush = false;
    await perbaruiStatusAntrean();
  }
}

// ---------- MASTER (dropdown) ----------

function simpanCacheMaster(data) {
  try {
    localStorage.setItem(SIMPAN_MASTER, JSON.stringify({ waktu: Date.now(), data: data }));
  } catch (err) {
    // abaikan
  }
}

function bacaCacheMaster(abaikanTtl) {
  try {
    var mentah = localStorage.getItem(SIMPAN_MASTER);
    if (!mentah) {
      return null;
    }
    var obj = JSON.parse(mentah);
    if (!obj || !obj.data) {
      return null;
    }
    if (!abaikanTtl && Date.now() - (obj.waktu || 0) > TTL_MASTER) {
      return null;
    }
    return obj;
  } catch (err) {
    return null;
  }
}

async function muatMaster() {
  var cache = bacaCacheMaster(false);
  if (cache) {
    state.master = cache.data;
    bangunDatalist();
  }
  try {
    var data = await callApi("getMaster", {
      kebutuhan: ["spk", "unit", "karyawan", "tarif"]
    });
    state.master = data || {};
    simpanCacheMaster(state.master);
    bangunDatalist();
  } catch (err) {
    // offline tanpa cache valid: pakai cache basi bila ada
    if (!state.master) {
      var cacheBasi = bacaCacheMaster(true);
      if (cacheBasi) {
        state.master = cacheBasi.data;
        bangunDatalist();
      }
    }
  }
}

function bangunDatalist() {
  var m = state.master || {};
  var akar = document.body;

  // hapus datalist lama
  [
    "datalist-unit",
    "datalist-supir",
    "datalist-operator",
    "datalist-spk",
    "datalist-jarak",
    "datalist-tipe"
  ].forEach(function (id) {
    var lama = document.getElementById(id);
    if (lama) {
      lama.remove();
    }
  });

  function buat(id, isi) {
    var dl = document.createElement("datalist");
    dl.id = id;
    (isi || []).forEach(function (o) {
      var op = document.createElement("option");
      op.value = o.nilai;
      if (o.label) {
        op.label = o.label;
      }
      dl.appendChild(op);
    });
    akar.appendChild(dl);
  }

  var unit = (m.unit || []).map(function (u) {
    return {
      nilai: u.no_lambung,
      label: [u.no_polisi, u.tipe_alat].filter(Boolean).join(" - ")
    };
  });
  unit.push({ nilai: "TANPA_UNIT", label: "tanpa unit" });
  unit.push({ nilai: "SEMUA_DT", label: "semua DT" });
  buat("datalist-unit", unit);

  var semuaKaryawan = m.karyawan || [];
  buat(
    "datalist-supir",
    semuaKaryawan
      .filter(function (k) {
        return k.kelompok === "SUPIR_ABM" || k.kelompok === "DT_WARGA";
      })
      .map(function (k) {
        return { nilai: k.nama, label: k.kelompok };
      })
  );
  buat(
    "datalist-operator",
    semuaKaryawan
      .filter(function (k) {
        return k.kelompok === "OPERATOR" || k.jabatan === "OPERATOR";
      })
      .map(function (k) {
        return { nilai: k.nama, label: k.kelompok };
      })
  );
  buat(
    "datalist-spk",
    (m.spk || []).map(function (s) {
      return {
        nilai: s.kode_spk,
        label: [s.lokasi, s.harga_per_m3 ? "Rp " + Number(s.harga_per_m3).toLocaleString("id-ID") + "/m3" : ""]
          .filter(Boolean)
          .join(" - ")
      };
    })
  );
  var jarak = Array.from(
    new Set((m.tarif || []).map(function (t) { return t.kategori_jarak; }).filter(Boolean))
  );
  buat(
    "datalist-jarak",
    jarak.map(function (j) {
      return { nilai: j, label: "km" };
    })
  );
  var tipeAlat = Array.from(
    new Set((m.unit || []).map(function (u) { return u.tipe_alat; }).filter(Boolean))
  );
  buat(
    "datalist-tipe",
    tipeAlat.map(function (t) {
      return { nilai: t, label: "" };
    })
  );
}

// ---------- LOGIN ----------

async function cobaLogin() {
  var data = await callApi("login", {});
  simpanUser(data);
  tampilkanLayarUtama(data);
  muatMaster();
  return data;
}

window.onLoginCallback = async function () {
  $("login-error").classList.add("tersembunyi");
  $("login-error").textContent = "";
  try {
    await cobaLogin();
  } catch (err) {
    var pesan = err.message || "";
    if (/tidak terdaftar|tidak dikenal|not registered|belum terdaftar/i.test(pesan)) {
      tampilkanPesanLogin("Akun tidak terdaftar, hubungi admin kantor.");
    } else if (err.jaringan) {
      var cacheUser = bacaUserCache();
      if (cacheUser && cacheUser.email) {
        tampilkanLayarUtama(cacheUser);
        muatMaster();
      } else {
        tampilkanPesanLogin("Tidak ada sinyal, akun belum bisa diverifikasi. Coba lagi saat online.");
      }
    } else {
      tampilkanPesanLogin("Gagal masuk: " + pesan);
    }
  }
};

// ---------- SERVICE WORKER & SYNC ----------

function daftarServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker
    .register("./sw.js")
    .then(function (reg) {
      // Background Sync (Android Chrome): bonus lapisan flush
      if (reg.sync) {
        reg.sync.register("flush").catch(function () {
          // tidak didukung: diabaikan, flush tetap jalan lewat event online & buka app
        });
      }
    })
    .catch(function (err) {
      console.warn("Service worker gagal didaftarkan:", err);
    });

  navigator.serviceWorker.addEventListener("message", function (e) {
    if (e.data && e.data.type === "flush") {
      flushAntrean();
    }
  });
}

// ---------- INISIALISASI ----------

function tampilkanCatatanKonfig() {
  var pesan = [];
  if (!APP_CONFIG.APPS_SCRIPT_URL || String(APP_CONFIG.APPS_SCRIPT_URL).indexOf("GANTI_") === 0) {
    pesan.push("URL Apps Script belum diisi di js/config.js");
  }
  if (!APP_CONFIG.CLIENT_ID || String(APP_CONFIG.CLIENT_ID).indexOf("GANTI_") === 0) {
    pesan.push("Client ID Google belum diisi di js/config.js");
  }
  if (pesan.length) {
    var el = $("login-catatan");
    el.textContent = "PENTING: " + pesan.join(" dan ") + ". Hubungi admin kantor.";
    el.classList.remove("tersembunyi");
  }
}

function init() {
  tampilkanCatatanKonfig();

  var token = getToken();
  if (token) {
    var cacheUser = bacaUserCache();
    if (cacheUser && cacheUser.email) {
      tampilkanLayarUtama(cacheUser);
      muatMaster();
    } else {
      tampilkanLayarLogin();
      initAuth();
    }
    // validasi token di latar belakang (perbarui nama/peran bila berubah)
    cobaLogin().catch(function () {
      // gagal (offline / user tak terdaftar): tetap biarkan aplikasi jalan
    });
  } else {
    tampilkanLayarLogin();
    initAuth();
  }

  perbaruiStatusAntrean();

  window.addEventListener("online", function () {
    flushAntrean();
  });
}

window.addEventListener("DOMContentLoaded", function () {
  daftarServiceWorker();

  $("tombol-keluar").addEventListener("click", function () {
    logout();
  });
  $("tombol-kirim-sekarang").addEventListener("click", function () {
    flushAntrean();
  });

  init();
});
