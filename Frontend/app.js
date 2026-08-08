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

function renderResult(data) {
  emptyState.classList.add("hidden");
  resultState.classList.remove("hidden");
  studentNim.textContent = data.student.nim || "-";
  studentName.textContent = data.student.full_name || "-";
  studentProgram.textContent = data.student.program_study || "-";
  paymentPeriod.textContent = data.student.payment_period || "-";

  const bills = data.bills || [];
  billList.replaceChildren();

  for (const bill of bills) {
    const item = billTemplate.content.cloneNode(true);
    item.querySelector(".amount").textContent = bill.amount_formatted;
    item.querySelector(".briva").textContent = bill.briva;
    item.querySelector(".account-name").textContent = data.student.full_name || "-";

    const statusText = item.querySelector(".bill-status-text");
    statusText.textContent = bill.status === "paid" ? "Lunas" : "Belum lunas";
    statusText.classList.toggle("is-paid", bill.status === "paid");
    statusText.classList.toggle("is-unpaid", bill.status !== "paid");

    const copyButton = item.querySelector(".copy-button");
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(bill.briva);
      setMessage("Nomor VA disalin.");
    });

    billList.appendChild(item);
  }
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
