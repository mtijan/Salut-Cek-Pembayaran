const loginShell = document.querySelector("#login-shell");
const loginCard = document.querySelector("#login-card");
const authLoader = document.querySelector("#auth-loader");
const adminWorkspace = document.querySelector("#admin-workspace");
const adminMainContent = document.querySelector("#admin-main-content");
const adminViewButtons = document.querySelectorAll("[data-admin-view]");
const adminViewKicker = document.querySelector("#admin-view-kicker");
const adminViewTitle = document.querySelector("#admin-view-title");
const loginForm = document.querySelector("#login-form");
const loginSubmitButton = document.querySelector("#login-submit-button");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#password-toggle");
const loginMessage = document.querySelector("#login-message");
const logoutButton = document.querySelector("#logout-button");
const logoutButtonMobile = document.querySelector("#logout-button-mobile");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const adminSidebar = document.querySelector("#admin-sidebar");
const sidebarOverlay = document.querySelector("#sidebar-overlay");
const adminMobileViewTitle = document.querySelector("#admin-mobile-view-title");
const adminEmail = document.querySelector("#admin-email");
const toastRegion = document.querySelector("#toast-region");

// Views
const dashboardCard = document.querySelector("#dashboard-card");
const studentsCard = document.querySelector("#students-card");
const billsViewCard = document.querySelector("#bills-view-card");
const reportsCard = document.querySelector("#reports-card");
const filesCard = document.querySelector("#files-card");
const uploadCard = document.querySelector("#upload-card");
const masterCard = document.querySelector("#master-card");

// Generic confirm modal
const confirmModal = document.querySelector("#confirm-modal");
const confirmModalTitle = document.querySelector("#confirm-modal-title");
const confirmModalDescription = document.querySelector("#confirm-modal-description");
const confirmModalReason = document.querySelector("#confirm-modal-reason");
const confirmModalError = document.querySelector("#confirm-modal-error");
const confirmModalClose = document.querySelector("#confirm-modal-close");
const confirmModalCancel = document.querySelector("#confirm-modal-cancel");
const confirmModalSubmit = document.querySelector("#confirm-modal-submit");

// State variables
let activeAdminView = "dashboard";
let currentAdminRole = "admin";
let modalResolver = null;
let modalReturnFocus = null;
let masterStudyPrograms = [];
let masterAcademicPeriods = [];
let currentBillsPage = 1;
let totalBillsPages = 1;
const BILLS_PAGE_SIZE = 100;

const adminViews = {
  dashboard: { card: dashboardCard, kicker: "Ringkasan Sistem", title: "Dashboard" },
  students: { card: studentsCard, kicker: "Data Akademik", title: "Data Mahasiswa" },
  bills: { card: billsViewCard, kicker: "Manajemen Keuangan", title: "Tagihan Mahasiswa" },
  reports: { card: reportsCard, kicker: "Laporan & Evaluasi", title: "Rekap Keuangan" },
  files: { card: filesCard, kicker: "Riwayat Import", title: "Data File Import" },
  upload: { card: uploadCard, kicker: "Upload Excel", title: "Upload File" },
  master: { card: masterCard, kicker: "Master Data Akademik", title: "Master Data" },
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function showToast(message, type = "success") {
  if (!toastRegion) return;
  const toast = document.createElement("div");
  toast.className = `admin-toast is-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, 4200);
}

function renderLoadingState(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="loading-state" role="status">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function renderErrorState(container, title, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-panel is-error">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderEmptyState(container, title, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-panel">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// Modal management
function openModal(modalId) {
  const modal = document.querySelector(`#${modalId}`);
  if (modal) {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
}

function closeModal(modalId) {
  const modal = document.querySelector(`#${modalId}`);
  if (modal) {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
}

document.querySelectorAll("[data-modal-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.modalClose;
    if (target === "student-360") closeModal("student-360-modal");
    else if (target === "student-editor") closeModal("student-editor-modal");
    else if (target === "bill-editor") closeModal("bill-editor-modal");
    else if (target === "prodi-editor") closeModal("prodi-editor-modal");
    else if (target === "period-editor") closeModal("period-editor-modal");
  });
});

function requestDeleteConfirmation({ title, description, submitLabel = "Hapus Data" }) {
  if (modalResolver) closeConfirmModal(null);
  modalReturnFocus = document.activeElement;
  confirmModalTitle.textContent = title;
  confirmModalDescription.textContent = description;
  confirmModalSubmit.textContent = submitLabel;
  confirmModalReason.value = "";
  confirmModalError.textContent = "";
  confirmModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  window.setTimeout(() => confirmModalReason.focus(), 0);
  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function closeConfirmModal(result = null) {
  confirmModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  const resolve = modalResolver;
  modalResolver = null;
  if (resolve) resolve(result);
  if (modalReturnFocus instanceof HTMLElement) modalReturnFocus.focus();
  modalReturnFocus = null;
}

if (confirmModalClose) confirmModalClose.addEventListener("click", () => closeConfirmModal(null));
if (confirmModalCancel) confirmModalCancel.addEventListener("click", () => closeConfirmModal(null));
const confirmBackdrop = confirmModal ? confirmModal.querySelector("[data-modal-cancel]") : null;
if (confirmBackdrop) confirmBackdrop.addEventListener("click", () => closeConfirmModal(null));

if (confirmModalSubmit) {
  confirmModalSubmit.addEventListener("click", () => {
    const reason = confirmModalReason.value.trim();
    if (!reason) {
      confirmModalError.textContent = "Alasan wajib diisi.";
      confirmModalReason.focus();
      return;
    }
    closeConfirmModal(reason);
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (confirmModal && !confirmModal.classList.contains("hidden")) {
      closeConfirmModal(null);
    }
    ["student-360-modal", "student-editor-modal", "bill-editor-modal", "prodi-editor-modal", "period-editor-modal"].forEach(closeModal);
  }
});

// Sidebar & View Switcher
function switchAdminView(viewName) {
  const target = adminViews[viewName];
  if (!target || !target.card) return;

  activeAdminView = viewName;
  Object.values(adminViews).forEach((view) => {
    if (view.card) view.card.classList.add("hidden");
  });
  target.card.classList.remove("hidden");

  if (adminViewKicker) adminViewKicker.textContent = target.kicker;
  if (adminViewTitle) adminViewTitle.textContent = target.title;
  if (adminMobileViewTitle) adminMobileViewTitle.textContent = target.title;

  adminViewButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.adminView === viewName);
  });

  closeSidebar();

  // Load view-specific data
  if (viewName === "dashboard") loadDashboardStats();
  else if (viewName === "students") loadStudents();
  else if (viewName === "bills") loadBills();
  else if (viewName === "reports") loadFinancialReports();
  else if (viewName === "files") loadImportedFiles();
  else if (viewName === "master") loadMasterData();
}

adminViewButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchAdminView(btn.dataset.adminView));
});

document.querySelectorAll("[data-jump-view]").forEach((btn) => {
  btn.addEventListener("click", () => switchAdminView(btn.dataset.jumpView));
});

function closeSidebar() {
  if (adminSidebar) adminSidebar.classList.remove("is-open");
  if (sidebarOverlay) sidebarOverlay.classList.remove("is-open");
}

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    adminSidebar.classList.toggle("is-open");
    sidebarOverlay.classList.toggle("is-open");
  });
}

if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

// Password toggle
if (passwordToggle && passwordInput) {
  passwordToggle.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(isPassword));
  });
}

// ==========================================
// AUTHENTICATION
// ==========================================

async function checkSession() {
  try {
    const res = await fetch("/api/admin/me");
    if (!res.ok) throw new Error("Unauthenticated");
    const json = await res.json();
    if (json.success && json.data) {
      const admin = json.data.admin || json.data;
      if (admin && admin.email) {
        currentAdminRole = admin.role || "admin";
        if (adminEmail) adminEmail.textContent = `${admin.email} (${currentAdminRole})`;
        document.body.classList.remove("auth-pending");
        if (loginShell) loginShell.classList.add("hidden");
        if (adminWorkspace) adminWorkspace.classList.remove("hidden");
        loadInitialMasterData();
        switchAdminView("dashboard");
        return;
      }
    }
    throw new Error("Invalid session");
  } catch {
    document.body.classList.remove("auth-pending");
    if (loginShell) loginShell.classList.remove("hidden");
    if (adminWorkspace) adminWorkspace.classList.add("hidden");
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginSubmitButton.disabled = true;
    loginMessage.textContent = "Memverifikasi...";
    loginMessage.className = "form-message";

    const email = document.querySelector("#email").value.trim();
    const password = passwordInput.value;

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Email atau password salah.");
      }
      showToast("Berhasil login!");
      await checkSession();
    } catch (err) {
      loginMessage.textContent = err.message;
      loginMessage.className = "form-message error";
    } finally {
      loginSubmitButton.disabled = false;
    }
  });
}

async function doLogout() {
  try {
    await fetch("/api/admin/logout", { method: "POST" });
  } catch {}
  showToast("Anda telah keluar.");
  window.location.reload();
}

if (logoutButton) logoutButton.addEventListener("click", doLogout);
if (logoutButtonMobile) logoutButtonMobile.addEventListener("click", doLogout);

// ==========================================
// 1. DASHBOARD STATS
// ==========================================

async function loadDashboardStats() {
  try {
    const res = await fetch("/api/admin/dashboard/stats");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat statistik");

    const data = json.data;
    document.querySelector("#dash-total-students").textContent = data.total_students.toLocaleString("id-ID");
    document.querySelector("#dash-active-students").textContent = data.active_students.toLocaleString("id-ID");
    document.querySelector("#dash-total-bills").textContent = data.total_bills.toLocaleString("id-ID");
    document.querySelector("#dash-paid-bills").textContent = data.paid_bills.toLocaleString("id-ID");
    document.querySelector("#dash-unpaid-bills").textContent = data.unpaid_bills.toLocaleString("id-ID");
    document.querySelector("#dash-total-billed").textContent = data.total_billed_amount_formatted;
    document.querySelector("#dash-total-paid").textContent = data.total_paid_amount_formatted;
    document.querySelector("#dash-total-outstanding").textContent = data.total_outstanding_amount_formatted;
    document.querySelector("#dash-payment-rate").textContent = `${data.payment_rate_percentage}%`;
    document.querySelector("#dash-progress-bar").style.width = `${Math.min(100, Math.max(0, data.payment_rate_percentage))}%`;
  } catch (err) {
    showToast(`Gagal memuat statistik: ${err.message}`, "error");
  }
}

// ==========================================
// 2. DATA MAHASISWA & STUDENT 360
// ==========================================

const studentSearchForm = document.querySelector("#student-search-form");
const studentSearchInput = document.querySelector("#student-search-input");
const studentProdiFilter = document.querySelector("#student-prodi-filter");
const studentStatusFilter = document.querySelector("#student-status-filter");
const studentResetFilterBtn = document.querySelector("#student-reset-filter-button");
const studentsTableContainer = document.querySelector("#students-table-container");
const studentsTotalCount = document.querySelector("#students-total-count");
const addStudentModalBtn = document.querySelector("#add-student-modal-button");
const studentModalForm = document.querySelector("#student-modal-form");
const studentModalError = document.querySelector("#student-modal-error");

