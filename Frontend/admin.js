const loginShell = document.querySelector("#login-shell");
const loginCard = document.querySelector("#login-card");
const authLoader = document.querySelector("#auth-loader");
const adminWorkspace = document.querySelector("#admin-workspace");
const adminMainContent = document.querySelector("#admin-main-content");
const importCard = document.querySelector("#import-card");
const studentsCard = document.querySelector("#students-card");
const billsCard = document.querySelector("#bills-card");
const adminViewButtons = document.querySelectorAll("[data-admin-view]");
const adminViewKicker = document.querySelector("#admin-view-kicker");
const adminViewTitle = document.querySelector("#admin-view-title");
const loginForm = document.querySelector("#login-form");
const loginSubmitButton = document.querySelector("#login-submit-button");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#password-toggle");
const importForm = document.querySelector("#import-form");
const billForm = document.querySelector("#bill-form");
const loginMessage = document.querySelector("#login-message");
const importMessage = document.querySelector("#import-message");
const manualMessage = document.querySelector("#manual-message");
const billsMessage = document.querySelector("#bills-message");
const logoutButton = document.querySelector("#logout-button");
const logoutButtonMobile = document.querySelector("#logout-button-mobile");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const adminSidebar = document.querySelector("#admin-sidebar");
const sidebarOverlay = document.querySelector("#sidebar-overlay");
const adminMobileViewTitle = document.querySelector("#admin-mobile-view-title");
const adminEmail = document.querySelector("#admin-email");
const fileInput = document.querySelector("#excel-file");
const filePicker = document.querySelector("#excel-file-picker");
const selectedFileName = document.querySelector("#selected-file-name");
const previewButton = importForm.querySelector("button[type='submit']");
const refreshManualButton = document.querySelector("#refresh-manual-button");
const refreshBillsButton = document.querySelector("#refresh-bills-button");
const addStudentButton = document.querySelector("#add-student-button");
const clearSearchButton = document.querySelector("#clear-search-button");
const resetBillButton = document.querySelector("#reset-bill-button");
const closeEditorButton = document.querySelector("#close-editor-button");
const studentEditor = document.querySelector("#student-editor");
const studentEditorTitle = document.querySelector("#student-editor-title");
const manualSearchForm = document.querySelector("#manual-search-form");
const manualSearch = document.querySelector("#manual-search");
const statusFilter = document.querySelector("#status-filter");
const sourceFilter = document.querySelector("#source-filter");
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
const billsState = document.querySelector("#bills-state");
const studentsState = document.querySelector("#students-state");
const studentsPagination = document.querySelector("#students-pagination");
const studentsPrevPage = document.querySelector("#students-prev-page");
const studentsNextPage = document.querySelector("#students-next-page");
const studentsPageNumbers = document.querySelector("#students-page-numbers");
const studentsPageInfo = document.querySelector("#students-page-info");
const studentsResultCount = document.querySelector("#students-result-count");
const importIssuesState = document.querySelector("#import-issues-state");
const importSteps = document.querySelectorAll("[data-import-step]");
const toastRegion = document.querySelector("#toast-region");
const confirmModal = document.querySelector("#confirm-modal");
const confirmModalTitle = document.querySelector("#confirm-modal-title");
const confirmModalDescription = document.querySelector("#confirm-modal-description");
const confirmModalReason = document.querySelector("#confirm-modal-reason");
const confirmModalError = document.querySelector("#confirm-modal-error");
const confirmModalClose = document.querySelector("#confirm-modal-close");
const confirmModalCancel = document.querySelector("#confirm-modal-cancel");
const confirmModalSubmit = document.querySelector("#confirm-modal-submit");
const confirmModalDialog = confirmModal.querySelector(".admin-modal-dialog");

const STUDENT_PAGE_SIZE = 100;
const FILE_DETAIL_PAGE_SIZE = 50;
let currentImportToken = "";
let currentPreview = null;
let isCommitting = false;
let isUploading = false;
let billRows = [];
let currentStudentPage = 1;
let totalStudentPages = 1;
let activeAdminView = "upload";
let importedBillGroups = [];
let modalResolver = null;
let modalReturnFocus = null;

const adminViews = {
  upload: { card: importCard, kicker: "Upload Excel", title: "Upload File" },
  students: { card: studentsCard, kicker: "Data Akademik", title: "Data Mahasiswa" },
  files: { card: billsCard, kicker: "Riwayat Import", title: "Data Mahasiswa per File" },
};

function setText(node, text, type = "") {
  node.textContent = text;
  node.className = `form-message ${type}`.trim();
}

