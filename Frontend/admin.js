const loginCard = document.querySelector("#login-card");
const importCard = document.querySelector("#import-card");
const manualCard = document.querySelector("#manual-card");
const billsCard = document.querySelector("#bills-card");
const loginForm = document.querySelector("#login-form");
const importForm = document.querySelector("#import-form");
const studentForm = document.querySelector("#student-form");
const billForm = document.querySelector("#bill-form");
const loginMessage = document.querySelector("#login-message");
const importMessage = document.querySelector("#import-message");
const manualMessage = document.querySelector("#manual-message");
const billsMessage = document.querySelector("#bills-message");
const logoutButton = document.querySelector("#logout-button");
const adminEmail = document.querySelector("#admin-email");
const fileInput = document.querySelector("#excel-file");
const previewButton = importForm.querySelector("button[type='submit']");
const refreshManualButton = document.querySelector("#refresh-manual-button");
const refreshBillsButton = document.querySelector("#refresh-bills-button");
const resetStudentButton = document.querySelector("#reset-student-button");
const resetBillButton = document.querySelector("#reset-bill-button");
const manualSearchForm = document.querySelector("#manual-search-form");
const manualSearch = document.querySelector("#manual-search");
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
const changeState = document.querySelector("#change-state");
const changeTable = document.querySelector("#change-table");
const confirmUpdatesRow = document.querySelector("#confirm-updates-row");
const confirmUpdates = document.querySelector("#confirm-updates");
const billsState = document.querySelector("#bills-state");
const studentsState = document.querySelector("#students-state");
const manualBillsState = document.querySelector("#manual-bills-state");
const importIssuesState = document.querySelector("#import-issues-state");

let currentImportToken = "";
let currentPreview = null;
let isCommitting = false;
let isUploading = false;
let studentRows = [];
let billRows = [];

function setText(node, text, type = "") {
  node.textContent = text;
  node.className = `form-message ${type}`.trim();
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
  commitButton.disabled = isCommitting;
}

function showAdmin(user) {
  loginCard.classList.add("hidden");
  importCard.classList.remove("hidden");
  manualCard.classList.remove("hidden");
  billsCard.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  adminEmail.textContent = user.email;
  loadManualData();
  loadImportedBills();
}