async function loadStudents() {
  renderLoadingState(studentsTableContainer, "Memuat data mahasiswa...");
  const query = studentSearchInput.value.trim();
  const prodiId = studentProdiFilter.value;
  const status = studentStatusFilter.value;

  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (prodiId) params.set("study_program_id", prodiId);
  if (status) params.set("academic_status", status);

  try {
    const res = await fetch(`/api/admin/students?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat data mahasiswa");

    const students = json.data.students || [];
    studentsTotalCount.textContent = `${students.length} mahasiswa`;

    if (!students.length) {
      renderEmptyState(studentsTableContainer, "Tidak Ada Data", "Tidak ada data mahasiswa yang cocok dengan filter.");
      return;
    }

    let html = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>NIM</th>
            <th>Nama Lengkap</th>
            <th>Program Studi</th>
            <th>Status</th>
            <th>Angkatan</th>
            <th>Jml Tagihan</th>
            <th>Total Nominal</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
    `;

    students.forEach((s) => {
      const statusClass = s.academic_status === "aktif" ? "status-aktif" : s.academic_status === "cuti" ? "status-cuti" : "status-unpaid";
      html += `
        <tr>
          <td><strong>${escapeHtml(s.nim)}</strong></td>
          <td>${escapeHtml(s.full_name)}</td>
          <td>${escapeHtml(s.study_program_name || s.program_study || "-")}</td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(s.academic_status || "aktif")}</span></td>
          <td>${escapeHtml(s.entry_year || "-")}</td>
          <td>${s.bill_count}</td>
          <td>${escapeHtml(s.total_amount_formatted)}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="table-btn btn-primary" onclick="openStudentProfile360('${s.id}')">Profil 360</button>
            <button type="button" class="table-btn btn-secondary" onclick="openEditStudentModal('${s.id}')">Edit</button>
            <button type="button" class="table-btn btn-danger" onclick="deleteStudentAction('${s.id}', '${escapeHtml(s.full_name)}')">Hapus</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    studentsTableContainer.innerHTML = html;
  } catch (err) {
    renderErrorState(studentsTableContainer, "Gagal Memuat Data", err.message);
  }
}

if (studentSearchForm) {
  studentSearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loadStudents();
  });
}

if (studentResetFilterBtn) {
  studentResetFilterBtn.addEventListener("click", () => {
    studentSearchInput.value = "";
    studentProdiFilter.value = "";
    studentStatusFilter.value = "";
    loadStudents();
  });
}

// Student Profile 360 Viewer
window.openStudentProfile360 = async function (studentId) {
  try {
    const res = await fetch(`/api/admin/students/${studentId}/detail`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat profil mahasiswa");

    const data = json.data;
    const st = data.student;
    const sm = data.summary;

    document.querySelector("#student-360-title").textContent = st.full_name;
    document.querySelector("#s360-nim").textContent = st.nim;
    document.querySelector("#s360-prodi").textContent = st.study_program_name || st.program_study || "-";
    document.querySelector("#s360-year").textContent = st.entry_year || "-";
    document.querySelector("#s360-phone").textContent = st.phone_number || "-";
    document.querySelector("#s360-email").textContent = st.email || "-";
    document.querySelector("#s360-address").textContent = st.address || "-";

    const statusEl = document.querySelector("#s360-status");
    statusEl.textContent = st.academic_status || "aktif";
    statusEl.className = `status-badge ${st.academic_status === "aktif" ? "status-aktif" : st.academic_status === "cuti" ? "status-cuti" : "status-unpaid"}`;

    document.querySelector("#s360-total-amount").textContent = sm.total_amount_formatted;
    document.querySelector("#s360-paid-amount").textContent = sm.total_paid_formatted;
    document.querySelector("#s360-outstanding-amount").textContent = sm.total_outstanding_formatted;

    const overallEl = document.querySelector("#s360-overall-status");
    overallEl.textContent = sm.overall_status === "paid" ? "Lunas" : sm.overall_status === "partial" ? "Bayar Sebagian" : "Belum Lunas";
    overallEl.className = `status-badge status-${sm.overall_status}`;

    const billsContainer = document.querySelector("#s360-bills-table");
    if (!data.bills.length) {
      billsContainer.innerHTML = `<p class="field-hint" style="padding: 1rem 0;">Belum ada riwayat tagihan terdaftar.</p>`;
    } else {
      let bHtml = `
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Jenis</th>
              <th>Nominal</th>
              <th>Status</th>
              <th>Batas Aktif</th>
              <th>BRIVA</th>
            </tr>
          </thead>
          <tbody>
      `;
      data.bills.forEach((b) => {
        bHtml += `
          <tr>
            <td>${escapeHtml(b.period)}</td>
            <td>${escapeHtml(b.bill_type)}</td>
            <td><strong>${escapeHtml(b.amount_formatted)}</strong></td>
            <td><span class="status-badge status-${b.status}">${b.status === "paid" ? "Lunas" : b.status === "partial" ? "Cicilan" : "Belum Lunas"}</span></td>
            <td>${escapeHtml(b.due_date_formatted || "-")}</td>
            <td><code>${escapeHtml(b.briva)}</code></td>
          </tr>
        `;
      });
      bHtml += `</tbody></table>`;
      billsContainer.innerHTML = bHtml;
    }

    openModal("student-360-modal");
  } catch (err) {
    showToast(`Gagal membuka profil 360: ${err.message}`, "error");
  }
};

// Student Edit / Create Modal
if (addStudentModalBtn) {
  addStudentModalBtn.addEventListener("click", () => {
    document.querySelector("#student-editor-modal-title").textContent = "Tambah Mahasiswa";
    document.querySelector("#edit-student-id").value = "";
    studentModalForm.reset();
    studentModalError.textContent = "";
    openModal("student-editor-modal");
  });
}

window.openEditStudentModal = async function (studentId) {
  try {
    const res = await fetch(`/api/admin/students/${studentId}/detail`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal mengambil data");

    const st = json.data.student;
    document.querySelector("#student-editor-modal-title").textContent = "Edit Data Mahasiswa";
    document.querySelector("#edit-student-id").value = st.id;
    document.querySelector("#modal-student-nim").value = st.nim;
    document.querySelector("#modal-student-name").value = st.full_name;
    document.querySelector("#modal-student-prodi").value = st.study_program_id || "";
    document.querySelector("#modal-student-status").value = st.academic_status || "aktif";
    document.querySelector("#modal-student-year").value = st.entry_year || "";
    document.querySelector("#modal-student-phone").value = st.phone_number || "";
    document.querySelector("#modal-student-email").value = st.email || "";
    document.querySelector("#modal-student-address").value = st.address || "";
    studentModalError.textContent = "";
    openModal("student-editor-modal");
  } catch (err) {
    showToast(`Gagal membuka form edit: ${err.message}`, "error");
  }
};

if (studentModalForm) {
  studentModalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    studentModalError.textContent = "";
    const studentId = document.querySelector("#edit-student-id").value;
    const isEdit = Boolean(studentId);

    const payload = {
      nim: document.querySelector("#modal-student-nim").value.trim(),
      full_name: document.querySelector("#modal-student-name").value.trim(),
      study_program_id: document.querySelector("#modal-student-prodi").value || null,
      academic_status: document.querySelector("#modal-student-status").value,
      entry_year: document.querySelector("#modal-student-year").value ? Number(document.querySelector("#modal-student-year").value) : null,
      phone_number: document.querySelector("#modal-student-phone").value.trim() || null,
      email: document.querySelector("#modal-student-email").value.trim() || null,
      address: document.querySelector("#modal-student-address").value.trim() || null,
    };

    try {
      const url = isEdit ? `/api/admin/students/${studentId}` : "/api/admin/students";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menyimpan mahasiswa");

      showToast(isEdit ? "Data mahasiswa diperbarui." : "Mahasiswa baru ditambahkan.");
      closeModal("student-editor-modal");
      loadStudents();
      loadDashboardStats();
    } catch (err) {
      studentModalError.textContent = err.message;
    }
  });
}

window.deleteStudentAction = async function (studentId, studentName) {
  const reason = await requestDeleteConfirmation({
    title: "Hapus Mahasiswa",
    description: `Apakah Anda yakin ingin menghapus mahasiswa "${studentName}" beserta seluruh riwayat tagihannya?`,
    submitLabel: "Hapus Mahasiswa",
  });
  if (!reason) return;

  try {
    const res = await fetch(`/api/admin/students/${studentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menghapus mahasiswa");

    showToast("Mahasiswa berhasil dihapus.");
    loadStudents();
    loadDashboardStats();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, "error");
  }
};

// ==========================================
// 3. TAGIHAN MAHASISWA (BILLS)
// ==========================================

const billsFilterForm = document.querySelector("#bills-filter-form");
const billsSearchInput = document.querySelector("#bills-search-input");
const billsStatusFilter = document.querySelector("#bills-status-filter");
const billsSourceFilter = document.querySelector("#bills-source-filter");
const billsResetFilterBtn = document.querySelector("#bills-reset-filter-button");
const billsTableContainer = document.querySelector("#bills-table-container");
const billsTotalCount = document.querySelector("#bills-total-count");
const billsPagination = document.querySelector("#bills-pagination");
const billsPrevPage = document.querySelector("#bills-prev-page");
const billsNextPage = document.querySelector("#bills-next-page");
const billsPageNumbers = document.querySelector("#bills-page-numbers");
const billsPageInfo = document.querySelector("#bills-page-info");
const addBillBtn = document.querySelector("#add-bill-button");
const billModalForm = document.querySelector("#bill-modal-form");
const billModalError = document.querySelector("#bill-modal-error");

async function loadBills(page = 1) {
  currentBillsPage = page;
  renderLoadingState(billsTableContainer, "Memuat daftar tagihan...");

  const query = billsSearchInput.value.trim();
  const status = billsStatusFilter.value;
  const source = billsSourceFilter.value;
  const offset = (page - 1) * BILLS_PAGE_SIZE;

  const params = new URLSearchParams({
    limit: String(BILLS_PAGE_SIZE),
    offset: String(offset),
  });
  if (query) params.set("query", query);
  if (status) params.set("status", status);
  if (source) params.set("source", source);

  try {
    const res = await fetch(`/api/admin/bills?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat tagihan");

    const bills = json.data.bills || [];
    const pag = json.data.pagination;
    totalBillsPages = pag.total_pages;
    billsTotalCount.textContent = `${pag.total} tagihan`;

    if (!bills.length) {
      renderEmptyState(billsTableContainer, "Tidak Ada Tagihan", "Tidak ada data tagihan yang sesuai.");
      billsPagination.classList.add("hidden");
      return;
    }

    let html = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>NIM</th>
            <th>Nama Mahasiswa</th>
            <th>BRIVA</th>
            <th>Nominal</th>
            <th>Periode</th>
            <th>Jenis</th>
            <th>Status Bayar</th>
            <th>Batas Aktif</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
    `;

    bills.forEach((b) => {
      html += `
        <tr>
          <td><strong>${escapeHtml(b.nim)}</strong></td>
          <td>${escapeHtml(b.full_name)}</td>
          <td><code>${escapeHtml(b.briva)}</code></td>
          <td>${escapeHtml(b.amount_formatted)}</td>
          <td>${escapeHtml(b.period)}</td>
          <td>${escapeHtml(b.bill_type)}</td>
          <td>
            <select class="status-select status-${b.status}" onchange="changeBillStatus('${b.id}', this.value, ${Number(b.paid_amount || 0)}, ${Number(b.amount || 0)})">
              <option value="unpaid" ${b.status === "unpaid" ? "selected" : ""}>Belum lunas</option>
              <option value="partial" ${b.status === "partial" ? "selected" : ""}>Bayar sebagian</option>
              <option value="paid" ${b.status === "paid" ? "selected" : ""}>Lunas</option>
            </select>
          </td>
          <td>${escapeHtml(b.due_date_formatted || "-")}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="table-btn btn-secondary" onclick="openEditBillModal('${b.id}')">Edit</button>
            <button type="button" class="table-btn btn-danger" onclick="deleteBillAction('${b.id}', '${escapeHtml(b.full_name)}')">Hapus</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    billsTableContainer.innerHTML = html;

    // Render pagination
    if (totalBillsPages > 1) {
      billsPagination.classList.remove("hidden");
      billsPrevPage.disabled = currentBillsPage <= 1;
      billsNextPage.disabled = currentBillsPage >= totalBillsPages;
      billsPageInfo.textContent = `Halaman ${currentBillsPage} dari ${totalBillsPages} (${pag.total} total data)`;
      renderPaginationButtons(billsPageNumbers, currentBillsPage, totalBillsPages, (p) => loadBills(p));
    } else {
      billsPagination.classList.add("hidden");
    }
  } catch (err) {
    renderErrorState(billsTableContainer, "Gagal Memuat Tagihan", err.message);
  }
}

function renderPaginationButtons(container, current, total, onPageClick) {
  container.innerHTML = "";
  for (let i = 1; i <= Math.min(total, 5); i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pagination-page-button ${i === current ? "is-active" : "ghost-button"}`;
    btn.textContent = String(i);
    btn.addEventListener("click", () => onPageClick(i));
    container.append(btn);
  }
}

if (billsFilterForm) {
  billsFilterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loadBills(1);
  });
}

if (billsResetFilterBtn) {
  billsResetFilterBtn.addEventListener("click", () => {
    billsSearchInput.value = "";
    billsStatusFilter.value = "";
    billsSourceFilter.value = "";
    loadBills(1);
  });
}

if (billsPrevPage) billsPrevPage.addEventListener("click", () => loadBills(currentBillsPage - 1));
if (billsNextPage) billsNextPage.addEventListener("click", () => loadBills(currentBillsPage + 1));

window.changeBillStatus = async function (billId, status, currentPaidAmount = 0, totalAmount = 0) {
  try {
    let paidAmount = null;
    if (status === "partial") {
      const value = window.prompt(
        `Masukkan nominal yang sudah dibayar (total tagihan ${new Intl.NumberFormat("id-ID").format(totalAmount)}):`,
        currentPaidAmount > 0 ? String(currentPaidAmount) : "",
      );
      if (value === null) {
        loadBills(currentBillsPage);
        return;
      }
      paidAmount = value.trim();
      if (!paidAmount) {
        showToast("Nominal pembayaran wajib diisi untuk status Bayar Sebagian.", "error");
        loadBills(currentBillsPage);
        return;
      }
    }
    const res = await fetch("/api/admin/bills/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id: billId, status, paid_amount: paidAmount }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal mengubah status tagihan");

    showToast("Status pembayaran tagihan diperbarui.");
    loadDashboardStats();
    loadBills(currentBillsPage);
  } catch (err) {
    showToast(`Gagal update status: ${err.message}`, "error");
    loadBills(currentBillsPage);
  }
};

// Bill Create / Edit Modal
if (addBillBtn) {
  addBillBtn.addEventListener("click", () => {
    document.querySelector("#bill-editor-modal-title").textContent = "Buat Tagihan Baru";
    document.querySelector("#edit-bill-id").value = "";
    billModalForm.reset();
    billModalError.textContent = "";
    openModal("bill-editor-modal");
  });
}

window.openEditBillModal = async function (billId) {
  try {
    const res = await fetch(`/api/admin/bills?limit=100`);
    const json = await res.json();
    const bills = json.data.bills || [];
    const b = bills.find((item) => item.id === billId);
    if (!b) throw new Error("Tagihan tidak ditemukan.");

    document.querySelector("#bill-editor-modal-title").textContent = "Edit Tagihan";
    document.querySelector("#edit-bill-id").value = b.id;
    document.querySelector("#modal-bill-nim").value = b.nim;
    document.querySelector("#modal-bill-name").value = b.full_name;
    document.querySelector("#modal-bill-briva").value = b.briva;
    document.querySelector("#modal-bill-amount").value = b.amount;
    document.querySelector("#modal-bill-period").value = b.period;
    document.querySelector("#modal-bill-type").value = b.bill_type;
    document.querySelector("#modal-bill-status").value = b.status;
    document.querySelector("#modal-bill-due-date").value = b.due_date || "";
    billModalError.textContent = "";
    openModal("bill-editor-modal");
  } catch (err) {
    showToast(`Gagal membuka edit: ${err.message}`, "error");
  }
};

if (billModalForm) {
  billModalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    billModalError.textContent = "";
    const billId = document.querySelector("#edit-bill-id").value;
    const isEdit = Boolean(billId);

    const payload = {
      nim: document.querySelector("#modal-bill-nim").value.trim(),
      full_name: document.querySelector("#modal-bill-name").value.trim(),
      briva: document.querySelector("#modal-bill-briva").value.trim(),
      amount: Number(document.querySelector("#modal-bill-amount").value),
      period: document.querySelector("#modal-bill-period").value.trim(),
      bill_type: document.querySelector("#modal-bill-type").value.trim(),
      status: document.querySelector("#modal-bill-status").value,
      due_date: document.querySelector("#modal-bill-due-date").value || null,
    };

    try {
      const url = isEdit ? `/api/admin/bills/${billId}` : "/api/admin/bills";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menyimpan tagihan");

      showToast(isEdit ? "Tagihan berhasil diperbarui." : "Tagihan baru dibuat.");
      closeModal("bill-editor-modal");
      loadBills(currentBillsPage);
      loadDashboardStats();
    } catch (err) {
      billModalError.textContent = err.message;
    }
  });
}

window.deleteBillAction = async function (billId, studentName) {
  const reason = await requestDeleteConfirmation({
    title: "Hapus Tagihan",
    description: `Apakah Anda yakin ingin menghapus tagihan milik "${studentName}"?`,
    submitLabel: "Hapus Tagihan",
  });
  if (!reason) return;

  try {
    const res = await fetch(`/api/admin/bills/${billId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menghapus tagihan");

    showToast("Tagihan berhasil dihapus.");
    loadBills(currentBillsPage);
    loadDashboardStats();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, "error");
  }
};

// ==========================================
// 4. REKAPITULASI KEUANGAN (REPORTS)
// ==========================================

const reportsTableContainer = document.querySelector("#reports-table-container");
const refreshReportsBtn = document.querySelector("#refresh-reports-button");

async function loadFinancialReports() {
  renderLoadingState(reportsTableContainer, "Memuat rekapitulasi keuangan...");
  try {
    const res = await fetch("/api/admin/reports/financial-summary");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat rekap keuangan");

    const data = json.data;
    const list = data.by_study_program || [];
    const totals = data.totals;

    let html = `
      <div class="dashboard-stats-grid" style="margin-bottom: 2rem;">
        <div class="stat-card">
          <span class="stat-label">Total Tagihan (Piutang)</span>
          <strong class="stat-value">${escapeHtml(totals.billed_amount_formatted)}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Realisasi Penerimaan</span>
          <strong class="stat-value text-success">${escapeHtml(totals.paid_amount_formatted)}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Sisa Tunggakan Global</span>
          <strong class="stat-value text-danger">${escapeHtml(totals.outstanding_amount_formatted)}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Persentase Realisasi</span>
          <strong class="stat-value">${totals.percentage_paid}%</strong>
        </div>
      </div>

      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Program Studi</th>
            <th>Mahasiswa</th>
            <th>Jml Tagihan</th>
            <th>Total Tagihan</th>
            <th>Sudah Lunas</th>
            <th>Sisa Tunggakan</th>
            <th>% Realisasi</th>
          </tr>
        </thead>
        <tbody>
    `;

    list.forEach((item) => {
      html += `
        <tr>
          <td><strong>${escapeHtml(item.program_study)}</strong></td>
          <td>${item.total_students}</td>
          <td>${item.total_bills}</td>
          <td>${escapeHtml(item.billed_amount_formatted)}</td>
          <td class="text-success">${escapeHtml(item.paid_amount_formatted)}</td>
          <td class="text-danger">${escapeHtml(item.outstanding_amount_formatted)}</td>
          <td><strong>${item.percentage_paid}%</strong></td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    reportsTableContainer.innerHTML = html;
  } catch (err) {
    renderErrorState(reportsTableContainer, "Gagal Memuat Laporan", err.message);
  }
}

if (refreshReportsBtn) refreshReportsBtn.addEventListener("click", loadFinancialReports);

// ==========================================
// 5. MASTER DATA (PRODI & ACADEMIC PERIODS)
// ==========================================

const masterProdiTable = document.querySelector("#master-prodi-table");
const masterPeriodTable = document.querySelector("#master-period-table");
const addProdiBtn = document.querySelector("#add-prodi-btn");
const addPeriodBtn = document.querySelector("#add-period-btn");
const prodiModalForm = document.querySelector("#prodi-modal-form");
const periodModalForm = document.querySelector("#period-modal-form");
const prodiModalError = document.querySelector("#prodi-modal-error");
const periodModalError = document.querySelector("#period-modal-error");

document.querySelectorAll(".master-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".master-tab-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const tab = btn.dataset.masterTab;
    document.querySelector("#master-prodi-panel").classList.toggle("hidden", tab !== "prodi");
    document.querySelector("#master-period-panel").classList.toggle("hidden", tab !== "period");
  });
});

