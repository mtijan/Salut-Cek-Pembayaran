import React from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  CreditCard,
  Edit2,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-react';
import { formatRupiah } from '../../utils/currency';
import StatusBadge from '../common/StatusBadge';

export default function BillTableRow({ bill, copiedKey, canManage, actions, navigateTo }) {
  const amount = Number(bill.amount) || 0;
  const paid = Number(bill.paid_amount) || 0;
  const percentage = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;
  const isActive = bill.is_active === true || bill.is_active === 1;

  return (
    <tr className="table-row-modern">
      <td>
        <div className="flex-row-gap-8">
          <div className="table-avatar-badge">
            {(bill.student_name || bill.full_name || 'M').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            {bill.student_id && navigateTo ? (
              <button
                type="button"
                onClick={() => navigateTo('student-profile', { studentId: bill.student_id })}
                className="student-name-link"
                title="Buka Profil 360 Mahasiswa"
              >
                {bill.student_name || bill.full_name}
              </button>
            ) : (
              <strong className="student-name-cell">{bill.student_name || bill.full_name}</strong>
            )}
            <div className="student-meta-row">
              <span className="font-mono-600">{bill.student_nim || bill.nim}</span>
              {bill.study_program_name && <span>&bull; {bill.study_program_name}</span>}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="flex-column-gap-3">
          <span className="period-badge">{bill.period}</span>
          <span className="cell-prodi">{bill.bill_type || 'UKT'}</span>
          <span className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`}>
            {isActive ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      </td>
      <td>
        <div className="font-bold text-ink">
          {bill.amount_formatted || formatRupiah(bill.amount)}
        </div>
        {bill.status === 'partial' && (
          <div className="cell-xs mt-1">
            <div className="flex-between-gap-6">
              <span className="text-success font-semibold">
                Terbayar: {bill.paid_amount_formatted || formatRupiah(bill.paid_amount)}
              </span>
              <span className="text-warning font-semibold">
                Sisa: {bill.remaining_amount_formatted || formatRupiah(bill.remaining_amount)}
              </span>
            </div>
            <div className="micro-progress-wrap">
              <progress
                className="micro-progress-bar-semantic"
                value={percentage}
                max={100}
                aria-label={`Progres pelunasan ${percentage}%`}
              />
            </div>
          </div>
        )}
        {bill.status === 'paid' && (
          <div className="cell-xs text-success font-semibold mt-1">Lunas Penuh (100%)</div>
        )}
      </td>
      <td className="text-center">
        <StatusBadge
          tone={
            bill.status === 'paid' ? 'success' : bill.status === 'partial' ? 'warning' : 'danger'
          }
          className={
            canManage && bill.status !== 'paid' && navigateTo ? 'cursor-pointer' : 'cursor-default'
          }
          onClick={() =>
            canManage && bill.status !== 'paid' && navigateTo?.('bill-payment', { billId: bill.id })
          }
          title={canManage && bill.status !== 'paid' ? 'Klik untuk bayar di kasir' : undefined}
        >
          {bill.status === 'paid'
            ? 'Lunas'
            : bill.status === 'partial'
              ? 'Bayar Sebagian'
              : 'Belum Lunas'}
        </StatusBadge>
      </td>
      <td className="cell-notes text-muted">
        <div className="flex-row-gap-6">
          <Calendar size={13} className="text-muted" />
          <span>
            {bill.due_date_formatted || (bill.due_date ? String(bill.due_date).slice(0, 10) : '-')}
          </span>
        </div>
      </td>
      <td>
        <div className="flex-row-gap-6">
          <span className="mono-tag">{bill.briva}</span>
          {bill.briva && (
            <button
              type="button"
              onClick={() => actions.copy(bill.briva, `BRIVA ${bill.briva}`)}
              className="copy-btn-inline"
              title="Salin BRIVA"
            >
              {copiedKey === `BRIVA ${bill.briva}` ? (
                <Check size={14} className="text-success" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      </td>
      <td className="text-right whitespace-nowrap">
        <div className="table-action-cell">
          {canManage && isActive && (
            <button
              type="button"
              className="btn btn-primary btn-sm btn-action-pay"
              onClick={() => navigateTo?.('bill-payment', { billId: bill.id })}
              title="Buka Kasir Pembayaran Tagihan"
            >
              <CreditCard size={13} />
              <span>Bayar</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-action-icon"
            onClick={() => actions.openHistory(bill)}
            title="Lihat Riwayat Transaksi"
          >
            <Clock size={13} />
          </button>
          {canManage && (
            <>
              {isActive && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-action-icon"
                  onClick={() => navigateTo?.('bill-edit', { billId: bill.id })}
                  title="Edit Data Pokok Tagihan (Halaman Penuh)"
                >
                  <Edit2 size={13} />
                </button>
              )}
              <button
                type="button"
                className={`btn btn-sm btn-action-icon ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => actions.setActivationTarget(bill)}
                title={isActive ? 'Nonaktifkan Tagihan' : 'Aktifkan Kembali Tagihan'}
              >
                {isActive ? <PowerOff size={13} /> : <Power size={13} />}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm btn-action-icon"
                onClick={() => actions.setDeleteTarget(bill)}
                title="Hapus Tagihan"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

BillTableRow.displayName = 'BillTableRow';
