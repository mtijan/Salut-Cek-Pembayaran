import React from 'react';
import { CreditCard, CheckCircle2, AlertCircle, Layers, Save } from 'lucide-react';
import PaymentTransactionFields from './PaymentTransactionFields';
import PaymentSettledState from './PaymentSettledState';
import { formatRupiah } from '../../utils/currency';

/**
 * Formulir input transaksi pembayaran baru.
 * Props: semua payment state, handlers, dan data kalkulasi.
 * Menampilkan paid-celebration-box bila tagihan sudah lunas.
 */
export default function PaymentForm({
  bill,
  remainingAmount,
  totalAmount,
  paymentMode,
  paymentAmount,
  setPaymentAmount,
  paymentDate,
  setPaymentDate,
  paymentMethod,
  setPaymentMethod,
  referenceNumber,
  setReferenceNumber,
  notes,
  setNotes,
  submitting,
  formError,
  numericPayment,
  newRemaining,
  willBePaid,
  handleModeChange,
  handleQuickAmount,
  handleSubmitPayment,
}) {
  return (
    <div className="panel-card payment-form-card">
      <div className="payment-form-header">
        <div className="flex-row-gap-8">
          <div className="icon-badge-brand">
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="payment-header-title">Formulir Pembayaran Tagihan</h3>
            <p className="payment-header-desc">
              Catat transaksi pembayaran baru secara bertahap (cicilan) atau pelunasan penuh
            </p>
          </div>
        </div>
      </div>

      {remainingAmount <= 0 || bill.status === 'paid' ? (
        <PaymentSettledState totalAmount={totalAmount} />
      ) : (
        <form onSubmit={handleSubmitPayment} className="payment-form-body">
          {formError && (
            <div className="alert-box alert-danger modal-alert-danger">
              <AlertCircle size={17} />
              <span>{formError}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="payment-mode-switcher">
            <button
              type="button"
              className={`mode-btn ${paymentMode === 'full' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('full')}
            >
              <CheckCircle2 size={16} />
              <div>
                <div className="mode-title">Pelunasan Penuh (Lunas)</div>
                <div className="mode-sub">Bayar seluruh sisa {formatRupiah(remainingAmount)}</div>
              </div>
            </button>

            <button
              type="button"
              className={`mode-btn ${paymentMode === 'partial' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('partial')}
            >
              <Layers size={16} />
              <div>
                <div className="mode-title">Bayar Sebagian (Cicilan)</div>
                <div className="mode-sub">Masukkan nominal pembayaran bertahap</div>
              </div>
            </button>
          </div>

          {/* Nominal Input */}
          <div className="form-group mt-3">
            <label className="payment-nominal-label">
              <span>
                Nominal Pembayaran Transaksi Ini (Rp) <span className="text-danger">*</span>
              </span>
              <span className="text-emerald font-semibold">
                Sisa Saat Ini: {formatRupiah(remainingAmount)}
              </span>
            </label>
            <div className="currency-input-wrap">
              <span className="currency-prefix">Rp</span>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  if (Number(e.target.value) === remainingAmount) {
                    handleModeChange('full');
                  } else {
                    handleModeChange('partial');
                  }
                }}
                className="currency-input"
                placeholder="0"
                min={1}
                max={remainingAmount}
                required
              />
            </div>

            {/* Quick Chips */}
            <div className="quick-chips-row">
              <span className="chips-label">Pilihan Cepat:</span>
              <button type="button" className="chip-btn" onClick={() => handleModeChange('full')}>
                Sisa Penuh ({formatRupiah(remainingAmount)})
              </button>
              {remainingAmount > 1000000 && (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => handleQuickAmount(1000000)}
                >
                  Rp 1.000.000
                </button>
              )}
              {remainingAmount > 500000 && (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => handleQuickAmount(500000)}
                >
                  Rp 500.000
                </button>
              )}
              {remainingAmount > 250000 && (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => handleQuickAmount(250000)}
                >
                  Rp 250.000
                </button>
              )}
            </div>
          </div>

          {/* Live Calculation */}
          <div className="live-calc-box">
            <div className="calc-item">
              <span className="calc-label">Sisa Sebelumnya:</span>
              <span className="calc-val">{formatRupiah(remainingAmount)}</span>
            </div>
            <div className="calc-sep">-</div>
            <div className="calc-item">
              <span className="calc-label">Bayar Sekarang:</span>
              <span className="calc-val text-emerald font-bold">
                {formatRupiah(numericPayment)}
              </span>
            </div>
            <div className="calc-sep">=</div>
            <div className="calc-item">
              <span className="calc-label">Sisa Tagihan Baru:</span>
              <span
                className={`calc-val font-bold ${newRemaining > 0 ? 'text-danger' : 'text-success'}`}
              >
                {formatRupiah(newRemaining)}
              </span>
            </div>
            <div className="calc-status-badge">
              <span className={`badge ${willBePaid ? 'badge-success' : 'badge-warning'}`}>
                {willBePaid ? 'AKAN LUNAS (PAID)' : 'SEBAGIAN (PARTIAL)'}
              </span>
            </div>
          </div>

          <PaymentTransactionFields
            paymentDate={paymentDate}
            setPaymentDate={setPaymentDate}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            referenceNumber={referenceNumber}
            setReferenceNumber={setReferenceNumber}
            notes={notes}
            setNotes={setNotes}
          />

          <div className="form-actions-bar mt-3">
            <button
              type="submit"
              className="btn btn-primary btn-large btn-submit-payment"
              disabled={submitting || numericPayment <= 0 || numericPayment > remainingAmount}
            >
              {submitting ? (
                <>
                  <div className="spinner-sm" />
                  <span>Memproses Transaksi Pembayaran...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>
                    Simpan &amp; Catat Transaksi Pembayaran ({formatRupiah(numericPayment)})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

PaymentForm.displayName = 'PaymentForm';