async function loadInitialMasterData() {
  try {
    const res = await fetch("/api/admin/study-programs");
    const json = await res.json();
    if (json.success) {
      masterStudyPrograms = json.data.study_programs || [];
      populateProdiDropdowns();
    }
  } catch {}
}

function populateProdiDropdowns() {
  const options = `<option value="">Semua Program Studi</option>` + masterStudyPrograms.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`).join("");
  if (studentProdiFilter) studentProdiFilter.innerHTML = options;

  const modalOptions = `<option value="">Pilih Program Studi</option>` + masterStudyPrograms.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`).join("");
  const modalProdiSelect = document.querySelector("#modal-student-prodi");
  if (modalProdiSelect) modalProdiSelect.innerHTML = modalOptions;
}

async function loadMasterData() {
  loadMasterProdi();
  loadMasterPeriods();
}

async function loadMasterProdi() {
  renderLoadingState(masterProdiTable, "Memuat master program studi...");
  try {
    const res = await fetch("/api/admin/study-programs");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat prodi");

    masterStudyPrograms = json.data.study_programs || [];
    populateProdiDropdowns();

    let html = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Program Studi</th>
            <th>Jenjang</th>
            <th>Fakultas</th>
            <th>Jml Mahasiswa</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
    `;

    masterStudyPrograms.forEach((p) => {
      html += `
        <tr>
          <td><code>${escapeHtml(p.code)}</code></td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.degree)}</td>
          <td>${escapeHtml(p.faculty || "-")}</td>
          <td>${p.student_count} mhs</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="table-btn btn-secondary" onclick="openEditProdiModal('${p.id}')">Edit</button>
            <button type="button" class="table-btn btn-danger" onclick="deleteProdiAction('${p.id}', '${escapeHtml(p.name)}')">Hapus</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    masterProdiTable.innerHTML = html;
  } catch (err) {
    renderErrorState(masterProdiTable, "Gagal Memuat Master Prodi", err.message);
  }
}

