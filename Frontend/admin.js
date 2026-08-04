const loginCard = document.querySelector("#login-card");
const importCard = document.querySelector("#import-card");
const billsCard = document.querySelector("#bills-card");
const loginForm = document.querySelector("#login-form");
const importForm = document.querySelector("#import-form");
const loginMessage = document.querySelector("#login-message");
const importMessage = document.querySelector("#import-message");
const billsMessage = document.querySelector("#bills-message");
const logoutButton = document.querySelector("#logout-button");
const adminEmail = document.querySelector("#admin-email");
const fileInput = document.querySelector("#excel-file");
const previewButton = importForm.querySelector("button[type='submit']");
const refreshBillsButton = document.querySelector("#refresh-bills-button");
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

let currentImportToken = "";
let currentPreview = null;
let isCommitting = false;
let isUploading = false;

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
  billsCard.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  adminEmail.textContent = user.email;
  loadImportedBills();
}

function showLogin() {
  loginCard.classList.remove("hidden");
  importCard.classList.add("hidden");
  billsCard.classList.add("hidden");
  logoutButton.classList.add("hidden");
  previewState.classList.add("hidden");
  currentImportToken = "";
  currentPreview = null;
  isCommitting = false;
  isUploading = false;
  previewButton.disabled = false;
  billsState.replaceChildren();
  setText(billsMessage, "");
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
        <tr><th>NIM</th><th>Nama</th><th>BRIVA</th><th>Jumlah</th></tr>
      </thead>
      <tbody>
        ${data.sample
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.nim)}</td><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.briva)}</td><td>${rupiah(row.amount)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;

  if (data.errors.length === 0) {
    errorList.innerHTML = `<p class="muted">Tidak ada issue pada preview.</p>`;
  } else {
    errorList.innerHTML = data.errors
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
    setText(importMessage, `Import selesai: ${result.data.created} baru, ${result.data.updated} diperbarui, ${result.data.unchanged} tidak berubah, ${result.data.issues} issue dicatat.`);
    loadImportedBills();
  } catch (error) {
    setText(importMessage, error.message, "error");
  } finally {
    isCommitting = false;
    previewButton.disabled = false;
    refreshCommitState();
  }
});

refreshBillsButton.addEventListener("click", loadImportedBills);

billsState.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("status-toggle")) {
    return;
  }

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
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showLogin();
});

api("/api/admin/me").then((result) => showAdmin(result.data)).catch(showLogin);
