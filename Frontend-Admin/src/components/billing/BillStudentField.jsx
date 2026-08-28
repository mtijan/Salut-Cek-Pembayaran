import React from 'react';

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
        Mahasiswa Terkait <span className="bill-req-star">*</span>
      </label>
      {isCreate ? (
        <select
          className="form-control"
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
          <div>
            <div className="readonly-student-name">
              {studentData.full_name || formData.full_name}
            </div>
            <div className="readonly-student-meta">
              NIM: <span className="font-mono-600">{studentData.nim || formData.nim}</span> &bull;{' '}
              {studentData.study_program_name || 'Program Studi'}
            </div>
          </div>
          <span className="bill-readonly-badge">Terkunci (Read-Only)</span>
        </div>
      )}
    </div>
  );
}

BillStudentField.displayName = 'BillStudentField';
