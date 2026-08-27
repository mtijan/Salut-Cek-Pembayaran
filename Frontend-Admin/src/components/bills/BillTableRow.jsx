import React from 'react';
import { Calendar, Check, Clock, Copy, CreditCard, Edit2, Trash2 } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';
import StatusBadge from '../common/StatusBadge';

export default function BillTableRow({ bill, copiedKey, canManage, actions, navigateTo }) {
  const amount = Number(bill.amount) || 0;
  const paid = Number(bill.paid_amount) || 0;
  const percentage = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;
  return (
    <tr className="table-row-modern">
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-surface)',
              color: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(bill.student_name || bill.full_name || 'M').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            {bill.student_id && navigateTo ? (
              <button
                type="button"
                onClick={() => navigateTo('student-profile', { studentId: bill.student_id })}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: 'var(--brand-strong)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title="Buka Profil 360 Mahasiswa"
              >
                {bill.student_name || bill.full_name}
              </button>
            ) : (
              <strong style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                {bill.student_name || bill.full_name}
              </strong>
            )}
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--muted)',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {bill.student_nim || bill.nim}
              </span>
              {bill.study_program_name && <span>&bull; {bill.study_program_name}</span>}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              display: 'inline-block',
              width: 'fit-content',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #e2e8f0',
            }}
          >
            {bill.period}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            {bill.bill_type || 'UKT'}
          </span>
        </div>
      </td>
      <td>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>
          {bill.amount_formatted || formatRupiah(bill.amount)}
        </div>
        {bill.status === 'partial' && (
          <div style={{ fontSize: 11, marginTop: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                Terbayar: {bill.paid_amount_formatted || formatRupiah(bill.paid_amount)}
              </span>
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                Sisa: {bill.remaining_amount_formatted || formatRupiah(bill.remaining_amount)}
              </span>
            </div>
            <div className="micro-progress-wrap">
              <div
                className="micro-progress-bar"
                style={{ width: `${percentage}%`, background: 'var(--warning)' }}
              />
            </div>
          </div>
        )}
        {bill.status === 'paid' && (
          <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>
            Lunas Penuh (100%)
          </div>
        )}
      </td>
      <td style={{ textAlign: 'center' }}>
        <StatusBadge
          tone={
            bill.status === 'paid' ? 'success' : bill.status === 'partial' ? 'warning' : 'danger'
          }
          style={{
            cursor: canManage && bill.status !== 'paid' && navigateTo ? 'pointer' : 'default',
          }}
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
      <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={13} style={{ color: 'var(--muted-light)' }} />
          <span>
            {bill.due_date_formatted || (bill.due_date ? String(bill.due_date).slice(0, 10) : '-')}
          </span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="mono-tag">{bill.briva}</span>
          {bill.briva && (
            <button
              type="button"
              onClick={() => actions.copy(bill.briva, `BRIVA ${bill.briva}`)}
              style={{
                background: 'none',
                border: 'none',
                padding: 3,
                cursor: 'pointer',
                color: 'var(--muted)',
              }}
              title="Salin BRIVA"
            >
              {copiedKey === `BRIVA ${bill.briva}` ? (
                <Check size={14} style={{ color: 'var(--success)' }} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
          }}
        >
          {canManage && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ height: 30, padding: '0 8px', gap: 4 }}
              onClick={() => navigateTo?.('bill-payment', { billId: bill.id })}
              title="Buka Kasir Pembayaran Tagihan"
            >
              <CreditCard size={13} />
              <span>Bayar</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ height: 30, width: 30, padding: 0 }}
            onClick={() => actions.openHistory(bill)}
            title="Lihat Riwayat Transaksi"
          >
            <Clock size={13} />
          </button>
          {canManage && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: 30, width: 30, padding: 0 }}
                onClick={() => navigateTo?.('bill-edit', { billId: bill.id })}
                title="Edit Data Pokok Tagihan (Halaman Penuh)"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ height: 30, width: 30, padding: 0 }}
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