function showLogin() {
  loginCard.classList.remove("hidden");
  importCard.classList.add("hidden");
  manualCard.classList.add("hidden");
  billsCard.classList.add("hidden");
  logoutButton.classList.add("hidden");
  previewState.classList.add("hidden");
  currentImportToken = "";
  currentPreview = null;
  isCommitting = false;
  isUploading = false;
  previewButton.disabled = false;
  billsState.replaceChildren();
  studentsState.replaceChildren();
  manualBillsState.replaceChildren();
  importIssuesState.replaceChildren();
  studentRows = [];
  billRows = [];
  setText(billsMessage, "");
  setText(manualMessage, "");
  refreshCommitState();
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Response server tidak valid. Coba refresh halaman atau hubungi developer.");
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
    <table>
      <thead>
        <tr><th>NIM</th><th>Nama</th><th>Program Studi</th><th>BRIVA</th><th>Jumlah</th><th>Batas Pembayaran</th></tr>
      </thead>
      <tbody>
        ${data.sample
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.nim)}</td><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.program_study || "-")}</td><td>${escapeHtml(row.briva)}</td><td>${rupiah(row.amount)}</td><td>${escapeHtml(row.due_date || "-")}</td></tr>`,
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
      <table>
        <thead>
          <tr><th>NIM</th><th>Jenis</th><th>BRIVA</th><th>Nominal</th></tr>
        </thead>
        <tbody>
          ${data.changes
            .map(
              (change) =>
                `<tr><td>${escapeHtml(change.nim)}</td><td>${escapeHtml(change.change_type)}</td><td>${escapeHtml(change.old_briva)} -> ${escapeHtml(change.new_briva)}</td><td>${rupiah(change.old_amount)} -> ${rupiah(change.new_amount)}</td></tr>`,
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
}

function resetStudentForm() {
  studentForm.reset();
  document.querySelector("#student-id").value = "";
  document.querySelector("#save-student-button").textContent = "Simpan";
}

function resetBillForm() {
  billForm.reset();
  document.querySelector("#bill-id").value = "";
  document.querySelector("#bill-form-period").value = "Semester Ganjil 2026";
  document.querySelector("#bill-form-type").value = "UKT BRIVA";
  document.querySelector("#bill-form-status").value = "unpaid";
  document.querySelector("#save-bill-button").textContent = "Simpan";
}

function renderStudents(students) {
  if (!students.length) {
    studentsState.innerHTML = `<p class="muted">Belum ada mahasiswa.</p>`;
    return;
  }

  studentsState.innerHTML = `
    <table>
      <thead>
        <tr><th>Mahasiswa</th><th>Tagihan</th><th>Total</th><th class="actions-column">Aksi</th></tr>
      </thead>
      <tbody>
        ${students
          .map(
            (student) => `
              <tr data-student-id="${escapeHtml(student.id)}">
                <td><strong>${escapeHtml(student.full_name)}</strong><br /><span class="muted">${escapeHtml(student.nim)}</span></td>
                <td>${escapeHtml(student.bill_count)}</td>
                <td>${escapeHtml(student.total_amount_formatted)}</td>
                <td class="actions-column">
                  <div class="row-actions">
                    <button type="button" class="icon-action-button edit-student-button ghost-button" data-student-id="${escapeHtml(student.id)}" title="Edit mahasiswa" aria-label="Edit mahasiswa ${escapeHtml(student.nim)}">✎</button>
                    <button type="button" class="icon-action-button delete-student-button danger-button" data-student-id="${escapeHtml(student.id)}" title="Hapus mahasiswa" aria-label="Hapus mahasiswa ${escapeHtml(student.nim)}">×</button>
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

function renderManualBills(bills) {
  if (!bills.length) {
    manualBillsState.innerHTML = `<p class="muted">Belum ada tagihan.</p>`;
    return;
  }

  manualBillsState.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Mahasiswa</th>
          <th>BRIVA</th>
          <th>Nominal</th>
          <th>Periode</th>
          <th>Jenis</th>
          <th>Status</th>
          <th>Batas Aktif</th>
          <th class="actions-column">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${bills
          .map(
            (bill) => `
              <tr data-bill-id="${escapeHtml(bill.id)}">
                <td><strong>${escapeHtml(bill.full_name)}</strong><br /><span class="muted">${escapeHtml(bill.nim)}</span></td>
                <td>${escapeHtml(bill.briva)}</td>
                <td>${escapeHtml(bill.amount_formatted)}</td>
                <td>${escapeHtml(bill.period)}</td>
                <td>${escapeHtml(bill.bill_type)}</td>
                <td class="bill-status-text ${bill.status === "paid" ? "is-paid" : "is-unpaid"}">${bill.status === "paid" ? "Lunas" : "Belum lunas"}</td>
                <td>${escapeHtml(bill.due_date_formatted || "-")}</td>
                <td class="actions-column">
                  <div class="row-actions">
                    <button type="button" class="icon-action-button edit-bill-button ghost-button" data-bill-id="${escapeHtml(bill.id)}" title="Edit tagihan" aria-label="Edit tagihan BRIVA ${escapeHtml(bill.briva)}">✎</button>
                    <button type="button" class="icon-action-button delete-bill-button danger-button" data-bill-id="${escapeHtml(bill.id)}" title="Hapus tagihan" aria-label="Hapus tagihan BRIVA ${escapeHtml(bill.briva)}">×</button>
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

function renderImportIssues(issues) {
  if (!issues.length) {
    importIssuesState.innerHTML = `<p class="muted">Tidak ada data yang perlu diperbaiki.</p>`;
    return;
  }

  importIssuesState.innerHTML = `
    <table>
      <thead>
        <tr><th>File</th><th>Sheet</th><th>Baris</th><th>NIM</th><th>Nama</th><th>BRIVA</th><th>Nominal</th><th>Catatan</th></tr>
      </thead>
      <tbody>
        ${issues
          .map(
            (issue) => `
              <tr>
                <td>${escapeHtml(issue.source_file)}</td>
                <td>${escapeHtml(issue.sheet_name)}</td>
                <td>${escapeHtml(issue.row_number)}</td>
                <td>${escapeHtml(issue.nim || "-")}</td>
                <td>${escapeHtml(issue.full_name || "-")}</td>
                <td>${escapeHtml(issue.briva || "-")}</td>
                <td>${escapeHtml(issue.amount || "-")}</td>
                <td>${escapeHtml(issue.note)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function loadManualData() {
  const query = manualSearch.value.trim();
  refreshManualButton.disabled = true;
  setText(manualMessage, query ? `Mencari data "${query}"...` : "Memuat data manual...");
  try {
    const queryString = query ? `?query=${encodeURIComponent(query)}&limit=2000` : "?limit=2000";
    const [studentsResult, billsResult, issuesResult] = await Promise.all([
      api(`/api/admin/students${queryString}`),
      api(`/api/admin/bills${queryString}`),
      api("/api/admin/import-issues?limit=500"),
    ]);
    studentRows = studentsResult.data.students || [];
    billRows = billsResult.data.bills || [];
    renderStudents(studentRows);
    renderManualBills(billRows);
    renderImportIssues(issuesResult.data.issues || []);
    setText(manualMessage, query ? `Hasil pencarian siap: ${studentRows.length} mahasiswa, ${billRows.length} tagihan.` : "Data manual siap.");
  } catch (error) {
    setText(manualMessage, error.message, "error");
  } finally {
    refreshManualButton.disabled = false;
  }
}

function renderImportedBills(groups) {
  if (!groups.length) {
    billsState.innerHTML = `<p class="muted">Belum ada tagihan yang tersimpan.</p>`;
    return;
  }

  billsState.innerHTML = groups
    .map(
      (group) => `
        <section class="file-bill-group">
          <div class="file-bill-header">
            <div>
              <h3>${escapeHtml(group.file_name)}</h3>
              <p class="muted">${escapeHtml(group.total)} tagihan - ${escapeHtml(group.paid)} lunas - ${escapeHtml(group.unpaid)} belum lunas</p>
            </div>
            <div class="bulk-due-date-bar">
              <span class="label-small">Set Tanggal Semua:</span>
              <input type="date" class="bulk-due-date-input" aria-label="Batas aktif massal untuk file ${escapeHtml(group.file_name)}" />
              <button type="button" class="bulk-due-date-button ghost-button">Simpan Ke Semua</button>
            </div>
          </div>
          <div class="table-mini">
            <table>
              <thead>
                <tr>
                  <th>Lunas</th>
                  <th>NIM</th>
                  <th>Nama</th>
                  <th>BRIVA</th>
                  <th>Nominal</th>
                  <th>Periode</th>
                  <th>Batas Aktif</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${group.bills
                  .map(
                    (bill) => `
                      <tr data-bill-id="${escapeHtml(bill.id)}">
                        <td>
                          <input class="status-toggle ${bill.status === "paid" ? "is-paid" : "is-unpaid"}" type="checkbox" data-bill-id="${escapeHtml(bill.id)}" ${
                            bill.status === "paid" ? "checked" : ""
                          } aria-label="Tandai lunas untuk NIM ${escapeHtml(bill.nim)}" />
                        </td>
                        <td>${escapeHtml(bill.nim)}</td>
                        <td>${escapeHtml(bill.full_name)}</td>
                        <td>${escapeHtml(bill.briva)}</td>
                        <td>${escapeHtml(bill.amount_formatted)}</td>
                        <td>${escapeHtml(bill.period)}</td>
                        <td>
                          <div class="due-date-cell-group">
                            <input class="due-date-input" type="date" data-bill-id="${escapeHtml(bill.id)}" value="${escapeHtml(bill.due_date || "")}" aria-label="Pilih batas aktif untuk NIM ${escapeHtml(bill.nim)}" />
                            <button type="button" class="save-due-date-button ghost-button" data-bill-id="${escapeHtml(bill.id)}">Simpan</button>
                          </div>
                        </td>
                        <td class="bill-status-text ${bill.status === "paid" ? "is-paid" : "is-unpaid"}">${bill.status === "paid" ? "Lunas" : "Belum lunas"}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
      `,
    )
    .join("");
}

async function loadImportedBills() {
  setText(billsMessage, "Memuat data tagihan...");
  refreshBillsButton.disabled = true;
  try {
    const result = await api("/api/admin/imported-bills");
    renderImportedBills(result.data.groups || []);
    setText(billsMessage, "Data tagihan siap.");
  } catch (error) {
    setText(billsMessage, error.message, "error");
  } finally {
    refreshBillsButton.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setText(loginMessage, "Memeriksa login...");
  const body = JSON.stringify(Object.fromEntries(new FormData(loginForm)));

  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    setText(loginMessage, "");
    showAdmin(result.data);
  } catch (error) {
    setText(loginMessage, error.message, "error");
  }
});

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
  isUploading = true;
  previewButton.disabled = true;
  commitButton.disabled = true;
  setText(importMessage, "Mengunggah dan membaca Excel...");
  previewState.classList.add("hidden");
  currentImportToken = "";
  currentPreview = null;

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
  } finally {
    isUploading = false;
    previewButton.disabled = false;
    refreshCommitState();
  }
});

confirmUpdates.addEventListener("change", refreshCommitState);

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
  commitButton.disabled = true;
  previewButton.disabled = true;
  setText(importMessage, "Menyimpan data ke SQLite...");

  try {
    const result = await api("/api/admin/import/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ import_token: currentImportToken, confirm_updates: confirmUpdates.checked }),
    });
    previewState.classList.add("hidden");
    currentImportToken = "";
    currentPreview = null;
    importForm.reset();
    const issueDetails = (result.data.issue_details || [])
      .map((issue) => `${issue.sheet} baris ${issue.row_number}`)
      .join(", ");
    const importSummary = `Import selesai: ${result.data.created} baru, ${result.data.updated} diperbarui, ${result.data.unchanged} tidak berubah.`;
    if (result.data.issues > 0) {
      const notification = `${importSummary} ${result.data.issues} baris dilewati dan dicatat untuk perbaikan manual${issueDetails ? `: ${issueDetails}` : ""}.`;
      setText(importMessage, notification, "warning");
      alert(`${notification}\n\nPerbaiki data tersebut melalui Kelola Manual.`);
    } else {
      setText(importMessage, importSummary);
    }
    loadManualData();
    loadImportedBills();
  } catch (error) {
    setText(importMessage, error.message, "error");
  } finally {
    isCommitting = false;
    previewButton.disabled = false;
    refreshCommitState();
  }
});

studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentId = document.querySelector("#student-id").value;
  const payload = Object.fromEntries(new FormData(studentForm));
  delete payload.id;
  setText(manualMessage, studentId ? "Menyimpan perubahan mahasiswa..." : "Menambah mahasiswa...");

  try {
    await api(studentId ? `/api/admin/students/${encodeURIComponent(studentId)}` : "/api/admin/students", {
      method: studentId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    resetStudentForm();
    setText(manualMessage, "Data mahasiswa berhasil disimpan.");
    alert("Data mahasiswa berhasil disimpan.");
    await loadManualData();
    loadImportedBills();
  } catch (error) {
    setText(manualMessage, error.message, "error");
  }
});

billForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const billId = document.querySelector("#bill-id").value;
  const payload = Object.fromEntries(new FormData(billForm));
  payload.nim = document.querySelector("#student-form-nim").value;
  payload.full_name = document.querySelector("#student-form-name").value;
  delete payload.id;
  setText(manualMessage, billId ? "Menyimpan perubahan tagihan..." : "Menambah tagihan...");

  try {
    await api(billId ? `/api/admin/bills/${encodeURIComponent(billId)}` : "/api/admin/bills", {
      method: billId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    resetBillForm();
    setText(manualMessage, "Data tagihan berhasil disimpan.");
    alert("Data tagihan berhasil disimpan.");
    await loadManualData();
    loadImportedBills();
  } catch (error) {
    setText(manualMessage, error.message, "error");
  }
});

resetStudentButton.addEventListener("click", resetStudentForm);
resetBillButton.addEventListener("click", resetBillForm);
refreshManualButton.addEventListener("click", loadManualData);

manualSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadManualData();
});

refreshBillsButton.addEventListener("click", loadImportedBills);

billsState.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.classList.contains("status-toggle")) {
    const billId = target.dataset.billId || "";
    const status = target.checked ? "paid" : "unpaid";
    target.disabled = true;
    setText(billsMessage, "Menyimpan status tagihan...");
    try {
      await api("/api/admin/bills/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bill_id: billId, status }),
      });
      const row = target.closest("tr");
      const statusText = row.querySelector(".bill-status-text");
      statusText.textContent = status === "paid" ? "Lunas" : "Belum lunas";
      statusText.classList.toggle("is-paid", status === "paid");
      statusText.classList.toggle("is-unpaid", status !== "paid");
      target.classList.toggle("is-paid", status === "paid");
      target.classList.toggle("is-unpaid", status !== "paid");
      setText(billsMessage, "Status tagihan diperbarui.");
      loadImportedBills();
    } catch (error) {
      target.checked = !target.checked;
      setText(billsMessage, error.message, "error");
    } finally {
      target.disabled = false;
    }
  } else if (target.classList.contains("due-date-input")) {
    const billId = target.dataset.billId || "";
    const dueDate = target.value;
    target.disabled = true;
    setText(billsMessage, "Menyimpan batas aktif pembayaran...");
    try {
      await api("/api/admin/bills/due-date", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bill_id: billId, due_date: dueDate }),
      });
      setText(billsMessage, "Batas aktif pembayaran berhasil diperbarui.");
    } catch (error) {
      setText(billsMessage, error.message, "error");
    } finally {
      target.disabled = false;
    }
  }
});

manualCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.classList.contains("save-due-date-button")) {
    const billId = target.dataset.billId || "";
    const container = target.closest(".due-date-cell-group");
    const input = container ? container.querySelector(".due-date-input") : null;
    const dueDate = input ? input.value : "";
    target.disabled = true;
    setText(billsMessage, "Menyimpan batas aktif pembayaran...");
    try {
      await api("/api/admin/bills/due-date", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bill_id: billId, due_date: dueDate }),
      });
      setText(billsMessage, "Batas aktif pembayaran berhasil disimpan.");
    } catch (error) {
      setText(billsMessage, error.message, "error");
    } finally {
      target.disabled = false;
    }
  } else if (target.classList.contains("bulk-due-date-button")) {
    const groupSection = target.closest(".file-bill-group");
    if (!groupSection) return;
    const bulkInput = groupSection.querySelector(".bulk-due-date-input");
    const dueDate = bulkInput ? bulkInput.value : "";
    const rowInputs = groupSection.querySelectorAll(".due-date-input");
    const billIds = Array.from(rowInputs).map((input) => input.dataset.billId).filter(Boolean);

    if (!billIds.length) {
      setText(billsMessage, "Tidak ada tagihan untuk diperbarui.", "error");
      return;
    }

    target.disabled = true;
    setText(billsMessage, "Menyimpan batas aktif untuk semua tagihan...");
    try {
      const result = await api("/api/admin/bills/due-date", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bill_ids: billIds, due_date: dueDate }),
      });
      for (const input of rowInputs) {
        input.value = dueDate;
      }
      setText(billsMessage, `Batas aktif berhasil disimpan untuk ${result.data.updated_count || billIds.length} tagihan.`);
    } catch (error) {
      setText(billsMessage, error.message, "error");
    } finally {
      target.disabled = false;
    }
  }
});

manualCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.classList.contains("delete-bill-button")) {
    const billId = target.dataset.billId || "";
    const bill = billRows.find((item) => item.id === billId);
    if (!bill || !confirm(`Hapus tagihan BRIVA ${bill.briva} untuk NIM ${bill.nim}?`)) {
      return;
    }
    target.disabled = true;
    setText(manualMessage, "Menghapus tagihan...");
    try {
      await api(`/api/admin/bills/${encodeURIComponent(billId)}`, { method: "DELETE" });
      setText(manualMessage, "Tagihan berhasil dihapus.");
      alert("Tagihan berhasil dihapus.");
      await loadManualData();
      loadImportedBills();
    } catch (error) {
      setText(manualMessage, error.message, "error");
    } finally {
      target.disabled = false;
    }
  }
});

manualCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.classList.contains("edit-bill-button")) {
    const bill = billRows.find((item) => item.id === (target.dataset.billId || ""));
    if (!bill) return;
    if (!confirm(`Edit tagihan BRIVA ${bill.briva} untuk NIM ${bill.nim}?`)) {
      return;
    }
    document.querySelector("#bill-id").value = bill.id;
    document.querySelector("#student-id").value = "";
    document.querySelector("#student-form-nim").value = bill.nim;
    document.querySelector("#student-form-name").value = bill.full_name;
    document.querySelector("#bill-form-briva").value = bill.briva;
    document.querySelector("#bill-form-amount").value = bill.amount;
    document.querySelector("#bill-form-period").value = bill.period;
    document.querySelector("#bill-form-type").value = bill.bill_type;
    document.querySelector("#bill-form-status").value = bill.status;
    document.querySelector("#bill-form-due-date").value = bill.due_date || "";
    document.querySelector("#save-bill-button").textContent = "Update";
    manualCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

manualCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.classList.contains("edit-student-button")) {
    const student = studentRows.find((item) => item.id === (target.dataset.studentId || ""));
    if (!student) return;
    if (!confirm(`Edit data mahasiswa ${student.nim} - ${student.full_name}?`)) {
      return;
    }
    document.querySelector("#student-id").value = student.id;
    document.querySelector("#student-form-nim").value = student.nim;
    document.querySelector("#student-form-name").value = student.full_name;
    document.querySelector("#save-student-button").textContent = "Update";
    manualCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

manualCard.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.classList.contains("delete-student-button")) {
    const studentId = target.dataset.studentId || "";
    const student = studentRows.find((item) => item.id === studentId);
    if (!student || !confirm(`Hapus mahasiswa ${student.nim} dan semua tagihannya?`)) {
      return;
    }
    target.disabled = true;
    setText(manualMessage, "Menghapus mahasiswa...");
    try {
      await api(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
      setText(manualMessage, "Mahasiswa berhasil dihapus.");
      alert("Mahasiswa berhasil dihapus.");
      resetStudentForm();
      resetBillForm();
      await loadManualData();
      loadImportedBills();
    } catch (error) {
      setText(manualMessage, error.message, "error");
    } finally {
      target.disabled = false;
    }
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showLogin();
});

api("/api/admin/me").then((result) => showAdmin(result.data)).catch(showLogin);
