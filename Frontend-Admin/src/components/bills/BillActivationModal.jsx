import React from 'react';
import { Power, X } from 'lucide-react';
import BillActivationForm from './BillActivationForm';

export default function BillActivationModal({ isOpen, onClose, onApplied, targetBill = null }) {
  if (!isOpen || !targetBill) return null;

  const desiredLabel = targetBill.is_active === false ? 'Aktifkan' : 'Nonaktifkan';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activation-modal-title"
      >
        <div className="modal-header">
          <div className="confirm-modal-header-left">
            <div className="confirm-modal-header-icon">
              <Power size={20} />
            </div>
            <h2 id="activation-modal-title">{desiredLabel} Tagihan</h2>
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
