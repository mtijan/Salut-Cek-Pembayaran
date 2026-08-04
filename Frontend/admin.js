const loginCard = document.querySelector("#login-card");
const importCard = document.querySelector("#import-card");
const loginForm = document.querySelector("#login-form");
const importForm = document.querySelector("#import-form");
const loginMessage = document.querySelector("#login-message");
const importMessage = document.querySelector("#import-message");
const logoutButton = document.querySelector("#logout-button");
const adminEmail = document.querySelector("#admin-email");
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

let currentImportToken = "";
let currentPreview = null;

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
  commitButton.disabled = currentPreview.critical_rows > 0 || (currentPreview.requires_update_confirmation && !confirmUpdates.checked);
}

function showAdmin(user) {
  loginCard.classList.add("hidden");
  importCard.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
  adminEmail.textContent = user.email;
}

function showLogin() {
  loginCard.classList.remove("hidden");
  importCard.classList.add("hidden");
  logoutButton.classList.add("hidden");
  previewState.classList.add("hidden");
  currentImportToken = "";
  currentPreview = null;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json();
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
  }
});

confirmUpdates.addEventListener("change", refreshCommitState);

commitButton.addEventListener("click", async () => {
  if (!currentImportToken) return;
  commitButton.disabled = true;
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
    setText(importMessage, `Import selesai: ${result.data.created} baru, ${result.data.updated} diperbarui, ${result.data.unchanged} tidak berubah, ${result.data.issues} issue dicatat.`);
  } catch (error) {
    setText(importMessage, error.message, "error");
  } finally {
    refreshCommitState();
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showLogin();
});

api("/api/admin/me").then((result) => showAdmin(result.data)).catch(showLogin);
