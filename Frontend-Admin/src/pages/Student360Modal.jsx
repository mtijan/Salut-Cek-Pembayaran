import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { studentsApi } from '../services/api';
import { useToast } from '../components/common/Toast';

export default function Student360Modal({ studentId, isOpen, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchDetail();
    } else {
      setData(null);
    }
  }, [isOpen, studentId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await studentsApi.getDetail(studentId);
      setData(res);
    } catch (err) {
      showToast(err.message || 'Gagal memuat profil mahasiswa.', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const st = data?.student;
  const sm = data?.summary;
  const bills = data?.bills || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: 'var(--brand-surface)', borderRadius: 'var(--radius-md)', color: 'var(--brand)' }}>
              <User size={22} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                Student Profile 360
              </p>
              <h2>{st?.full_name || 'Detail Mahasiswa'}</h2>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              <span>Memuat data profil 360...</span>
            </div>
          ) : (
            <>
              {/* Biodata Section */}
              <div className="bio-grid">
                <div className="bio-item">
                  <span>NIM</span>
                  <strong>{st?.nim}</strong>
                </div>
                <div className="bio-item">
                  <span>Program Studi</span>
                  <strong>{st?.study_program_name || st?.program_study || '-'}</strong>
                </div>
                <div className="bio-item">
                  <span>Status Akademik</span>
                  <div>
                    <span className={`badge ${st?.academic_status === 'aktif' ? 'badge-success' : st?.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}>
                      {st?.academic_status || 'aktif'}
                    </span>
                  </div>
                </div>
                <div className="bio-item">
                  <span>Tahun Angkatan</span>
                  <strong>{st?.entry_year || '-'}</strong>
                </div>
                <div className="bio-item">
                  <span>Nomor Handphone</span>
                  <strong>{st?.phone_number || '-'}</strong>
                </div>
                <div className="bio-item">
                  <span>Email</span>
                  <strong>{st?.email || '-'}</strong>
                </div>
                <div className="bio-item" style={{ gridColumn: '1 / -1' }}>
                  <span>Alamat</span>
                  <strong>{st?.address || '-'}</strong>
                </div>
              </div>

              {/* Financial Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div style={{ padding: 14, background: '#ffffff', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Total Tagihan</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-strong)', marginTop: 4 }}>
                    {sm?.total_amount_formatted || 'Rp 0'}
                  </div>
                </div>
                <div style={{ padding: 14, background: '#ffffff', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Sudah Terbayar</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
                    {sm?.total_paid_formatted || 'Rp 0'}
                  </div>
                </div>
                <div style={{ padding: 14, background: '#ffffff', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Sisa Tunggakan</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginTop: 4 }}>
                    {sm?.total_outstanding_formatted || 'Rp 0'}
                  </div>
                </div>
                <div style={{ padding: 14, background: '#ffffff', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Status Pelunasan</span>
                  <div style={{ marginTop: 6 }}>
                    <span className={`badge ${sm?.overall_status === 'paid' ? 'badge-success' : sm?.overall_status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                      {sm?.overall_status === 'paid' ? 'Lunas' : sm?.overall_status === 'partial' ? 'Sebagian' : 'Belum Lunas'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bills Table */}
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
                Riwayat Tagihan & Pembayaran
              </h3>
              {!bills.length ? (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>Belum ada tagihan terdaftar.</p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Periode</th>
                        <th>Jenis Tagihan</th>
                        <th>Nominal</th>
                        <th>Status</th>
                        <th>Batas Aktif</th>
                        <th>BRIVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b) => (
                        <tr key={b.id}>
                          <td>{b.period}</td>
                          <td>{b.bill_type}</td>
                          <td><strong>{b.amount_formatted}</strong></td>
                          <td>
                            <span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                              {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Cicilan' : 'Belum Lunas'}
                            </span>
                          </td>
                          <td>{b.due_date_formatted || '-'}</td>
                          <td><code style={{ fontFamily: 'var(--font-mono)' }}>{b.briva}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