function renderLoadingState(container, message, compact = false) {
  container.setAttribute("aria-busy", "true");
  container.innerHTML = `
    <div class="loading-state${compact ? " is-compact" : ""}" role="status">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function renderErrorState(container, title, message, retryAction = "") {
  container.removeAttribute("aria-busy");
  container.innerHTML = `
    <div class="state-panel is-error">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
      ${retryAction ? `<button type="button" class="ghost-button" data-retry-action="${escapeHtml(retryAction)}">Coba lagi</button>` : ""}
    </div>
  `;
}

function setSelectedFile(file = null) {
  selectedFileName.textContent = file ? file.name : "Belum ada file dipilih";
  selectedFileName.title = file ? file.name : "";
  filePicker.classList.toggle("has-file", Boolean(file));
  previewButton.disabled = isUploading || !file;
}

function showToast(message, type = "success") {
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

function setImportStep(step) {
  for (const item of importSteps) {
    const itemStep = Number(item.dataset.importStep || 0);
    item.classList.toggle("is-active", itemStep === step);
    item.classList.toggle("is-complete", itemStep < step);
  }
}

function resetImportPreview({ clearFile = false } = {}) {
  previewState.classList.add("hidden");
  currentImportToken = "";
  currentPreview = null;
  confirmUpdates.checked = false;
  if (clearFile) {
    importForm.reset();
    setSelectedFile();
  }
  setImportStep(1);
  refreshCommitState();
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rupiah(value) {
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

function refreshCommitState() {
  if (!currentPreview || !currentImportToken) {
    commitButton.disabled = true;
    return;
  }
  const requiresConfirmation = currentPreview.requires_update_confirmation && !confirmUpdates.checked;
  commitButton.disabled = isCommitting || currentPreview.critical_rows > 0 || requiresConfirmation;
}

function closeSidebar(restoreFocus = false) {
  if (!adminSidebar || !sidebarOverlay || !sidebarToggle) return;
  const wasOpen = adminSidebar.classList.contains("is-open");
  adminSidebar.classList.remove("is-open");
  sidebarOverlay.classList.remove("is-open");
  sidebarToggle.setAttribute("aria-expanded", "false");
  sidebarOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sidebar-open");
  if (restoreFocus && wasOpen) sidebarToggle.focus();
}

function openSidebar() {
  if (!adminSidebar || !sidebarOverlay || !sidebarToggle) return;
  adminSidebar.classList.add("is-open");
  sidebarOverlay.classList.add("is-open");
  sidebarToggle.setAttribute("aria-expanded", "true");
  sidebarOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("sidebar-open");
  window.setTimeout(() => adminSidebar.querySelector(".admin-nav-button")?.focus(), 220);
}

function toggleSidebar() {
  if (adminSidebar?.classList.contains("is-open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function setAdminView(view) {
  const selected = adminViews[view] || adminViews.upload;
  activeAdminView = adminViews[view] ? view : "upload";
  for (const item of Object.values(adminViews)) {
    item.card.classList.toggle("hidden", item !== selected);
  }
  for (const button of adminViewButtons) {
    const isActive = button.dataset.adminView === activeAdminView;
    button.classList.toggle("is-active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  adminViewKicker.textContent = selected.kicker;
  adminViewTitle.textContent = selected.title;
  document.title = `${selected.title} | Admin SALUT`;
  if (adminMobileViewTitle) {
    adminMobileViewTitle.textContent = selected.title;
  }
  closeSidebar();
  if (activeAdminView !== "students") closeStudentEditor();
  if (activeAdminView === "upload") loadImportIssues();
  if (activeAdminView === "students") loadStudentData();
  if (activeAdminView === "files") loadImportedBills();
}

function showAdmin(user) {
  document.body.classList.remove("auth-pending");
  document.body.classList.remove("login-active");
  document.body.classList.add("admin-active");
  authLoader.classList.add("hidden");
  if (loginShell) loginShell.classList.add("hidden");
  loginCard.classList.add("hidden");
  adminWorkspace.classList.remove("hidden");
  adminEmail.textContent = user.email;
  setAdminView(activeAdminView);
}

function showLogin() {
  document.body.classList.remove("auth-pending");
  document.body.classList.remove("admin-active");
  document.body.classList.add("login-active");
  document.title = "Masuk | Admin SALUT";
  authLoader.classList.add("hidden");
  closeSidebar();
  if (loginShell) loginShell.classList.remove("hidden");
  loginCard.classList.remove("hidden");
  adminWorkspace.classList.add("hidden");
  resetImportPreview({ clearFile: true });
  isCommitting = false;
  isUploading = false;
  previewButton.disabled = false;
  billsState.replaceChildren();
  studentsState.replaceChildren();
  studentsPagination.classList.add("hidden");
  importIssuesState.replaceChildren();
  billRows = [];
  importedBillGroups = [];
  currentStudentPage = 1;
  totalStudentPages = 1;
  setText(billsMessage, "");
  setText(manualMessage, "");
  closeStudentEditor();
  refreshCommitState();
  setSelectedFile();
  passwordInput.type = "password";
  passwordToggle.setAttribute("aria-pressed", "false");
  passwordToggle.setAttribute("aria-label", "Tampilkan password");
  passwordToggle.title = "Tampilkan password";
  window.setTimeout(() => document.querySelector("#email")?.focus(), 0);
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Response server tidak valid. Coba refresh halaman atau hubungi developer.");
  }
  if (response.status === 401 && path !== "/api/admin/login" && path !== "/api/admin/me") {
    showLogin();
    setText(loginMessage, "Sesi admin telah berakhir. Silakan masuk kembali.", "error");
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || "Request gagal.");
  }
  return payload;
}

function renderPreview(data) {
  currentImportToken = data.import_token;
  currentPreview = data;
  validCount.textContent = data.valid_rows;
  newCount.textContent = data.new_rows;
  unchangedCount.textContent = data.unchanged_rows;
  updateCount.textContent = data.update_rows;
  amountChangeCount.textContent = data.amount_change_rows;
  criticalCount.textContent = data.critical_rows;
  issueCount.textContent = data.issue_rows;

  sampleTable.innerHTML = `
    <table class="data-table preview-data-table">
      <caption class="visually-hidden">Contoh data dari file yang akan diimport</caption>
      <thead>
        <tr><th scope="col">NIM</th><th scope="col">Nama</th><th scope="col">Program Studi</th><th scope="col">BRIVA</th><th scope="col">Jumlah</th><th scope="col">Batas Pembayaran</th></tr>
      </thead>
      <tbody>
        ${data.sample
          .map(
            (row) =>
              `<tr><td data-label="NIM">${escapeHtml(row.nim)}</td><th data-label="Nama" scope="row">${escapeHtml(row.full_name)}</th><td data-label="Program Studi">${escapeHtml(row.program_study || "-")}</td><td data-label="BRIVA">${escapeHtml(row.briva)}</td><td data-label="Jumlah">${rupiah(row.amount)}</td><td data-label="Batas Pembayaran">${escapeHtml(row.due_date || "-")}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;

  if (data.errors.length === 0) {
    errorList.innerHTML = `<p class="muted">Tidak ada issue pada preview.</p>`;
  } else {
    errorList.innerHTML = [...data.errors]
      .sort((left, right) => (left.severity === "critical" ? -1 : 0) - (right.severity === "critical" ? -1 : 0))
      .map(
        (item) =>
          `<p><strong>${escapeHtml(item.sheet)} baris ${escapeHtml(item.row_number)}</strong><br />${escapeHtml(item.message)}</p>`,
      )
      .join("");
  }

  if (data.changes.length === 0) {
    changeState.classList.add("hidden");
  } else {
    changeTable.innerHTML = `
      <table class="data-table preview-data-table">
        <caption class="visually-hidden">Perubahan data yang terdeteksi</caption>
        <thead>
          <tr><th scope="col">NIM</th><th scope="col">Jenis</th><th scope="col">BRIVA</th><th scope="col">Nominal</th></tr>
        </thead>
        <tbody>
          ${data.changes
            .map(
              (change) =>
                `<tr><th data-label="NIM" scope="row">${escapeHtml(change.nim)}</th><td data-label="Jenis">${escapeHtml(change.change_type)}</td><td data-label="BRIVA">${escapeHtml(change.old_briva)} -&gt; ${escapeHtml(change.new_briva)}</td><td data-label="Nominal">${rupiah(change.old_amount)} -&gt; ${rupiah(change.new_amount)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
    changeState.classList.remove("hidden");
  }

  confirmUpdates.checked = false;
  confirmUpdatesRow.classList.toggle("hidden", !data.requires_update_confirmation);
  refreshCommitState();
  previewState.classList.remove("hidden");
  setImportStep(2);
}

function resetBillForm() {
  billForm.reset();
  document.querySelector("#bill-id").value = "";
  document.querySelector("#bill-form-period").value = "Semester Ganjil 2026";
  document.querySelector("#bill-form-type").value = "UKT BRIVA";
  document.querySelector("#bill-form-status").value = "unpaid";
  document.querySelector("#save-bill-button").textContent = "Simpan Data";
}

function closeStudentEditor() {
  studentEditor.classList.add("hidden");
  addStudentButton.setAttribute("aria-expanded", "false");
  resetBillForm();
}

function openStudentEditor(bill = null) {
  resetBillForm();
  if (bill) {
    studentEditorTitle.textContent = "Edit Data Mahasiswa";
    document.querySelector("#bill-id").value = bill.id;
    document.querySelector("#student-form-nim").value = bill.nim;
    document.querySelector("#student-form-name").value = bill.full_name;
    document.querySelector("#bill-form-briva").value = bill.briva;
    document.querySelector("#bill-form-amount").value = bill.amount;
    document.querySelector("#bill-form-period").value = bill.period;
    document.querySelector("#bill-form-type").value = bill.bill_type;
    document.querySelector("#bill-form-status").value = bill.status;
    document.querySelector("#bill-form-due-date").value = bill.due_date || "";
    document.querySelector("#save-bill-button").textContent = "Simpan Perubahan";
  } else {
    studentEditorTitle.textContent = "Tambah Data Mahasiswa";
  }
  studentEditor.classList.remove("hidden");
  addStudentButton.setAttribute("aria-expanded", "true");
  studentEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => document.querySelector("#student-form-nim").focus(), 250);
}

function statusLabel(status) {
  return { paid: "Lunas", partial: "Bayar sebagian", unpaid: "Belum lunas" }[status] || "Belum lunas";
}

function statusClass(status) {
  return status === "paid" ? "is-paid" : status === "partial" ? "is-partial" : "is-unpaid";
}

function isManualSource(sourceFile) {
  return ["manual", "manual admin"].includes(String(sourceFile || "").trim().toLowerCase());
}

function sourceBadge(sourceFile) {
  const source = String(sourceFile || "-");
  if (isManualSource(source)) return `<span class="source-badge is-manual">Manual admin</span>`;
  return `<span class="source-badge is-import">File import</span><span class="source-file-name" title="${escapeHtml(source)}">${escapeHtml(source)}</span>`;
}

function dueDateDisplay(value) {
  const text = String(value || "-").trim() || "-";
  const parts = text.match(/^(.*?)\s+Pukul\s+(.+)$/i);
  if (!parts) return `<span class="due-date-date">${escapeHtml(text)}</span>`;
  return `
    <span class="due-date-date">${escapeHtml(parts[1])}</span>
    <span class="due-date-time">${escapeHtml(parts[2])}</span>
  `;
}

function renderStudentBills(bills, offset = 0) {
  if (!bills.length) {
    const hasFilter = Boolean(manualSearch.value.trim() || statusFilter.value || sourceFilter.value);
    studentsState.innerHTML = `
      <div class="state-panel">
        <strong>${hasFilter ? "Data tidak ditemukan" : "Belum ada data mahasiswa"}</strong>
        <p>${hasFilter ? "Tidak ada data yang cocok dengan pencarian dan filter saat ini." : "Data mahasiswa yang ditambahkan atau diimport akan muncul di sini."}</p>
        ${hasFilter ? `<button type="button" class="ghost-button" data-reset-student-filter>Reset pencarian</button>` : `<button type="button" data-open-student-editor>Tambah Data</button>`}
      </div>
    `;
    return;
  }

  studentsState.innerHTML = `
    <table class="data-table student-data-table">
      <caption class="visually-hidden">Daftar mahasiswa dan tagihan</caption>
      <thead>
        <tr>
          <th scope="col" class="number-column">No.</th>
          <th scope="col" class="student-column">Mahasiswa</th>
          <th scope="col" class="briva-column">BRIVA</th>
          <th scope="col" class="amount-column">Nominal</th>
          <th scope="col" class="period-column">Periode</th>
          <th scope="col" class="type-column">Jenis</th>
          <th scope="col" class="status-column">Status</th>
          <th scope="col" class="due-date-column">Batas Aktif</th>
          <th scope="col" class="source-column">Sumber</th>
          <th scope="col" class="actions-column">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${bills
          .map(
            (bill, index) => `
              <tr data-bill-id="${escapeHtml(bill.id)}">
                <td data-label="No." class="number-column">${offset + index + 1}</td>
                <th data-label="Mahasiswa" scope="row" class="student-column"><strong>${escapeHtml(bill.full_name)}</strong><span class="student-nim">${escapeHtml(bill.nim)}</span></th>
                <td data-label="BRIVA" class="briva-column numeric-value">${escapeHtml(bill.briva)}</td>
                <td data-label="Nominal" class="amount-column numeric-value">${escapeHtml(bill.amount_formatted)}</td>
                <td data-label="Periode" class="period-column">${escapeHtml(bill.period)}</td>
                <td data-label="Jenis" class="type-column">${escapeHtml(bill.bill_type)}</td>
                <td data-label="Status" class="status-column"><span class="status-badge ${statusClass(bill.status)}"><span aria-hidden="true"></span>${statusLabel(bill.status)}</span></td>
                <td data-label="Batas Aktif" class="due-date-column">${dueDateDisplay(bill.due_date_formatted)}</td>
                <td data-label="Sumber" class="source-column">${sourceBadge(bill.source_file)}</td>
                <td data-label="Aksi" class="actions-column">
                  <div class="row-actions">
                    <button type="button" class="icon-action-button edit-bill-button ghost-button" data-bill-id="${escapeHtml(bill.id)}" title="Edit data" aria-label="Edit data mahasiswa ${escapeHtml(bill.nim)}">&#9998;</button>
                    <button type="button" class="icon-action-button delete-bill-button danger-button" data-bill-id="${escapeHtml(bill.id)}" title="Hapus data" aria-label="Hapus data mahasiswa ${escapeHtml(bill.nim)}">&times;</button>
                  </div>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderStudentPagination(pagination) {
  const total = Number(pagination.total || 0);
  const limit = Number(pagination.limit || STUDENT_PAGE_SIZE);
  const offset = Number(pagination.offset || 0);
  currentStudentPage = Number(pagination.page || 1);
  totalStudentPages = Number(pagination.total_pages || 1);
  const firstRow = total ? offset + 1 : 0;
  const lastRow = Math.min(offset + limit, total);
  studentsResultCount.textContent = `${total.toLocaleString("id-ID")} data`;
  studentsPageInfo.textContent = `${firstRow.toLocaleString("id-ID")}-${lastRow.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} data`;
  studentsPrevPage.disabled = currentStudentPage <= 1;
  studentsNextPage.disabled = currentStudentPage >= totalStudentPages;
  studentsPageNumbers.replaceChildren();

  const visiblePages = [];
  if (totalStudentPages <= 7) {
    for (let page = 1; page <= totalStudentPages; page += 1) visiblePages.push(page);
  } else {
    visiblePages.push(1);
    if (currentStudentPage > 4) visiblePages.push("start-ellipsis");
    const start = Math.max(2, currentStudentPage - 1);
    const end = Math.min(totalStudentPages - 1, currentStudentPage + 1);
    for (let page = start; page <= end; page += 1) visiblePages.push(page);
    if (currentStudentPage < totalStudentPages - 3) visiblePages.push("end-ellipsis");
    visiblePages.push(totalStudentPages);
  }

  for (const item of visiblePages) {
    if (typeof item !== "number") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.textContent = "...";
      studentsPageNumbers.append(ellipsis);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pagination-number-button ghost-button${item === currentStudentPage ? " is-active" : ""}`;
    button.dataset.page = String(item);
    button.textContent = String(item);
    button.setAttribute("aria-label", `Buka halaman ${item}`);
    if (item === currentStudentPage) button.setAttribute("aria-current", "page");
    studentsPageNumbers.append(button);
  }
  studentsPagination.classList.toggle("hidden", totalStudentPages <= 1);
}

function renderImportIssues(issues) {
  if (!issues.length) {
    importIssuesState.innerHTML = `
      <div class="state-panel is-compact is-success">
        <strong>Tidak ada data yang perlu diperbaiki</strong>
      </div>
    `;
    return;
  }

  importIssuesState.innerHTML = `
    <table class="data-table issue-data-table">
      <caption class="visually-hidden">Data import yang perlu diperbaiki</caption>
      <thead>
        <tr><th scope="col">File</th><th scope="col">Sheet</th><th scope="col">Baris</th><th scope="col">NIM</th><th scope="col">Nama</th><th scope="col">BRIVA</th><th scope="col">Nominal</th><th scope="col">Catatan</th></tr>
      </thead>
      <tbody>
        ${issues
          .map(
            (issue) => `
              <tr>
                <td data-label="File">${escapeHtml(issue.source_file)}</td>
                <td data-label="Sheet">${escapeHtml(issue.sheet_name)}</td>
                <td data-label="Baris">${escapeHtml(issue.row_number)}</td>
                <td data-label="NIM">${escapeHtml(issue.nim || "-")}</td>
                <td data-label="Nama">${escapeHtml(issue.full_name || "-")}</td>
                <td data-label="BRIVA">${escapeHtml(issue.briva || "-")}</td>
                <td data-label="Nominal">${escapeHtml(issue.amount || "-")}</td>
                <td data-label="Catatan">${escapeHtml(issue.note)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function loadStudentData(page = currentStudentPage) {
  const query = manualSearch.value.trim();
  const status = statusFilter.value;
  const source = sourceFilter.value;
  const requestedPage = Math.max(1, Number(page) || 1);
  const offset = (requestedPage - 1) * STUDENT_PAGE_SIZE;
  refreshManualButton.disabled = true;
  renderLoadingState(studentsState, "Memuat data mahasiswa...");
  setText(manualMessage, query ? `Mencari data "${query}"...` : "Memuat data mahasiswa...");
  try {
    const queryString = new URLSearchParams({
      limit: String(STUDENT_PAGE_SIZE),
      offset: String(offset),
    });
    if (query) queryString.set("query", query);
    if (status) queryString.set("status", status);
    if (source) queryString.set("source", source);
    const billsResult = await api(`/api/admin/bills?${queryString.toString()}`);
    billRows = billsResult.data.bills || [];
    const pagination = billsResult.data.pagination || { total: billRows.length, page: 1, total_pages: 1, offset: 0 };
    if (!billRows.length && Number(pagination.total || 0) > 0 && requestedPage > Number(pagination.total_pages || 1)) {
      return loadStudentData(Number(pagination.total_pages || 1));
    }
    renderStudentBills(billRows, Number(pagination.offset || 0));
    studentsState.removeAttribute("aria-busy");
    renderStudentPagination(pagination);
    const hasFilter = Boolean(query || status || source);
    setText(manualMessage, hasFilter ? `${Number(pagination.total || 0)} data sesuai pencarian dan filter.` : "Data mahasiswa siap.");
  } catch (error) {
    setText(manualMessage, error.message, "error");
    renderErrorState(studentsState, "Data tidak dapat dimuat", error.message, "students");
    studentsPagination.classList.add("hidden");
  } finally {
    refreshManualButton.disabled = false;
  }
}

async function loadImportIssues() {
  renderLoadingState(importIssuesState, "Memuat data perbaikan...", true);
  try {
    const result = await api("/api/admin/import-issues?limit=500");
    renderImportIssues(result.data.issues || []);
    importIssuesState.removeAttribute("aria-busy");
  } catch (error) {
    renderErrorState(importIssuesState, "Data perbaikan tidak dapat dimuat", error.message, "issues");
  }
}

function formatImportedAt(value) {
  if (!value) return "-";
  const timestamp = new Date(`${String(value).replace(" ", "T")}Z`);
  if (Number.isNaN(timestamp.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function renderImportedBills(groups) {
  importedBillGroups = groups;
  if (!groups.length) {
    billsState.innerHTML = `
      <div class="empty-state">
        <strong>Belum ada file import</strong>
        <p>File yang sudah disimpan akan muncul di halaman ini.</p>
      </div>
    `;
    return;
  }

  billsState.innerHTML = groups
    .map((group, index) => {
      const version = String(groups.length - index).padStart(2, "0");
      return `
        <article class="file-record-card">
          <header class="file-record-header">
            <div>
              <span class="file-version">Versi import ${version}</span>
              <h3>${escapeHtml(group.file_name)}</h3>
              <p class="muted">Diimport ${escapeHtml(formatImportedAt(group.imported_at))}</p>
            </div>
            <button type="button" class="delete-import-file-button danger-button" data-file-name="${escapeHtml(group.file_name)}" aria-label="Hapus file import ${escapeHtml(group.file_name)}">Hapus File</button>
          </header>

          <dl class="file-record-metrics">
            <div><dt>Mahasiswa</dt><dd>${escapeHtml(group.student_count)}</dd></div>
            <div><dt>Tagihan</dt><dd>${escapeHtml(group.total)}</dd></div>
            <div><dt>Total nominal</dt><dd>${escapeHtml(rupiah(group.total_amount))}</dd></div>
          </dl>

          <div class="file-status-summary" aria-label="Ringkasan status pembayaran">
            <span class="status-summary is-paid"><span aria-hidden="true"></span>${escapeHtml(group.paid)} Lunas</span>
            <span class="status-summary is-partial"><span aria-hidden="true"></span>${escapeHtml(group.partial)} Bayar sebagian</span>
            <span class="status-summary is-unpaid"><span aria-hidden="true"></span>${escapeHtml(group.unpaid)} Belum lunas</span>
          </div>

          <details class="file-record-details" data-group-index="${index}">
            <summary>Lihat ${escapeHtml(group.total)} data mahasiswa</summary>
            <div class="file-detail-content"></div>
          </details>
        </article>
      `;
    })
    .join("");
}

function renderFileDetail(groupIndex, page = 1) {
  const group = importedBillGroups[groupIndex];
  const details = billsState.querySelector(`.file-record-details[data-group-index="${groupIndex}"]`);
  const content = details?.querySelector(".file-detail-content");
  if (!group || !content) return;

  const total = group.bills.length;
  const totalPages = Math.max(1, Math.ceil(total / FILE_DETAIL_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const offset = (currentPage - 1) * FILE_DETAIL_PAGE_SIZE;
  const rows = group.bills.slice(offset, offset + FILE_DETAIL_PAGE_SIZE);
  const firstRow = total ? offset + 1 : 0;
  const lastRow = Math.min(offset + FILE_DETAIL_PAGE_SIZE, total);

  content.innerHTML = `
    <div class="table-mini">
      <table class="data-table file-detail-table">
        <caption class="visually-hidden">Rincian mahasiswa dari file ${escapeHtml(group.file_name)}</caption>
        <thead>
          <tr>
            <th scope="col">No.</th>
            <th scope="col">Status</th>
            <th scope="col">NIM</th>
            <th scope="col">Nama</th>
            <th scope="col">BRIVA</th>
            <th scope="col">Nominal</th>
            <th scope="col">Periode</th>
            <th scope="col">Batas Aktif</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (bill, index) => `
                <tr>
                  <td data-label="No.">${offset + index + 1}</td>
                  <td data-label="Status"><span class="status-badge ${statusClass(bill.status)}"><span aria-hidden="true"></span>${statusLabel(bill.status)}</span></td>
                  <td data-label="NIM" class="numeric-value">${escapeHtml(bill.nim)}</td>
                  <th data-label="Nama" scope="row">${escapeHtml(bill.full_name)}</th>
                  <td data-label="BRIVA" class="numeric-value">${escapeHtml(bill.briva)}</td>
                  <td data-label="Nominal" class="numeric-value">${escapeHtml(bill.amount_formatted)}</td>
                  <td data-label="Periode">${escapeHtml(bill.period)}</td>
                  <td data-label="Batas Aktif" class="due-date-cell">${dueDateDisplay(bill.due_date_formatted)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    ${
      totalPages > 1
        ? `<nav class="file-detail-pagination" aria-label="Navigasi rincian ${escapeHtml(group.file_name)}">
            <button type="button" class="pagination-button ghost-button file-detail-page-button" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""} aria-label="Halaman rincian sebelumnya">&lsaquo;</button>
            <span aria-live="polite">${firstRow}-${lastRow} dari ${total} data</span>
            <button type="button" class="pagination-button ghost-button file-detail-page-button" data-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""} aria-label="Halaman rincian berikutnya">&rsaquo;</button>
          </nav>`
        : ""
    }
  `;
  details.dataset.rendered = "true";
  details.dataset.page = String(currentPage);
}

async function loadImportedBills() {
  setText(billsMessage, "Memuat data mahasiswa per file...");
  refreshBillsButton.disabled = true;
  renderLoadingState(billsState, "Memuat file import...");
  try {
    const result = await api("/api/admin/imported-bills");
    const groups = result.data.groups || [];
    renderImportedBills(groups);
    billsState.removeAttribute("aria-busy");
    setText(billsMessage, `${groups.length} file import tersimpan.`);
  } catch (error) {
    setText(billsMessage, error.message, "error");
    renderErrorState(billsState, "File import tidak dapat dimuat", error.message, "files");
  } finally {
    refreshBillsButton.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  setText(loginMessage, "Memeriksa login...");
  loginSubmitButton.disabled = true;
  loginSubmitButton.setAttribute("aria-busy", "true");
  loginSubmitButton.textContent = "Memproses...";
  const body = JSON.stringify(Object.fromEntries(new FormData(loginForm)));

  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    setText(loginMessage, "");
    loginForm.reset();
    showAdmin(result.data);
  } catch (error) {
    setText(loginMessage, error.message, "error");
    document.querySelector("#email").setAttribute("aria-invalid", "true");
    passwordInput.setAttribute("aria-invalid", "true");
  } finally {
    loginSubmitButton.disabled = false;
    loginSubmitButton.removeAttribute("aria-busy");
    loginSubmitButton.textContent = "Masuk";
  }
});

passwordToggle.addEventListener("click", () => {
  const shouldShow = passwordInput.type === "password";
  passwordInput.type = shouldShow ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(shouldShow));
  passwordToggle.setAttribute("aria-label", shouldShow ? "Sembunyikan password" : "Tampilkan password");
  passwordToggle.title = shouldShow ? "Sembunyikan password" : "Tampilkan password";
  passwordInput.focus();
});

for (const input of loginForm.querySelectorAll("input")) {
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    setText(loginMessage, "");
  });
}

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!fileInput.files.length) {
    setText(importMessage, "Pilih file Excel .xlsx terlebih dahulu.", "error");
    return;
  }
  const selectedFile = fileInput.files[0];
  if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
    setText(importMessage, "File harus berformat .xlsx.", "error");
    return;
  }
  if (selectedFile.size > 5 * 1024 * 1024) {
    setText(importMessage, "Ukuran file melebihi batas 5 MB.", "error");
    return;
  }
  isUploading = true;
  previewButton.disabled = true;
  commitButton.disabled = true;
  setText(importMessage, "Mengunggah dan membaca Excel...");
  resetImportPreview();

  try {
    const result = await api("/api/admin/import/preview", {
      method: "POST",
      body: new FormData(importForm),
    });
    renderPreview(result.data);
    setText(
      importMessage,
      result.data.critical_rows > 0
        ? "Ada baris kritis. Perbaiki file sebelum import dapat di-commit."
        : result.data.requires_update_confirmation
          ? "Ada perubahan nominal atau BRIVA. Periksa daftar perubahan dan setujui sebelum commit."
          : result.data.skipped_rows > 0
            ? `Preview siap. ${result.data.skipped_rows} baris tidak valid akan dilewati dan perlu diperbaiki manual setelah commit.`
            : "Preview siap. Periksa ringkasan sebelum commit.",
      result.data.critical_rows > 0 ? "error" : "",
    );
  } catch (error) {
    setText(importMessage, error.message, "error");
    showToast(error.message, "error");
  } finally {
    isUploading = false;
    previewButton.disabled = !fileInput.files.length;
    refreshCommitState();
  }
});

fileInput.addEventListener("change", () => {
  if (currentPreview) resetImportPreview();
  const file = fileInput.files[0] || null;
  setSelectedFile(file);
  if (file) setText(importMessage, `${file.name} siap diperiksa.`);
  else setText(importMessage, "");
});

for (const eventName of ["dragenter", "dragover"]) {
  filePicker.addEventListener(eventName, () => filePicker.classList.add("is-dragging"));
}
for (const eventName of ["dragleave", "drop"]) {
  filePicker.addEventListener(eventName, () => filePicker.classList.remove("is-dragging"));
}

confirmUpdates.addEventListener("change", refreshCommitState);
cancelPreviewButton.addEventListener("click", () => {
  resetImportPreview({ clearFile: true });
  setText(importMessage, "Preview dibatalkan.");
});

commitButton.addEventListener("click", async () => {
  if (!currentImportToken || !currentPreview) {
    setText(importMessage, "Preview file terlebih dahulu sebelum commit import.", "error");
    return;
  }
  if (currentPreview.critical_rows > 0) {
    setText(importMessage, "Commit belum bisa dilakukan karena masih ada baris kritis. Perbaiki file lalu preview ulang.", "error");
    return;
  }
  if (currentPreview.requires_update_confirmation && !confirmUpdates.checked) {
    setText(importMessage, "Centang persetujuan perubahan nominal atau BRIVA sebelum commit import.", "error");
    return;
  }
  isCommitting = true;
  setImportStep(3);
  commitButton.disabled = true;
  previewButton.disabled = true;
  setText(importMessage, "Menyimpan data ke SQLite...");

  try {
    const result = await api("/api/admin/import/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ import_token: currentImportToken, confirm_updates: confirmUpdates.checked }),
    });
    const issueDetails = (result.data.issue_details || [])
      .map((issue) => `${issue.sheet} baris ${issue.row_number}`)
      .join(", ");
    const importSummary = `Import selesai: ${result.data.created} baru, ${result.data.updated} diperbarui, ${result.data.unchanged} tidak berubah.`;
    if (result.data.issues > 0) {
      const notification = `${importSummary} ${result.data.issues} baris dilewati dan dicatat untuk perbaikan manual${issueDetails ? `: ${issueDetails}` : ""}.`;
      setText(importMessage, notification, "warning");
      showToast("Import selesai dengan data yang perlu diperbaiki.", "warning");
    } else {
      setText(importMessage, importSummary);
      showToast("Import berhasil disimpan.");
    }
    resetImportPreview({ clearFile: true });
    loadImportIssues();
  } catch (error) {
    setText(importMessage, error.message, "error");
    setImportStep(2);
    showToast(error.message, "error");
  } finally {
    isCommitting = false;
    previewButton.disabled = false;
    refreshCommitState();
  }
});

billForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const billId = document.querySelector("#bill-id").value;
  const payload = Object.fromEntries(new FormData(billForm));
  delete payload.id;
  setText(manualMessage, billId ? "Menyimpan perubahan data..." : "Menambah data mahasiswa...");

  try {
    await api(billId ? `/api/admin/bills/${encodeURIComponent(billId)}` : "/api/admin/bills", {
      method: billId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    closeStudentEditor();
    currentStudentPage = 1;
    setText(manualMessage, "Data mahasiswa berhasil disimpan.");
    showToast(billId ? "Perubahan data berhasil disimpan." : "Data mahasiswa berhasil ditambahkan.");
    await loadStudentData();
  } catch (error) {
    setText(manualMessage, error.message, "error");
    showToast(error.message, "error");
  }
});

addStudentButton.addEventListener("click", () => openStudentEditor());
resetBillButton.addEventListener("click", closeStudentEditor);
closeEditorButton.addEventListener("click", closeStudentEditor);
refreshManualButton.addEventListener("click", () => loadStudentData(currentStudentPage));
clearSearchButton.addEventListener("click", () => {
  manualSearch.value = "";
  statusFilter.value = "";
  sourceFilter.value = "";
  currentStudentPage = 1;
  loadStudentData(1);
});

manualSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  currentStudentPage = 1;
  await loadStudentData(1);
});

statusFilter.addEventListener("change", () => {
  currentStudentPage = 1;
  loadStudentData(1);
});

sourceFilter.addEventListener("change", () => {
  currentStudentPage = 1;
  loadStudentData(1);
});

studentsPrevPage.addEventListener("click", () => {
  if (currentStudentPage > 1) loadStudentData(currentStudentPage - 1);
});

studentsNextPage.addEventListener("click", () => {
  if (currentStudentPage < totalStudentPages) loadStudentData(currentStudentPage + 1);
});

studentsPageNumbers.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const page = Number(target.dataset.page || 0);
  if (page >= 1 && page <= totalStudentPages && page !== currentStudentPage) loadStudentData(page);
});

refreshBillsButton.addEventListener("click", loadImportedBills);

billsState.addEventListener(
  "toggle",
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || details.dataset.rendered === "true") return;
    renderFileDetail(Number(details.dataset.groupIndex || 0), 1);
  },
  true,
);

billsCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.classList.contains("file-detail-page-button")) {
    const details = target.closest(".file-record-details");
    if (!(details instanceof HTMLDetailsElement)) return;
    const currentPage = Number(details.dataset.page || 1);
    const targetPage = Number(target.dataset.page || 1);
    renderFileDetail(Number(details.dataset.groupIndex || 0), targetPage);
    const buttons = Array.from(details.querySelectorAll(".file-detail-page-button:not([disabled])"));
    const focusTarget = targetPage > currentPage ? buttons.at(-1) : buttons[0];
    focusTarget?.focus();
    return;
  }

  if (!target.classList.contains("delete-import-file-button")) return;

  const fileName = target.dataset.fileName || "";
  if (!fileName) return;
  const reason = await requestDeleteConfirmation({
    title: "Hapus File Import",
    description: `File ${fileName} beserta seluruh data hasil impornya akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
    submitLabel: "Hapus File",
  });
  if (!reason) return;

  target.disabled = true;
  setText(billsMessage, `Menghapus file ${fileName}...`);
  try {
    const result = await api("/api/admin/imported-files", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_name: fileName, reason }),
    });
    await loadImportedBills();
    setText(billsMessage, `File ${fileName} dan ${result.data.deleted_bills} data berhasil dihapus.`);
    showToast(`File ${fileName} berhasil dihapus.`);
  } catch (error) {
    setText(billsMessage, error.message, "error");
    showToast(error.message, "error");
  } finally {
    target.disabled = false;
  }
});

studentsCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.hasAttribute("data-reset-student-filter")) {
    clearSearchButton.click();
    return;
  }

  if (target.hasAttribute("data-open-student-editor")) {
    openStudentEditor();
    return;
  }

  if (target.classList.contains("edit-bill-button")) {
    const bill = billRows.find((item) => item.id === (target.dataset.billId || ""));
    if (!bill) return;
    openStudentEditor(bill);
    return;
  }

  if (target.classList.contains("delete-bill-button")) {
    const billId = target.dataset.billId || "";
    const bill = billRows.find((item) => item.id === billId);
    if (!bill) return;
    const reason = await requestDeleteConfirmation({
      title: "Hapus Data Mahasiswa",
      description: `${bill.full_name} (${bill.nim}) dengan BRIVA ${bill.briva} akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
    });
    if (!reason) return;
    target.disabled = true;
    setText(manualMessage, "Menghapus data mahasiswa...");
    try {
      await api(`/api/admin/bills/${encodeURIComponent(billId)}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" });
      setText(manualMessage, "Data mahasiswa berhasil dihapus.");
      showToast("Data mahasiswa berhasil dihapus.");
      closeStudentEditor();
      await loadStudentData();
    } catch (error) {
      setText(manualMessage, error.message, "error");
      showToast(error.message, "error");
    } finally {
      target.disabled = false;
    }
  }
});

confirmModalSubmit.addEventListener("click", () => {
  const reason = confirmModalReason.value.trim();
  if (!reason) {
    confirmModalError.textContent = "Alasan penghapusan wajib diisi.";
    confirmModalReason.focus();
    return;
  }
  closeConfirmModal(reason);
});

confirmModalReason.addEventListener("input", () => {
  confirmModalError.textContent = "";
});

confirmModalCancel.addEventListener("click", () => closeConfirmModal(null));
confirmModalClose.addEventListener("click", () => closeConfirmModal(null));
confirmModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.hasAttribute("data-modal-cancel")) closeConfirmModal(null);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const action = target.dataset.retryAction;
  if (action === "students") loadStudentData();
  if (action === "issues") loadImportIssues();
  if (action === "files") loadImportedBills();
});

document.addEventListener("keydown", (event) => {
  if (confirmModal.classList.contains("hidden")) {
    if (event.key === "Escape" && adminSidebar?.classList.contains("is-open")) closeSidebar(true);
    return;
  }
  if (event.key === "Escape") {
    closeConfirmModal(null);
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    confirmModalDialog.querySelectorAll("button:not([disabled]), textarea:not([disabled])"),
  ).filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

logoutButton?.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showLogin();
});

logoutButtonMobile?.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showLogin();
});

sidebarToggle?.addEventListener("click", toggleSidebar);
sidebarOverlay?.addEventListener("click", () => closeSidebar(true));

for (const button of adminViewButtons) {
  button.addEventListener("click", () => setAdminView(button.dataset.adminView || "upload"));
}

setSelectedFile();
api("/api/admin/me").then((result) => showAdmin(result.data)).catch(() => showLogin());
