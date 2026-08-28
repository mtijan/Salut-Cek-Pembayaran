import React from 'react';
import { BookOpen, Check, Clock, Copy, User } from 'lucide-react';

function CopyValue({ copiedKey, copyKey, onCopy, value }) {
  if (!value) return null;
  return (
    <button
      type="button"
      className="copy-btn-inline"
      onClick={() => onCopy(value, copyKey)}
      title={`Salin ${copyKey}`}
    >
      {copiedKey === copyKey ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  );
}

function Section({ children, Icon, title, last = false }) {
  return (
    <div className={`form-section-card ${last ? 'form-section-card-last' : ''}`}>
      <div className="form-section-title">
        <Icon size={15} />
        <span>{title}</span>
      </div>
      <div className="bio-grid bio-grid-card">{children}</div>
    </div>
  );
}

export function Student360Bio({ copiedKey, onCopy, student }) {
  const statusClass =
    student?.academic_status === 'aktif'
      ? 'badge-success'
      : student?.academic_status === 'cuti'
        ? 'badge-warning'
        : 'badge-danger';
  return (
    <div>
      <Section Icon={User} title="Identitas Kependudukan">
        <div className="bio-item">
          <span>No KTP / NIK</span>
          <div className="flex-row-center">
            <strong>{student?.no_ktp || '-'}</strong>
            <CopyValue
              copiedKey={copiedKey}
              copyKey="No KTP"
              onCopy={onCopy}
              value={student?.no_ktp}
            />
          </div>
        </div>
        <div className="bio-item">
          <span>Tempat Lahir</span>
          <strong>{student?.tempat_lahir || '-'}</strong>
        </div>
        <div className="bio-item">
          <span>Tanggal Lahir</span>
          <strong>{student?.tanggal_lahir || '-'}</strong>
        </div>
        <div className="bio-item">
          <span>Nama Ibu Kandung</span>
          <strong>{student?.nama_ibu_kandung || '-'}</strong>
        </div>
      </Section>
      <Section Icon={BookOpen} title="Informasi Akademik &amp; Periode">
        <div className="bio-item">
          <span>Program Studi</span>
          <strong>{student?.study_program_name || student?.program_study || '-'}</strong>
        </div>
        <div className="bio-item">
          <span>Status Akademik</span>
          <div>
            <span className={`badge ${statusClass}`}>{student?.academic_status || 'aktif'}</span>
          </div>
        </div>
        <div className="bio-item">
          <span>Periode Masuk</span>
          <strong>
            {student?.entry_period_formatted ||
              (student?.entry_period
                ? `${student.entry_period} (Angkatan ${student.entry_year})`
                : '-')}
          </strong>
        </div>
        <div className="bio-item">
          <span>Registrasi Awal</span>
          <strong>{student?.initial_registration || '-'}</strong>
        </div>
      </Section>
      <Section Icon={Clock} title="Kontak &amp; Domisili" last>
        <div className="bio-item">
          <span>Nomor HP / WhatsApp</span>
          <div className="flex-row-center">
            <strong>{student?.phone_number || '-'}</strong>
            <CopyValue
              copiedKey={copiedKey}
              copyKey="Nomor HP"
              onCopy={onCopy}
              value={student?.phone_number}
            />
          </div>
        </div>
        <div className="bio-item">
          <span>Alamat Email</span>
          <strong>{student?.email || '-'}</strong>
        </div>
        <div className="bio-item form-group-full">
          <span>Alamat Lengkap</span>
          <strong>{student?.address || '-'}</strong>
        </div>
      </Section>
    </div>
  );
}

Student360Bio.displayName = 'Student360Bio';
