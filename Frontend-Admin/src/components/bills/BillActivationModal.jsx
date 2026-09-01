import React from 'react';
import { Power, PowerOff, X } from 'lucide-react';
import BillActivationForm from './BillActivationForm';

export default function BillActivationModal({ isOpen, onClose, onApplied, targetBill = null }) {
  if (!isOpen || !targetBill) return null;

  const isCurrentlyActive = targetBill.is_active === true || targetBill.is_active === 1;
  const desiredLabel = isCurrentlyActive ? 'Nonaktifkan' : 'Aktifkan Kembali';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog modal-dialog-md"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activation-modal-title"
      >
        <div className="modal-header">
          <div className="confirm-modal-header-left">
            <div
              className={`confirm-modal-header-icon ${isCurrentlyActive ? 'header-icon-danger' : 'header-icon-brand'}`}
            >
              {isCurrentlyActive ? <PowerOff size={20} /> : <Power size={20} />}
            </div>
            <div>
              <h2 id="activation-modal-title">{desiredLabel} Tagihan</h2>
              <span className="modal-header-subtitle">
                {isCurrentlyActive
                  ? 'Menonaktifkan tagihan operasional'
                  : 'Mengaktifkan kembali tagihan'}
              </span>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <BillActivationForm targetBill={targetBill} onApplied={onApplied} onCancel={onClose} />
      </div>
    </div>
  );
}

BillActivationModal.displayName = 'BillActivationModal';
