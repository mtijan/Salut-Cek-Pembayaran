import React from 'react';
import { Check, Copy, CreditCard, User } from 'lucide-react';

function CopyButton({ copiedKey, copyKey, onCopy, title, value, size = 13 }) {
  if (!value) return null;
  return (
    <button
      type="button"
      className="copy-btn-inline"
      onClick={() => onCopy(value, copyKey)}
      title={title}
    >
      {copiedKey === copyKey ? (
        <Check size={size} className="text-success" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  );
}

export function ProfileTab({ bills, canManageBilling, copiedKey, navigateTo, onCopy, student }) {
  const statusClass =
    student.academic_status === 'aktif'
      ? 'badge-success'
      : student.academic_status === 'cuti'
        ? 'badge-warning'
        : 'badge-danger';

  return (
    <div className="profile-tab-pane">
      <div className="profile-section-block">
        <div className="profile-section-heading">
          <User size={17} className="text-brand" />
          <span>Informasi Data Utama Mahasiswa</span>
        </div>
        <div className="profile-kv-grid">
          <div className="kv-item">
            <span className="kv-label">ID Pelanggan / NIM</span>
            <div className="kv-value-wrap">
              <strong className="mono-font">{student.nim || '-'}</strong>
              <CopyButton
                copiedKey={copiedKey}
                copyKey="NIM"
                onCopy={onCopy}
                title="Salin NIM"
                value={student.nim}
              />
            </div>
          </div>
          <div className="kv-item">
            <span className="kv-label">Nama Lengkap</span>
            <strong className="kv-value">{student.full_name || '-'}</strong>
          </div>
          <div className="kv-item">
            <span className="kv-label">Jenis Pelanggan</span>
            <span className="kv-value">Individual (Mahasiswa SALUT)</span>
          </div>
          <div className="kv-item">
            <span className="kv-label">PIC / Kontak Mahasiswa</span>
            <span className="kv-value">{student.full_name || '-'}</span>
          </div>
          <div className="kv-item">
            <span className="kv-label">No. KTP / NIK</span>
            <div className="kv-value-wrap">
              <strong className="mono-font">{student.no_ktp || '-'}</strong>
              <CopyButton
                copiedKey={copiedKey}
                copyKey="No KTP"
                onCopy={onCopy}
                title="Salin No KTP"
                value={student.no_ktp}
              />
            </div>
          </div>
          <div className="kv-item">
            <span className="kv-label">Tempat &amp; Tanggal Lahir</span>
            <span className="kv-value">
              {student.tempat_lahir || '-'}, {student.tanggal_lahir || '-'}
            </span>
          </div>
          <div className="kv-item">
            <span className="kv-label">Nama Ibu Kandung</span>
            <span className="kv-value">{student.nama_ibu_kandung || '-'}</span>
          </div>
          <div className="kv-item">
            <span className="kv-label">Program Studi</span>
            <strong className="kv-value text-brand">
              {student.study_program_name || student.program_study || '-'}
            </strong>
          </div>
          <div className="kv-item">
            <span className="kv-label">No. Handphone / WhatsApp</span>
            <div className="kv-value-wrap">
              <span className="kv-value">{student.phone_number || '-'}</span>
              <CopyButton
                copiedKey={copiedKey}
                copyKey="No HP"
                onCopy={onCopy}
                title="Salin No HP"
                value={student.phone_number}
              />
            </div>
          </div>
          <div className="kv-item">
            <span className="kv-label">Email</span>
            <span className="kv-value">{student.email || '-'}</span>
          </div>
          <div className="kv-item">
            <span className="kv-label">Periode Masuk / Semester</span>
            <span className="kv-value">
              {student.entry_period_formatted ||
                student.entry_period ||
                (student.entry_year
                  ? `${student.entry_year}.${student.entry_semester === 'genap' ? '2' : '1'}`
                  : '-')}
            </span>
          </div>
          <div className="kv-item">
            <span className="kv-label">Status Akademik</span>
            <span className="kv-value">
              <span className={`badge ${statusClass}`}>
                {student.academic_status ? student.academic_status.toUpperCase() : 'AKTIF'}
              </span>
            </span>
          </div>
          <div className="kv-item form-group-full">
            <span className="kv-label">Alamat Lengkap</span>
            <span className="kv-value">{student.address || '-'}</span>
          </div>
          {student.initial_registration && (
            <div className="kv-item form-group-full">
              <span className="kv-label">Registrasi Awal</span>
              <span className="kv-value mono-font">{student.initial_registration}</span>
            </div>
          )}
        </div>
      </div>

      <div className="profile-section-block mt-3">
        <div className="profile-section-heading">
          <CreditCard size={17} className="text-brand" />
          <span>Grup &amp; BRIVA Terdaftar</span>
        </div>
        {bills.length === 0 ? (
          <p className="empty-state-desc">
            Belum ada nomor BRIVA yang terdaftar untuk mahasiswa ini.
          </p>
        ) : (
          <div className="briva-groups-list">
            {bills.map((bill) => {
              const copyKey = `BRIVA ${bill.briva}`;
              return (
                <div key={bill.id} className="briva-group-card">
                  <div className="briva-group-left">
                    <div className="briva-group-title">
                      UNIVERSITAS TERBUKA {bill.period || '2023.2'}
                    </div>
                    <div className="briva-group-sub">
                      <span>
                        Jenis: <strong>{bill.bill_type}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Nominal: <strong>{bill.amount_formatted}</strong>
                      </span>
                      {bill.due_date_formatted && (
                        <>
                          <span>&bull;</span>
                          <span>
                            Jatuh Tempo: <strong>{bill.due_date_formatted}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="briva-group-right">
                    <div className="briva-number-box">
                      <span className="briva-num-val">{bill.briva || '-'}</span>
                      <CopyButton
                        copiedKey={copiedKey}
                        copyKey={copyKey}
                        onCopy={onCopy}
                        title="Salin BRIVA"
                        value={bill.briva}
                        size={12}
                      />
                    </div>
                    {canManageBilling && (
                      <button
                        type="button"
                        className="btn btn-sm btn-brand"
                        onClick={() => navigateTo('bill-payment', { billId: bill.id })}
                        title="Catat Pembayaran Tagihan Ini"
                      >
                        <CreditCard size={13} />
                        <span>Bayar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

ProfileTab.displayName = 'ProfileTab';