async function loadMasterPeriods() {
  renderLoadingState(masterPeriodTable, "Memuat master periode akademik...");
  try {
    const res = await fetch("/api/admin/academic-periods");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat periode");

    masterAcademicPeriods = json.data.academic_periods || [];

    let html = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Periode</th>
            <th>Tipe Semester</th>
            <th>Status Aktif</th>
            <th>Default Batas Aktif</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
    `;

    masterAcademicPeriods.forEach((p) => {
      const activeBadge = p.is_active ? `<span class="status-badge status-aktif">Semester Aktif</span>` : `<span class="status-badge">Non-Aktif</span>`;
      html += `
        <tr>
          <td><code>${escapeHtml(p.code)}</code></td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.semester_type)}</td>
          <td>${activeBadge}</td>
          <td>${escapeHtml(p.default_due_date_formatted || "-")}</td>
          <td style="text-align: right; white-space: nowrap;">
            ${!p.is_active ? `<button type="button" class="table-btn btn-primary" onclick="setActivePeriodAction('${p.id}')">Jadikan Aktif</button>` : ""}
            <button type="button" class="table-btn btn-secondary" onclick="openEditPeriodModal('${p.id}')">Edit</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    masterPeriodTable.innerHTML = html;
  } catch (err) {
    renderErrorState(masterPeriodTable, "Gagal Memuat Master Periode", err.message);
  }
}

