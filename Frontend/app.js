const form = document.querySelector("#lookup-form");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const emptyState = document.querySelector("#empty-state");
const resultState = document.querySelector("#result-state");
const studentNim = document.querySelector("#student-nim");
const studentName = document.querySelector("#student-name");
const studentProgram = document.querySelector("#student-program");
const paymentStatus = document.querySelector("#payment-status");
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
  const labels = { paid: "Lunas", partial: "Bayar sebagian", unpaid: "Belum lunas" };
  node.textContent = labels[status] || labels.unpaid;
  node.classList.toggle("is-paid", status === "paid");
  node.classList.toggle("is-partial", status === "partial");
  node.classList.toggle("is-unpaid", status === "unpaid");
}

function renderResult(data) {
  emptyState.classList.add("hidden");
  resultState.classList.remove("hidden");
  studentNim.textContent = data.student.nim || "-";
  studentName.textContent = data.student.full_name || "-";
  studentProgram.textContent = data.student.program_study || "-";

  const bills = data.bills || [];
  billList.replaceChildren();

  const item = billTemplate.content.cloneNode(true);
  const amountLines = item.querySelector(".amount-lines");
  const vaList = item.querySelector(".va-list");
  const total = bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const hasPartialBill = bills.some((bill) => bill.status === "partial");
  const hasUnpaidBill = bills.some((bill) => bill.status === "unpaid");
  const paymentStatusValue = bills.length > 0 && !hasPartialBill && !hasUnpaidBill ? "paid" : hasPartialBill ? "partial" : "unpaid";

  item.querySelector(".bill-section-title").textContent = bills.length > 1 ? "Informasi Tagihan" : "Informasi Tagihan";
  item.querySelector(".payment-period-inline").textContent = data.student.payment_period || "-";
  item.querySelector(".total-amount").textContent = rupiah(total);

  const dueDateBox = item.querySelector(".due-date-box");
  const dueDateValue = item.querySelector(".due-date-value");
  if (dueDateBox && dueDateValue) {
    if (data.student.due_date_formatted) {
      dueDateValue.textContent = data.student.due_date_formatted;
      dueDateBox.classList.remove("hidden");
    } else {
      dueDateBox.classList.add("hidden");
    }
  }

  setStatusPill(paymentStatus, paymentStatusValue);
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

    amountRow.append(amountLabel, amountValue);
    amountLines.appendChild(amountRow);

    const vaRow = document.createElement("div");
    vaRow.className = "va-item";

    const vaInfo = document.createElement("div");
    const vaLabel = document.createElement("p");
    vaLabel.className = "label-small";
    vaLabel.textContent = bills.length > 1 ? bill.bill_label || `Tagihan ${index + 1}` : "Nomor BRIVA";
    const vaNumber = document.createElement("p");
    vaNumber.className = "briva";
    vaNumber.textContent = bill.briva || "-";
    vaInfo.append(vaLabel, vaNumber);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.title = "Salin nomor BRIVA";
    copyButton.setAttribute("aria-label", `Salin nomor BRIVA ${vaLabel.textContent}`);
    copyButton.textContent = "Salin";
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(bill.briva);
      setMessage("Nomor BRIVA disalin.");
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
