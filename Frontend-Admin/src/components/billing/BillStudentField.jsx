import React from 'react';
import { User, Lock } from 'lucide-react';

export default function BillStudentField({
  isCreate,
  formData,
  handleStudentSelect,
  students = [],
  loadedStudent,
}) {
  const studentData = loadedStudent || {};

  return (
    <div className="bill-field-full-col">
      <label className="bill-field-label">
        <User size={14} className="field-label-icon" />
        <span>Mahasiswa Terkait</span>
        <span className="bill-req-star">*</span>
      </label>
      {isCreate ? (
        <select
          className="form-control bill-student-select"
          value={formData.student_id}
          onChange={handleStudentSelect}
          required
        >
          <option value="">-- Pilih Mahasiswa Penerima Tagihan --</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nim} - {s.full_name} ({s.study_program_name || 'Umum'})
            </option>
          ))}
        </select>
      ) : (
        <div className="bill-readonly-card">
          <div className="bill-readonly-left">
            <div className="bill-readonly-avatar">
              {(studentData.full_name || formData.full_name || 'M').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="readonly-student-name">
                {studentData.full_name || formData.full_name || 'Nama Mahasiswa'}
              </div>
              <div className="readonly-student-meta">
                <span>NIM: <strong className="font-mono">{studentData.nim || formData.nim || '-'}</strong></span>
                <span className="crumb-sep">•</span>
                <span>{studentData.study_program_name || 'Program Studi'}</span>
              </div>
            </div>
          </div>
          <div className="bill-readonly-badge">
            <Lock size={12} />
            <span>Terkunci (Read-Only)</span>
          </div>
        </div>
      )}
    </div>
  );
}

BillStudentField.displayName = 'BillStudentField';