// Prodi CRUD
if (addProdiBtn) {
  addProdiBtn.addEventListener("click", () => {
    document.querySelector("#prodi-editor-modal-title").textContent = "Tambah Program Studi";
    document.querySelector("#edit-prodi-id").value = "";
    prodiModalForm.reset();
    prodiModalError.textContent = "";
    openModal("prodi-editor-modal");
  });
}

window.openEditProdiModal = function (prodiId) {
  const p = masterStudyPrograms.find((item) => item.id === prodiId);
  if (!p) return;

  document.querySelector("#prodi-editor-modal-title").textContent = "Edit Program Studi";
  document.querySelector("#edit-prodi-id").value = p.id;
  document.querySelector("#modal-prodi-code").value = p.code;
  document.querySelector("#modal-prodi-name").value = p.name;
  document.querySelector("#modal-prodi-degree").value = p.degree || "S1";
  document.querySelector("#modal-prodi-faculty").value = p.faculty || "";
  prodiModalError.textContent = "";
  openModal("prodi-editor-modal");
};

if (prodiModalForm) {
  prodiModalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    prodiModalError.textContent = "";
    const prodiId = document.querySelector("#edit-prodi-id").value;
    const isEdit = Boolean(prodiId);

    const payload = {
      code: document.querySelector("#modal-prodi-code").value.trim().toUpperCase(),
      name: document.querySelector("#modal-prodi-name").value.trim(),
      degree: document.querySelector("#modal-prodi-degree").value,
      faculty: document.querySelector("#modal-prodi-faculty").value.trim() || null,
    };

    try {
      const url = isEdit ? `/api/admin/study-programs/${prodiId}` : "/api/admin/study-programs";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menyimpan program studi");

      showToast(isEdit ? "Program studi diperbarui." : "Program studi baru ditambahkan.");
      closeModal("prodi-editor-modal");
      loadMasterProdi();
    } catch (err) {
      prodiModalError.textContent = err.message;
    }
  });
}

