import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle2, AlertCircle, Clock, Copy, CreditCard, BookOpen, Check } from 'lucide-react';
import { studentsApi } from '../services/api';
import { useToast } from '../components/common/Toast';

export default function Student360Modal({ studentId, isOpen, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('bio');
  const [copiedKey, setCopiedKey] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      setActiveTab('bio');
      setHistoryData(null);
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

  const fetchPaymentHistory = async (offset = 0) => {
    setHistoryLoading(true);
    try {
      const result = await studentsApi.getTransactions(studentId, { limit: 50, offset });
      setHistoryData(result);
    } catch (err) {
      showToast(err.message || 'Gagal memuat riwayat pembayaran.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && studentId && activeTab === 'history') fetchPaymentHistory(0);
  }, [activeTab, isOpen, studentId]);

  const handleCopy = (text, keyName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast(`${keyName} berhasil disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  const st = data?.student;
  const sm = data?.summary;
  const bills = data?.bills || [];
  const paymentHistory = historyData?.transactions || data?.payment_history || [];
  const historyPagination = historyData?.pagination || data?.payment_history_pagination || { total: paymentHistory.length, limit: 50, offset: 0 };

  const totalAmount = Number(sm?.total_amount || 0);
  const totalPaid = Number(sm?.total_paid || 0);
  const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ overflow: 'hidden', padding: 0 }}
      >
        {/* Hero Header Banner */}
        <div className="modal-hero-banner">
          <div className="modal-hero-left">
            <div className="modal-hero-meta">
              <h2>{st?.full_name || 'Detail Mahasiswa'}</h2>
              <p>
                <span>NIM: <strong>{st?.nim || '-'}</strong></span>
                {st?.nim && (
                  <button
                    type="button"
                    className="copy-btn-inline"
                    onClick={() => handleCopy(st.nim, 'NIM')}
                    title="Salin NIM"
                    style={{ color: '#dcfce7' }}
                  >
                    {copiedKey === 'NIM' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
                <span style={{ opacity: 0.5 }}>•</span>
                <span>{st?.study_program_name || st?.program_study || '-'}</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${st?.academic_status === 'aktif' ? 'badge-success' : st?.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 12, padding: '4px 10px' }}>
              {st?.academic_status || 'aktif'}
            </span>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Tutup"
              style={{ color: '#ffffff', background: 'rgba(255,255,255,0.15)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs-header">
          <button
            type="button"
            className={`modal-tab-button ${activeTab === 'bio' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('bio')}
          >
            <BookOpen size={16} />
            <span>Biodata & Akademik</span>
          </button>
          <button
            type="button"
            className={`modal-tab-button ${activeTab === 'financial' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('financial')}
          >
            <CreditCard size={16} />
            <span>Tagihan & BRIVA ({bills.length})</span>
          </button>
          <button
            type="button"
            className={`modal-tab-button ${activeTab === 'history' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} />
            <span>Riwayat Pembayaran ({paymentHistory.length})</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="modal-body" style={{ maxHeight: 'calc(80vh - 170px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="skeleton-box skeleton-row" style={{ width: '100%', marginBottom: 12 }} />
              <div className="skeleton-box skeleton-row" style={{ width: '80%', marginBottom: 12 }} />
              <div className="skeleton-box skeleton-row" style={{ width: '60%' }} />
            </div>
          ) : (
            <>
              {/* Tab 1: Biodata & Akademik */}
              {activeTab === 'bio' && (
                <div>
                  <div className="form-section-card">
                    <div className="form-section-title">
                      <User size={15} />
                      <span>Identitas Kependudukan</span>
                    </div>
                    <div className="bio-grid" style={{ background: '#ffffff', marginBottom: 0, padding: 12 }}>
                      <div className="bio-item">
                        <span>No KTP / NIK</span>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <strong>{st?.no_ktp || '-'}</strong>
                          {st?.no_ktp && (
                            <button
                              type="button"
                              className="copy-btn-inline"
                              onClick={() => handleCopy(st.no_ktp, 'No KTP')}
                              title="Salin No KTP"
                            >
                              {copiedKey === 'No KTP' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bio-item">
                        <span>Tempat Lahir</span>
                        <strong>{st?.tempat_lahir || '-'}</strong>
                      </div>
                      <div className="bio-item">
                        <span>Tanggal Lahir</span>
                        <strong>{st?.tanggal_lahir || '-'}</strong>
                      </div>
                      <div className="bio-item">
                        <span>Nama Ibu Kandung</span>
                        <strong>{st?.nama_ibu_kandung || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="form-section-card">
                    <div className="form-section-title">
                      <BookOpen size={15} />
                      <span>Informasi Akademik & Periode</span>
                    </div>
                    <div className="bio-grid" style={{ background: '#ffffff', marginBottom: 0, padding: 12 }}>
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
                        <span>Periode Masuk</span>
                        <strong>{st?.entry_period_formatted || (st?.entry_period ? `${st.entry_period} (Angkatan ${st.entry_year})` : '-')}</strong>
                      </div>
                      <div className="bio-item">
                        <span>Registrasi Awal</span>
                        <strong>{st?.initial_registration || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="form-section-card" style={{ marginBottom: 0 }}>
                    <div className="form-section-title">
                      <Clock size={15} />
                      <span>Kontak & Domisili</span>
                    </div>
                    <div className="bio-grid" style={{ background: '#ffffff', marginBottom: 0, padding: 12 }}>
                      <div className="bio-item">
                        <span>Nomor HP / WhatsApp</span>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <strong>{st?.phone_number || '-'}</strong>
                          {st?.phone_number && (
                            <button
                              type="button"
                              className="copy-btn-inline"
                              onClick={() => handleCopy(st.phone_number, 'Nomor HP')}
                              title="Salin Kontak"
                            >
                              {copiedKey === 'Nomor HP' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bio-item">
                        <span>Alamat Email</span>
                        <strong>{st?.email || '-'}</strong>
                      </div>
                      <div className="bio-item" style={{ gridColumn: '1 / -1' }}>
                        <span>Alamat Lengkap</span>
                        <strong>{st?.address || '-'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Tagihan & Pembayaran */}
              {activeTab === 'financial' && (
                <div>
                  {/* Financial Stats Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
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

                  {/* Progress Bar Pelunasan */}
                  <div style={{ padding: 14, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
                      <span style={{ color: 'var(--muted)' }}>Progres Pelunasan Mahasiswa</span>
                      <span style={{ color: percentPaid === 100 ? 'var(--success)' : 'var(--brand-strong)' }}>{percentPaid}% Terbayar</span>
                    </div>
                    <div className="progress-track" style={{ height: 8, marginTop: 8 }}>
                      <div className="progress-fill" style={{ width: `${percentPaid}%` }} />
                    </div>
                  </div>

                  {/* Bills Table */}
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
                    Daftar Tagihan & Rekening BRIVA
                  </h4>
                  {!bills.length ? (
                    <div className="empty-state-card" style={{ padding: 24, border: '1px solid var(--line)' }}>
                      <CreditCard size={32} color="var(--muted-light)" style={{ marginBottom: 8 }} />
                      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Belum ada riwayat tagihan terdaftar untuk mahasiswa ini.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Periode</th>
                            <th>Jenis Tagihan</th>
                            <th>Nominal</th>
                            <th>Status</th>
                            <th>Batas Pembayaran</th>
                            <th>Nomor BRIVA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bills.map((b) => (
                            <tr key={b.id}>
                              <td><strong>{b.period}</strong></td>
                              <td>{b.bill_type}</td>
                              <td>
                                <div><strong style={{ color: 'var(--brand-strong)' }}>{b.amount_formatted}</strong></div>
                                {b.status === 'partial' && (
                                  <div style={{ fontSize: 11, marginTop: 2 }}>
                                    <span style={{ color: 'var(--success)' }}>Dibayar: {b.paid_amount_formatted}</span> • <span style={{ color: 'var(--danger)' }}>Sisa: {b.remaining_amount_formatted}</span>
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                                  {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Bayar Sebagian' : 'Belum Lunas'}
                                </span>
                              </td>
                              <td>{b.due_date_formatted || '-'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)' }}>{b.briva}</code>
                                  {b.briva && (
                                    <button
                                      type="button"
                                      className="copy-btn-inline"
                                      onClick={() => handleCopy(b.briva, `BRIVA (${b.briva})`)}
                                      title="Salin BRIVA"
                                    >
                                      {copiedKey === `BRIVA (${b.briva})` ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Riwayat Transaksi Pembayaran */}
              {activeTab === 'history' && (
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
                    Log Kronologis Pembayaran & Perubahan Status
                  </h4>
                  {!paymentHistory.length ? (
                    <div className="empty-state-card" style={{ padding: 24, border: '1px solid var(--line)' }}>
                      <Clock size={32} color="var(--muted-light)" style={{ marginBottom: 8 }} />
                      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Belum ada log histori pembayaran yang tercatat untuk mahasiswa ini.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Waktu & Tanggal</th>
                            <th>Tipe</th>
                            <th>Perubahan Status</th>
                            <th>Nominal</th>
                            <th>Total Terbayar</th>
                            <th>Metode / BRIVA</th>
                            <th>Referensi / Catatan</th>
                            <th>Dicatat Oleh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentHistory.map((tx) => (
                            <tr key={tx.id}>
                              <td style={{ fontSize: 12 }}>
                                <div><strong>{tx.payment_date}</strong></div>
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{tx.created_at}</span>
                              </td>
                              <td>
                                <span className={`badge ${tx.transaction_type === 'payment' ? 'badge-success' : tx.transaction_type === 'reversal' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                                  {tx.transaction_type === 'payment' ? 'Pembayaran' : tx.transaction_type === 'reversal' ? 'Pembatalan' : 'Koreksi'}
                                </span>
                              </td>
                              <td style={{ fontSize: 12 }}>
                                <span style={{ textTransform: 'capitalize' }}>{tx.previous_status}</span>
                                <span style={{ margin: '0 6px', color: 'var(--muted)' }}>&rarr;</span>
                                <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{tx.new_status}</span>
                              </td>
                              <td>
                                <strong style={{ color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {tx.amount >= 0 ? `+${tx.amount_formatted}` : `-${tx.amount_formatted}`}
                                </strong>
                              </td>
                              <td>
                                <strong style={{ color: 'var(--ink)' }}>{tx.running_paid_total_formatted}</strong>
                              </td>
                              <td style={{ fontSize: 12 }}>
                                <div>{tx.payment_method || 'BRIVA'}</div>
                                {tx.briva && <code style={{ fontSize: 11, color: 'var(--muted)' }}>{tx.briva}</code>}
                              </td>
                              <td style={{ fontSize: 12, maxWidth: 220 }}>
                                {tx.reference_number && <div><code>{tx.reference_number}</code></div>}
                                <span style={{ color: 'var(--muted)' }}>{tx.notes || '-'}</span>
                              </td>
                              <td style={{ fontSize: 12 }}>
                                <div>{tx.recorded_by_name || 'Admin'}</div>
                                <span style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>{tx.source}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="pagination-controls" style={{ marginTop: 12 }}>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                          Menampilkan {paymentHistory.length} dari {historyPagination.total} transaksi
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={historyLoading || historyPagination.offset <= 0}
                            onClick={() => fetchPaymentHistory(Math.max(0, historyPagination.offset - historyPagination.limit))}
                          >Sebelumnya</button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={historyLoading || historyPagination.offset + historyPagination.limit >= historyPagination.total}
                            onClick={() => fetchPaymentHistory(historyPagination.offset + historyPagination.limit)}
                          >Berikutnya</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ background: '#f8fafc' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const summaryText = `NIM: ${st?.nim}\nNama: ${st?.full_name}\nNIK: ${st?.no_ktp || '-'}\nProdi: ${st?.study_program_name || st?.program_study || '-'}\nKontak: ${st?.phone_number || '-'}\nTotal Tagihan: ${sm?.total_amount_formatted || 'Rp 0'}`;
              handleCopy(summaryText, 'Ringkasan Data');
            }}
          >
            <Copy size={14} />
            <span>Salin Profil Singkat</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
