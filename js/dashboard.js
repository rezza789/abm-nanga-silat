"use strict";

// ===== DASHBOARD MODULE =====
// Rekap, Margin, BAPP, Gaji - sortable, filterable, exportable

var DASHBOARD = {
  state: {
    currentTab: "rekap",        // rekap | margin | bapp | gaji
    filters: {},
    sort: { by: "", order: "asc" },
    page: 1,
    pageSize: 50,
    data: [],
    columns: [],
    meta: {},
    masterCache: null
  },

  // Definisi tab
  tabs: [
    { id: "rekap", label: "Rekap Angkutan", icon: "📊" },
    { id: "margin", label: "Margin Unit", icon: "💰" },
    { id: "bapp", label: "BAPP / Invoice", icon: "📄" },
    { id: "gaji", label: "Rekap Gaji", icon: "👥" }
  ],

  // Definisi kolom per tab
  columnDefs: {
    rekap: [
      { key: "noSpb", label: "No SPB", type: "text" },
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "supir", label: "Supir", type: "text" },
      { key: "spk", label: "SPK", type: "text" },
      { key: "jenis", label: "Jenis", type: "text" },
      { key: "jarak", label: "Jarak", type: "text" },
      { key: "volume", label: "Volume (m³)", type: "number" },
      { key: "pendapatan", label: "Pendapatan", type: "currency" },
      { key: "statusBapp", label: "Status BAPP", type: "badge" }
    ],
    rekap_group_spk: [
      { key: "group", label: "SPK", type: "text" },
      { key: "totalTiket", label: "Total Tiket", type: "number" },
      { key: "totalVolume", label: "Total Volume", type: "number" },
      { key: "totalPendapatan", label: "Total Pendapatan", type: "currency" },
      { key: "rataVolume", label: "Rata² Volume", type: "number" }
    ],
    rekap_group_unit: [
      { key: "group", label: "Unit", type: "text" },
      { key: "jenisUnit", label: "Jenis", type: "text" },
      { key: "tipeAlat", label: "Tipe", type: "text" },
      { key: "totalTiket", label: "Total Tiket", type: "number" },
      { key: "totalVolume", label: "Total Volume", type: "number" },
      { key: "totalPendapatan", label: "Total Pendapatan", type: "currency" }
    ],
    rekap_group_supir: [
      { key: "group", label: "Supir", type: "text" },
      { key: "totalTiket", label: "Total Ritase", type: "number" },
      { key: "totalVolume", label: "Total Volume", type: "number" },
      { key: "totalPendapatan", label: "Est. Gaji Ritase", type: "currency" }
    ],
    rekap_group_tanggal: [
      { key: "group", label: "Tanggal", type: "date" },
      { key: "totalTiket", label: "Total Tiket", type: "number" },
      { key: "totalVolume", label: "Total Volume", type: "number" },
      { key: "totalPendapatan", label: "Total Pendapatan", type: "currency" }
    ],
    margin: [
      { key: "unit", label: "Unit", type: "text" },
      { key: "noPolisi", label: "No Polisi", type: "text" },
      { key: "jenisUnit", label: "Jenis", type: "badge" },
      { key: "tipeAlat", label: "Tipe Alat", type: "text" },
      { key: "pendapatan", label: "Pendapatan", type: "currency" },
      { key: "bebanBbm", label: "Beban BBM", type: "currency" },
      { key: "bebanPengeluaran", label: "Beban Pengeluaran", type: "currency" },
      { key: "totalBeban", label: "Total Beban", type: "currency" },
      { key: "margin", label: "Margin", type: "currency" },
      { key: "marginPersen", label: "Margin %", type: "percent" }
    ],
    bapp: [
      { key: "id", label: "ID BAPP", type: "text" },
      { key: "periode", label: "Periode", type: "text" },
      { key: "spk", label: "SPK", type: "text" },
      { key: "nilaiBapp", label: "Nilai BAPP", type: "currency" },
      { key: "tuslah", label: "Tuslah", type: "currency" },
      { key: "ppn", label: "PPN 11%", type: "currency" },
      { key: "retensi", label: "Retensi 10%", type: "currency" },
      { key: "pph", label: "PPh 2%", type: "currency" },
      { key: "totalTagihan", label: "Total Tagihan", type: "currency" },
      { key: "statusBayar", label: "Status Bayar", type: "badge" },
      { key: "tglBayar", label: "Tgl Bayar", type: "date" }
    ],
    gaji: [
      { key: "id", label: "ID Gaji", type: "text" },
      { key: "periode", label: "Periode", type: "text" },
      { key: "nama", label: "Nama", type: "text" },
      { key: "kelompok", label: "Kelompok", type: "badge" },
      { key: "rincian", label: "Rincian", type: "text" },
      { key: "totalKotor", label: "Kotor", type: "currency" },
      { key: "potonganPinjaman", label: "Pot. Pinjaman", type: "currency" },
      { key: "totalBersih", label: "Bersih", type: "currency" },
      { key: "status", label: "Status", type: "badge" }
    ]
  },

  // Filter options per tab
  filterDefs: {
    rekap: [
      { key: "spk", label: "SPK", type: "select", master: "spk" },
      { key: "unit", label: "Unit", type: "select", master: "unit" },
      { key: "supir", label: "Supir", type: "select", master: "supir" },
      { key: "jenisAngkutan", label: "Jenis Angkutan", type: "select", options: ["TANAH", "BATU"] },
      { key: "kategoriJarak", label: "Kategori Jarak", type: "select", master: "jarak" },
      { key: "tipeTiket", label: "Tipe Tiket", type: "select", options: ["BIASA", "TITIPAN"] },
      { key: "statusBapp", label: "Status BAPP", type: "select", options: ["BELUM", "MASUK_BAPP", "DITOLAK"] },
      { key: "groupBy", label: "Group By", type: "select", options: [
        { value: "", label: "Detail" },
        { value: "spk", label: "Per SPK" },
        { value: "unit", label: "Per Unit" },
        { value: "supir", label: "Per Supir" },
        { value: "tanggal", label: "Per Tanggal" },
        { value: "jenis", label: "Per Jenis" },
        { value: "jarak", label: "Per Jarak" }
      ]},
      { key: "tglAwal", label: "Tgl Awal", type: "date" },
      { key: "tglAkhir", label: "Tgl Akhir", type: "date" }
    ],
    margin: [
      { key: "tglAwal", label: "Tgl Awal", type: "date" },
      { key: "tglAkhir", label: "Tgl Akhir", type: "date" }
    ],
    bapp: [
      { key: "spk", label: "SPK", type: "select", master: "spk" },
      { key: "status", label: "Status Bayar", type: "select", options: ["BELUM", "DIBAYAR"] },
      { key: "tglAwal", label: "Tgl Awal", type: "date" },
      { key: "tglAkhir", label: "Tgl Akhir", type: "date" }
    ],
    gaji: [
      { key: "periode", label: "Periode Gaji", type: "select", master: "gaji_periode" },
      { key: "kelompok", label: "Kelompok", type: "select", options: ["SUPIR_ABM", "OPERATOR", "STAFF", "DT_WARGA"] }
    ]
  },

  // Inisialisasi dashboard
  init: function() {
    this.loadMasterData();
    this.render();
  },

  // Load master data untuk dropdown filter
  loadMasterData: function() {
    var self = this;
    callApi("getMaster", {
      kebutuhan: ["spk", "unit", "karyawan", "tarif", "aturan_gaji", "pinjaman"]
    }).then(function(res) {
      self.state.masterCache = res.data;
      self.populateFilterOptions();
      self.loadTabData(self.state.currentTab);
    }).catch(function(err) {
      console.error("Gagal load master:", err);
      tampilkanToast("Gagal memuat data master: " + err.message, "error");
    });
  },

  // Populate filter dropdowns
  populateFilterOptions: function() {
    var m = this.state.masterCache;
    if (!m) return;

    // Helper untuk isi select
    function fillSelect(selId, items, valueKey, labelKey) {
      var sel = $(selId);
      if (!sel) return;
      var current = sel.value;
      sel.innerHTML = '<option value="">Semua</option>';
      items.forEach(function(item) {
        var opt = document.createElement("option");
        opt.value = item[valueKey];
        opt.textContent = item[labelKey] || item[valueKey];
        sel.appendChild(opt);
      });
      sel.value = current;
    }

    if (m.spk) fillSelect("flt-spk", m.spk, "kode_spk", "kode_spk");
    if (m.unit) fillSelect("flt-unit", m.unit, "no_lambung", "no_lambung");
    if (m.karyawan) {
      var supir = m.karyawan.filter(function(k) { return k.kelompok === "SUPIR_ABM"; });
      fillSelect("flt-supir", supir, "nama", "nama");
    }
    if (m.tarif) {
      var jarak = [...new Set(m.tarif.map(function(t) { return t.kategori_jarak; }))].sort();
      var sel = $("flt-kategoriJarak");
      if (sel) {
        sel.innerHTML = '<option value="">Semua</option>';
        jarak.forEach(function(j) {
          var opt = document.createElement("option");
          opt.value = j;
          opt.textContent = j;
          sel.appendChild(opt);
        });
      }
    }
    // Periode gaji
    if (m.aturan_gaji) {
      // Ambil dari G_PERIODE sheet nanti
    }
  },

  // Render seluruh dashboard UI
  render: function() {
    var html = "";
    html += '<div class="dashboard-wrap">';

    // Tabs
    html += '<div class="dashboard-tabs" role="tablist">';
    this.tabs.forEach(function(tab) {
      var active = tab.id === DASHBOARD.state.currentTab ? "active" : "";
      html += '<button class="dashboard-tab ' + active + '" role="tab" data-tab="' + tab.id + '">' +
              '<span class="tab-icon">' + tab.icon + '</span>' +
              '<span class="tab-label">' + tab.label + '</span>' +
            '</button>';
    });
    html += '</div>';

    // Filter panel
    html += '<div class="dashboard-filters" id="dashboard-filters"></div>';

    // Toolbar
    html += '<div class="dashboard-toolbar">';
    html += '<div class="toolbar-left">';
    html += '<span class="toolbar-info" id="toolbar-info">Memuat...</span>';
    html += '</div>';
    html += '<div class="toolbar-right">';
    html += '<button class="tombol tombol-kecil" id="btn-export-excel" type="button">📊 Excel</button>';
    html += '<button class="tombol tombol-kecil" id="btn-export-pdf" type="button">📄 PDF</button>';
    html += '<button class="tombol tombol-kecil" id="btn-refresh" type="button">🔄 Refresh</button>';
    html += '</div>';
    html += '</div>';

    // Table container
    html += '<div class="dashboard-table-wrap">';
    html += '<table class="dashboard-table" id="dashboard-table">';
    html += '<thead id="dashboard-thead"></thead>';
    html += '<tbody id="dashboard-tbody"></tbody>';
    html += '</table>';
    html += '</div>';

    // Pagination
    html += '<div class="dashboard-pagination" id="dashboard-pagination"></div>';

    // Chart container (untuk tab margin)
    html += '<div class="dashboard-chart-wrap" id="dashboard-chart-wrap" style="display:none;">';
    html += '<canvas id="dashboard-chart"></canvas>';
    html += '</div>';

    html += '</div>';

    $("isi-form").innerHTML = html;

    // Event listeners
    this.bindEvents();
  },

  // Bind events
  bindEvents: function() {
    var self = this;

    // Tab click
    document.querySelectorAll(".dashboard-tab").forEach(function(btn) {
      btn.addEventListener("click", function() {
        self.switchTab(this.dataset.tab);
      });
    });

    // Filter change
    document.querySelectorAll("#dashboard-filters select, #dashboard-filters input").forEach(function(el) {
      el.addEventListener("change", function() {
        self.state.filters[this.name] = this.value;
        self.state.page = 1;
        self.loadTabData(self.state.currentTab);
      });
    });

    // Sort header click
    document.querySelectorAll("#dashboard-thead th[data-sort]").forEach(function(th) {
      th.addEventListener("click", function() {
        var key = this.dataset.sort;
        if (self.state.sort.by === key) {
          self.state.sort.order = self.state.sort.order === "asc" ? "desc" : "asc";
        } else {
          self.state.sort.by = key;
          self.state.sort.order = "asc";
        }
        self.renderTable();
      });
    });

    // Export buttons
    var btnExcel = $("btn-export-excel");
    var btnPdf = $("btn-export-pdf");
    var btnRefresh = $("btn-refresh");
    if (btnExcel) btnExcel.addEventListener("click", function() { self.exportExcel(); });
    if (btnPdf) btnPdf.addEventListener("click", function() { self.exportPDF(); });
    if (btnRefresh) btnRefresh.addEventListener("click", function() { self.loadTabData(self.state.currentTab); });

    // Pagination
    var pag = $("dashboard-pagination");
    if (pag) {
      pag.addEventListener("click", function(e) {
        var btn = e.target.closest("button[data-page]");
        if (btn) {
          self.state.page = parseInt(btn.dataset.page);
          self.loadTabData(self.state.currentTab);
        }
      });
    }
  },

  // Switch tab
  switchTab: function(tabId) {
    this.state.currentTab = tabId;
    this.state.filters = {};
    this.state.sort = { by: "", order: "asc" };
    this.state.page = 1;

    // Update tab UI
    document.querySelectorAll(".dashboard-tab").forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    // Render filter panel untuk tab ini
    this.renderFilters();
    this.loadTabData(tabId);
  },

  // Render filter panel
  renderFilters: function() {
    var defs = this.filterDefs[this.state.currentTab] || [];
    var m = this.state.masterCache;

    var html = '<div class="filter-row">';
    defs.forEach(function(f) {
      var id = "flt-" + f.key;
      html += '<div class="filter-item">';
      html += '<label for="' + id + '">' + f.label + '</label>';

      if (f.type === "select") {
        html += '<select id="' + id + '" name="' + f.key + '"><option value="">Semua</option>';
        if (f.master && m) {
          var items = m[f.master] || [];
          var vk = f.master === "spk" ? "kode_spk" : (f.master === "unit" ? "no_lambung" : "nama");
          var lk = f.master === "spk" ? "kode_spk" : (f.master === "unit" ? "no_lambung" : "nama");
          items.forEach(function(item) {
            html += '<option value="' + item[vk] + '">' + item[lk] + '</option>';
          });
        } else if (f.options) {
          f.options.forEach(function(opt) {
            var val = opt.value || opt;
            var lbl = opt.label || opt;
            html += '<option value="' + val + '">' + lbl + '</option>';
          });
        }
        html += '</select>';
      } else if (f.type === "date") {
        html += '<input type="date" id="' + id + '" name="' + f.key + '">';
      }
      html += '</div>';
    });
    html += '</div>';

    $("dashboard-filters").innerHTML = html;
  },

  // Load data untuk tab aktif
  loadTabData: function(tab) {
    var self = this;
    var tahun = new Date().getFullYear();
    var payload = { tahun: tahun };
    Object.assign(payload, this.state.filters);
    Object.assign(payload, this.state.sort);
    payload.page = this.state.page;
    payload.pageSize = this.state.pageSize;

    var actionMap = {
      rekap: "getRekap",
      margin: "getMarginUnit",
      bapp: "getBappList",
      gaji: "getGajiRekap"
    };

    tampilkanToast("Memuat data...", "info");

    callApi(actionMap[tab], payload).then(function(res) {
      self.state.data = res.data || [];
      self.state.meta = res.meta || {};
      self.state.columns = self.getColumnsForTab(tab);
      self.renderTable();
      self.updateToolbarInfo();
      if (tab === "margin") self.renderChart();
      tampilkanToast("Data dimuat: " + self.state.data.length + " baris", "success");
    }).catch(function(err) {
      console.error("Gagal load " + tab + ":", err);
      tampilkanToast("Gagal memuat data: " + err.message, "error");
      self.state.data = [];
      self.renderTable();
    });
  },

  // Get column definitions for current tab
  getColumnsForTab: function(tab) {
    var groupBy = this.state.filters.groupBy || "";
    if (tab === "rekap" && groupBy) {
      return this.columnDefs["rekap_group_" + groupBy] || this.columnDefs.rekap;
    }
    return this.columnDefs[tab] || [];
  },

  // Render table
  renderTable: function() {
    var thead = $("dashboard-thead");
    var tbody = $("dashboard-tbody");
    var cols = this.state.columns;
    var data = this.state.data;

    // Header
    var thHtml = '<tr>';
    cols.forEach(function(col) {
      var sortable = col.type === "number" || col.type === "currency" || col.type === "date" ? 'data-sort="' + col.key + '"' : '';
      var sortIcon = "";
      if (sortable) {
        sortIcon = DASHBOARD.state.sort.by === col.key
          ? (DASHBOARD.state.sort.order === "asc" ? " ▲" : " ▼")
          : "";
      }
      thHtml += '<th ' + sortable + ' style="cursor:' + (sortable ? 'pointer' : 'default') + '">' + col.label + sortIcon + '</th>';
    });
    thHtml += '</tr>';
    thead.innerHTML = thHtml;

    // Body
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="text-center">Tidak ada data</td></tr>';
      this.renderPagination(0);
      return;
    }

    var trHtml = "";
    data.forEach(function(row) {
      trHtml += '<tr>';
      cols.forEach(function(col) {
        var val = row[col.key];
        var tdClass = "";
        var formatted = "";

        switch (col.type) {
          case "currency":
            formatted = formatRupiah(val);
            tdClass = "text-right";
            break;
          case "number":
            formatted = typeof val === "number" ? val.toLocaleString("id-ID") : (val || "");
            tdClass = "text-right";
            break;
          case "percent":
            formatted = typeof val === "number" ? val.toFixed(1) + "%" : "";
            tdClass = "text-right";
            break;
          case "date":
            formatted = val || "";
            break;
          case "badge":
            formatted = '<span class="badge badge-' + (val || "").toLowerCase().replace("_", "-") + '">' + (val || "") + '</span>';
            break;
          default:
            formatted = val || "";
        }

        trHtml += '<td class="' + tdClass + '">' + formatted + '</td>';
      });
      trHtml += '</tr>';
    });
    tbody.innerHTML = trHtml;

    this.renderPagination(this.state.meta.total || data.length);
  },

  // Render pagination
  renderPagination: function(totalItems) {
    var pag = $("dashboard-pagination");
    if (!pag) return;

    var totalPages = Math.ceil(totalItems / this.state.pageSize);
    var page = this.state.page;

    if (totalPages <= 1) {
      pag.innerHTML = "";
      return;
    }

    var html = '<div class="pagination">';
    // Prev
    html += '<button class="tombol-kecil" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';

    // Page numbers
    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, page + 2);
    if (start > 1) {
      html += '<button class="tombol-kecil" data-page="1">1</button>';
      if (start > 2) html += '<span class="pagination-ellipsis">…</span>';
    }
    for (var i = start; i <= end; i++) {
      html += '<button class="tombol-kecil ' + (i === page ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (end < totalPages) {
      if (end < totalPages - 1) html += '<span class="pagination-ellipsis">…</span>';
      html += '<button class="tombol-kecil" data-page="' + totalPages + '">' + totalPages + '</button>';
    }

    // Next
    html += '<button class="tombol-kecil" data-page="' + (page + 1) + '"' + (page >= totalPages ? ' disabled' : '') + '>›</button>';
    html += '</div>';

    pag.innerHTML = html;
  },

  // Update toolbar info
  updateToolbarInfo: function() {
    var info = $("toolbar-info");
    if (!info) return;
    var m = this.state.meta;
    var txt = "Total: " + (m.total || this.state.data.length) + " baris";
    if (m.sumVolume !== undefined) txt += " | Volume: " + m.sumVolume.toLocaleString("id-ID") + " m³";
    if (m.sumPendapatan !== undefined) txt += " | Pendapatan: " + formatRupiah(m.sumPendapatan);
    if (m.totalPendapatan !== undefined) txt += " | Pendapatan: " + formatRupiah(m.totalPendapatan);
    if (m.totalMargin !== undefined) txt += " | Margin: " + formatRupiah(m.totalMargin);
    if (m.totalTagihan !== undefined) txt += " | Tagihan: " + formatRupiah(m.totalTagihan);
    if (m.totalKotor !== undefined) txt += " | Kotor: " + formatRupiah(m.totalKotor) + " | Bersih: " + formatRupiah(m.totalBersih);
    info.textContent = txt;
  },

  // Render chart untuk margin
  renderChart: function() {
    var wrap = $("dashboard-chart-wrap");
    var canvas = $("dashboard-chart");
    if (!canvas || !wrap) return;

    // Load Chart.js jika belum ada
    if (typeof Chart === "undefined") {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
      script.onload = function() { DASHBOARD.drawMarginChart(); };
      document.head.appendChild(script);
    } else {
      this.drawMarginChart();
    }
    wrap.style.display = "block";
  },

  drawMarginChart: function() {
    var canvas = $("dashboard-chart");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var data = this.state.data;

    if (window.marginChart) window.marginChart.destroy();

    window.marginChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(function(d) { return d.unit; }),
        datasets: [
          { label: "Pendapatan", data: data.map(function(d) { return d.pendapatan; }), backgroundColor: "#22c55e" },
          { label: "Beban BBM", data: data.map(function(d) { return d.bebanBbm; }), backgroundColor: "#ef4444" },
          { label: "Beban Pengeluaran", data: data.map(function(d) { return d.bebanPengeluaran; }), backgroundColor: "#f59e0b" },
          { label: "Margin", data: data.map(function(d) { return d.margin; }), backgroundColor: "#3b82f6", type: "line", yAxisID: "y1", borderWidth: 3, fill: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          title: { display: true, text: "Margin per Unit" }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Rupiah" } },
          y1: { type: "linear", display: true, position: "right", title: { display: true, text: "Margin" }, grid: { drawOnChartArea: false } }
        }
      }
    });
  },

  // Export Excel
  exportExcel: function() {
    if (typeof XLSX === "undefined") {
      this.loadSheetJS(function() { DASHBOARD.exportExcel(); });
      return;
    }
    this.doExportExcel();
  },

  doExportExcel: function() {
    var cols = this.state.columns;
    var data = this.state.data;

    var wsData = [cols.map(function(c) { return c.label; })];
    data.forEach(function(row) {
      wsData.push(cols.map(function(c) {
        var val = row[c.key];
        if (c.type === "currency") return formatRupiah(val);
        if (c.type === "number") return typeof val === "number" ? val : (val || "");
        if (c.type === "percent") return typeof val === "number" ? val.toFixed(1) + "%" : "";
        return val || "";
      }));
    });

    var ws = XLSX.utils.aoa_to_sheet(wsData);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, this.state.currentTab);
    var fname = "ABM_Dashboard_" + this.state.currentTab + "_" + new Date().toISOString().slice(0,10) + ".xlsx";
    XLSX.writeFile(wb, fname);
    tampilkanToast("Excel diekspor: " + fname, "success");
  },

  // Export PDF
  exportPDF: function() {
    if (typeof window.jspdf === "undefined" && typeof jspdf === "undefined") {
      this.loadJsPDF(function() { DASHBOARD.exportPDF(); });
      return;
    }
    this.doExportPDF();
  },

  doExportPDF: function() {
    var cols = this.state.columns;
    var data = this.state.data;

    var doc = new window.jspdf.jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("ABM Nanga Silat - " + this.tabs.find(function(t) { return t.id === DASHBOARD.state.currentTab; }).label, 14, 14);
    doc.setFontSize(9);
    doc.text("Tanggal: " + new Date().toLocaleDateString("id-ID"), 14, 20);

    var headers = cols.map(function(c) { return c.label; });
    var rows = data.map(function(row) {
      return cols.map(function(c) {
        var val = row[c.key];
        if (c.type === "currency") return formatRupiah(val);
        if (c.type === "number") return typeof val === "number" ? val.toLocaleString("id-ID") : (val || "");
        if (c.type === "percent") return typeof val === "number" ? val.toFixed(1) + "%" : "";
        return val || "";
      });
    });

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 26,
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [87, 83, 78] }
    });

    var fname = "ABM_Dashboard_" + this.state.currentTab + "_" + new Date().toISOString().slice(0,10) + ".pdf";
    doc.save(fname);
    tampilkanToast("PDF diekspor: " + fname, "success");
  },

  // Load SheetJS (Excel)
  loadSheetJS: function(cb) {
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.onload = cb;
    document.head.appendChild(script);
  },

  // Load jsPDF
  loadJsPDF: function(cb) {
    var script1 = document.createElement("script");
    script1.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    script1.onload = function() {
      var script2 = document.createElement("script");
      script2.src = "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";
      script2.onload = cb;
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  }
};

// Fungsi global untuk dipanggil dari app.js
function tampilkanDashboard() {
  state.formSekarang = "dashboard";
  $("isi-menu").classList.add("tersembunyi");
  $("isi-form").innerHTML = "";

  var header = document.createElement("div");
  header.className = "form-judul";
  var tombolKembali = document.createElement("button");
  tombolKembali.type = "button";
  tombolKembali.className = "tombol-kecil";
  tombolKembali.textContent = "Menu";
  tombolKembali.addEventListener("click", tampilkanMenu);
  var h2 = document.createElement("h2");
  h2.textContent = "Dashboard Rekapan";
  header.appendChild(tombolKembali);
  header.appendChild(h2);
  $("isi-form").appendChild(header);

  DASHBOARD.init();
  window.scrollTo(0, 0);
}