window.deleteProdiAction = async function (prodiId, prodiName) {
  if (!confirm(`Hapus program studi "${prodiName}"?`)) return;
  try {
    const res = await fetch(`/api/admin/study-programs/${prodiId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menghapus");

    showToast("Program studi dihapus.");
    loadMasterProdi();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, "error");
  }
};

// Period CRUD
if (addPeriodBtn) {
  addPeriodBtn.addEventListener("click", () => {
    document.querySelector("#period-editor-modal-title").textContent = "Tambah Periode Akademik";
    document.querySelector("#edit-period-id").value = "";
    periodModalForm.reset();
    periodModalError.textContent = "";
    openModal("period-editor-modal");
  });
}

window.openEditPeriodModal = function (periodId) {
  const p = masterAcademicPeriods.find((item) => item.id === periodId);
  if (!p) return;

  document.querySelector("#period-editor-modal-title").textContent = "Edit Periode Akademik";
  document.querySelector("#edit-period-id").value = p.id;
  document.querySelector("#modal-period-code").value = p.code;
  document.querySelector("#modal-period-name").value = p.name;
  document.querySelector("#modal-period-type").value = p.semester_type;
  document.querySelector("#modal-period-due-date").value = p.default_due_date || "";
  document.querySelector("#modal-period-active").checked = Boolean(p.is_active);
  periodModalError.textContent = "";
  openModal("period-editor-modal");
};

if (periodModalForm) {
  periodModalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    periodModalError.textContent = "";
    const periodId = document.querySelector("#edit-period-id").value;
    const isEdit = Boolean(periodId);

    const payload = {
      code: document.querySelector("#modal-period-code").value.trim(),
      name: document.querySelector("#modal-period-name").value.trim(),
      semester_type: document.querySelector("#modal-period-type").value,
      default_due_date: document.querySelector("#modal-period-due-date").value || null,
      is_active: document.querySelector("#modal-period-active").checked ? 1 : 0,
    };

    try {
      const url = isEdit ? `/api/admin/academic-periods/${periodId}` : "/api/admin/academic-periods";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menyimpan periode");

      showToast(isEdit ? "Periode akademik diperbarui." : "Periode akademik ditambahkan.");
      closeModal("period-editor-modal");
      loadMasterPeriods();
    } catch (err) {
      periodModalError.textContent = err.message;
    }
  });
}

window.setActivePeriodAction = async function (periodId) {
  try {
    const res = await fetch(`/api/admin/academic-periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: 1 }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal mengaktifkan periode");

    showToast("Periode aktif saat ini diperbarui.");
    loadMasterPeriods();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, "error");
  }
};

// ==========================================
// 6. DATA FILE IMPORT & EXCEL UPLOAD
// ==========================================

const filesState = document.querySelector("#files-state");
const refreshFilesBtn = document.querySelector("#refresh-files-button");
const importForm = document.querySelector("#import-form");
const fileInput = document.querySelector("#excel-file");
const filePicker = document.querySelector("#excel-file-picker");
const selectedFileName = document.querySelector("#selected-file-name");
const previewButton = importForm ? importForm.querySelector("button[type='submit']") : null;
const previewState = document.querySelector("#preview-state");
const validCount = document.querySelector("#valid-count");
const newCount = document.querySelector("#new-count");
const unchangedCount = document.querySelector("#unchanged-count");
const updateCount = document.querySelector("#update-count");
const amountChangeCount = document.querySelector("#amount-change-count");
const criticalCount = document.querySelector("#critical-count");
const issueCount = document.querySelector("#issue-count");
const sampleTable = document.querySelector("#sample-table");
const errorList = document.querySelector("#error-list");
const commitButton = document.querySelector("#commit-button");
const cancelPreviewButton = document.querySelector("#cancel-preview-button");
const changeState = document.querySelector("#change-state");
const changeTable = document.querySelector("#change-table");
const confirmUpdatesRow = document.querySelector("#confirm-updates-row");
const confirmUpdates = document.querySelector("#confirm-updates");
const importIssuesState = document.querySelector("#import-issues-state");

let currentImportToken = "";
let currentPreview = null;

