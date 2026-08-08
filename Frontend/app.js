const form = document.querySelector("#lookup-form");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const emptyState = document.querySelector("#empty-state");
const resultState = document.querySelector("#result-state");
const studentNim = document.querySelector("#student-nim");
const studentName = document.querySelector("#student-name");
const studentProgram = document.querySelector("#student-program");
const paymentPeriod = document.querySelector("#payment-period");
const billList = document.querySelector("#bill-list");
const billTemplate = document.querySelector("#bill-template");

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `form-message ${type}`.trim();
}

function showEmpty() {
  emptyState.classList.remove("hidden");
  resultState.classList.add("hidden");
  billList.replaceChildren();
}

function rupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function setStatusPill(node, status) {
  node.textContent = status === "paid" ? "Lunas" : "Belum lunas";
  node.classList.toggle("is-paid", status === "paid");
  node.classList.toggle("is-unpaid", status !== "paid");
}

function renderResult(data) {
  emptyState.classList.add("hidden");
  resultState.classList.remove("hidden");
  studentNim.textContent = data.student.nim || "-";
  studentName.textContent = data.student.full_name || "-";
  studentProgram.textContent = data.student.program_study || "-";
  paymentPeriod.textContent = data.student.payment_period || "-";

  const bills = data.bills || [];
  billList.replaceChildren();

  const item = billTemplate.content.cloneNode(true);
  const amountLines = item.querySelector(".amount-lines");
  const vaList = item.querySelector(".va-list");
  const total = bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const hasUnpaidBill = bills.some((bill) => bill.status === "unpaid");
  const totalStatus = item.querySelector(".total-status");

  item.querySelector(".bill-section-title").textContent = bills.length > 1 ? "Informasi Tagihan" : "Informasi Tagihan";
  item.querySelector(".total-amount").textContent = rupiah(total);
  setStatusPill(totalStatus, hasUnpaidBill ? "unpaid" : "paid");
  item.querySelector(".account-name").textContent = data.student.full_name || "-";

  for (const [index, bill] of bills.entries()) {
    const amountRow = document.createElement("div");
    amountRow.className = "amount-line";

    const amountLabel = document.createElement("span");
    amountLabel.className = "amount-label";
    amountLabel.textContent = bills.length > 1 ? bill.bill_label || `Tagihan ${index + 1}` : "Jumlah Tagihan";

    const amountValue = document.createElement("strong");
    amountValue.className = "amount-value";
    amountValue.textContent = bill.amount_formatted || rupiah(bill.amount);

    const statusText = document.createElement("span");
    statusText.className = "bill-status-text status-pill";
    setStatusPill(statusText, bill.status);

    amountRow.append(amountLabel, amountValue, statusText);
    amountLines.appendChild(amountRow);

    const vaRow = document.createElement("div");
    vaRow.className = "va-item";

    const vaInfo = document.createElement("div");
    const vaLabel = document.createElement("p");
    vaLabel.className = "label-small";
    vaLabel.textContent = bills.length > 1 ? bill.bill_label || `Tagihan ${index + 1}` : "Nomor VA";
    const vaNumber = document.createElement("p");
    vaNumber.className = "briva";
    vaNumber.textContent = bill.briva || "-";
    vaInfo.append(vaLabel, vaNumber);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.title = "Salin nomor VA";
    copyButton.setAttribute("aria-label", `Salin nomor VA ${vaLabel.textContent}`);
    copyButton.textContent = "Salin";
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(bill.briva);
      setMessage("Nomor VA disalin.");
    });

    vaRow.append(vaInfo, copyButton);
    vaList.appendChild(vaRow);
  }

  billList.appendChild(item);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {
    nim: String(formData.get("nim") || "").trim(),
  };

  submitButton.disabled = true;
  setMessage("Mengecek data...");

  try {
    const response = await fetch("/api/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      showEmpty();
      setMessage(result.error?.message || "Data tagihan tidak ditemukan.", "error");
      return;
    }

    renderResult(result.data);
    setMessage("Data tagihan ditemukan.");
  } catch (error) {
    showEmpty();
    setMessage("Server belum berjalan atau koneksi bermasalah.", "error");
  } finally {
    submitButton.disabled = false;
  }
});