async function loadImportedFiles() {
  renderLoadingState(filesState, "Memuat daftar file import...");
  try {
    const res = await fetch("/api/admin/imported-bills");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memuat data file import");

    const groups = json.data.groups || [];
    if (!groups.length) {
      renderEmptyState(filesState, "Belum Ada File Terimport", "Silakan upload file XLSX pada menu Upload File.");
      return;
    }

    let html = "";
    groups.forEach((g) => {
      html += `
        <div class="file-group-card">
          <div class="file-group-header">
            <div>
              <h4>${escapeHtml(g.file_name)}</h4>
              <p class="field-hint">Diimport pada ${escapeHtml(g.imported_at)}</p>
            </div>
            <button type="button" class="table-btn btn-danger" onclick="deleteImportFileAction('${escapeHtml(g.file_name)}')">Hapus Kumpulan File</button>
          </div>
          <div class="summary-grid" style="margin-top: 1rem;">
            <div><span class="label-small">Mahasiswa</span><strong>${g.student_count}</strong></div>
            <div><span class="label-small">Tagihan</span><strong>${g.total}</strong></div>
            <div><span class="label-small">Lunas</span><strong class="text-success">${g.paid}</strong></div>
            <div><span class="label-small">Belum Lunas</span><strong class="text-danger">${g.unpaid}</strong></div>
            <div><span class="label-small">Total Nominal</span><strong>${rupiah(g.total_amount)}</strong></div>
          </div>
        </div>
      `;
    });
    filesState.innerHTML = html;
  } catch (err) {
    renderErrorState(filesState, "Gagal Memuat File Import", err.message);
  }
}

if (refreshFilesBtn) refreshFilesBtn.addEventListener("click", loadImportedFiles);

window.deleteImportFileAction = async function (fileName) {
  const reason = await requestDeleteConfirmation({
    title: "Hapus File Import",
    description: `Apakah Anda yakin ingin menghapus seluruh tagihan yang berasal dari file "${fileName}"?`,
    submitLabel: "Hapus Seluruh Tagihan File",
  });
  if (!reason) return;

  try {
    const res = await fetch("/api/admin/imported-files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_name: fileName, reason }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menghapus file");

    showToast(`File ${fileName} dan seluruh tagihannya dihapus.`);
    loadImportedFiles();
    loadDashboardStats();
  } catch (err) {
    showToast(`Gagal: ${err.message}`, "error");
  }
};

// Excel Upload Wizard
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    selectedFileName.textContent = file ? file.name : "Belum ada file dipilih";
    if (previewButton) previewButton.disabled = !file;
  });
}

if (importForm) {
  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    previewButton.disabled = true;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal memproses preview");

      currentImportToken = json.data.token;
      currentPreview = json.data.preview;
      renderImportPreview(json.data.preview);
    } catch (err) {
      showToast(`Error preview: ${err.message}`, "error");
    } finally {
      previewButton.disabled = false;
    }
  });
}

function renderImportPreview(prev) {
  previewState.classList.remove("hidden");
  validCount.textContent = prev.valid_rows;
  newCount.textContent = prev.new_bills_count;
  unchangedCount.textContent = prev.unchanged_bills_count;
  updateCount.textContent = prev.will_update_count;
  amountChangeCount.textContent = prev.amount_or_briva_changed_count;
  criticalCount.textContent = prev.critical_rows;
  issueCount.textContent = prev.issue_rows;

  if (prev.changes && prev.changes.length) {
    changeState.classList.remove("hidden");
    confirmUpdatesRow.classList.toggle("hidden", !prev.requires_update_confirmation);
    let cHtml = `<table class="admin-data-table"><thead><tr><th>NIM</th><th>Nama</th><th>Perubahan</th></tr></thead><tbody>`;
    prev.changes.forEach((c) => {
      cHtml += `<tr><td>${escapeHtml(c.nim)}</td><td>${escapeHtml(c.full_name)}</td><td>${escapeHtml(c.change_summary || c.notes)}</td></tr>`;
    });
    cHtml += `</tbody></table>`;
    changeTable.innerHTML = cHtml;
  } else {
    changeState.classList.add("hidden");
  }

  // Sample table
  if (prev.sample_rows && prev.sample_rows.length) {
    let sHtml = `<table class="admin-data-table"><thead><tr><th>NIM</th><th>Nama</th><th>BRIVA</th><th>Nominal</th></tr></thead><tbody>`;
    prev.sample_rows.slice(0, 5).forEach((s) => {
      sHtml += `<tr><td>${escapeHtml(s.nim)}</td><td>${escapeHtml(s.full_name)}</td><td>${escapeHtml(s.briva)}</td><td>${rupiah(s.amount)}</td></tr>`;
    });
    sHtml += `</tbody></table>`;
    sampleTable.innerHTML = sHtml;
  }

  commitButton.disabled = prev.critical_rows > 0 || (prev.requires_update_confirmation && !confirmUpdates.checked);
}

if (confirmUpdates) {
  confirmUpdates.addEventListener("change", () => {
    if (currentPreview) {
      commitButton.disabled = currentPreview.critical_rows > 0 || (currentPreview.requires_update_confirmation && !confirmUpdates.checked);
    }
  });
}

if (cancelPreviewButton) {
  cancelPreviewButton.addEventListener("click", () => {
    previewState.classList.add("hidden");
    currentImportToken = "";
    currentPreview = null;
    importForm.reset();
    selectedFileName.textContent = "Belum ada file dipilih";
  });
}

if (commitButton) {
  commitButton.addEventListener("click", async () => {
    if (!currentImportToken) return;
    commitButton.disabled = true;
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentImportToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Gagal menyimpan data import");

      showToast("Data import berhasil disimpan ke database.");
      previewState.classList.add("hidden");
      currentImportToken = "";
      currentPreview = null;
      importForm.reset();
      selectedFileName.textContent = "Belum ada file dipilih";
      loadDashboardStats();
    } catch (err) {
      showToast(`Error commit: ${err.message}`, "error");
      commitButton.disabled = false;
    }
  });
}

// Initial Boot
checkSession();
