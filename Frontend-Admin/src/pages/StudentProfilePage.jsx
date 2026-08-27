import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, CreditCard, Clock, Edit3, Copy, Check,
  Mail, Building2, AlertCircle,
  Plus, ExternalLink, RefreshCw, Save
} from 'lucide-react';
import { studentsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';

const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export default function StudentProfilePage({ studentId, initialTab = 'profile', navigateTo }) {
  const { showToast } = useToast();
  const { can } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || 'profile');
  const [copiedKey, setCopiedKey] = useState(null);
  const [prodis, setProdis] = useState([]);

  // Transaction history pagination state
  const [historyList, setHistoryList] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    nim: '',
    full_name: '',
    no_ktp: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    nama_ibu_kandung: '',
    study_program_id: '',
    academic_status: 'aktif',
    entry_year: '',
    entry_semester: 'ganjil',
    entry_period: '',
    phone_number: '',
    email: '',
    address: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchStudentData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await studentsApi.getDetail(studentId);
      setData(res);
      const st = res?.student || {};
      setHistoryList(res?.payment_history || []);
      setHistoryPagination(res?.payment_history_pagination || { total: (res?.payment_history || []).length, limit: 50, offset: 0 });
      setEditForm({
        nim: st.nim || '',
        full_name: st.full_name || '',
        no_ktp: st.no_ktp || '',
        tempat_lahir: st.tempat_lahir || '',
        tanggal_lahir: st.tanggal_lahir || '',
        nama_ibu_kandung: st.nama_ibu_kandung || '',
        study_program_id: st.study_program_id || '',
        academic_status: st.academic_status || 'aktif',
        entry_year: st.entry_year ? String(st.entry_year) : '',
        entry_semester: st.entry_semester || 'ganjil',
        entry_period: st.entry_period || '',
        phone_number: st.phone_number || '',
        email: st.email || '',
        address: st.address || '',
      });
    } catch (err) {
      showToast(err.message || 'Gagal memuat profil mahasiswa.', 'error');
    } finally {
      setLoading(false);
    }
  }, [studentId, showToast]);

  const fetchProdis = async () => {
    try {
      const res = await masterApi.listProdi();
      setProdis(res.study_programs || []);
    } catch {}
  };

  const handleFetchHistory = async (offset = 0) => {
    if (!studentId) return;
    setHistoryLoading(true);
    try {
      const res = await studentsApi.getTransactions(studentId, { limit: 50, offset });
      setHistoryList(res.transactions || []);
      setHistoryPagination(res.pagination || { total: (res.transactions || []).length, limit: 50, offset });
    } catch (err) {
      showToast(err.message || 'Gagal memuat riwayat mutasi pembayaran.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
    fetchProdis();
  }, [fetchStudentData]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`${label} disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.full_name.trim()) {
      setEditError('Nama lengkap mahasiswa wajib diisi.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      await studentsApi.update(studentId, {
        full_name: editForm.full_name.trim(),
        no_ktp: editForm.no_ktp.trim(),
        tempat_lahir: editForm.tempat_lahir.trim(),
        tanggal_lahir: editForm.tanggal_lahir.trim(),
        nama_ibu_kandung: editForm.nama_ibu_kandung.trim(),
        study_program_id: editForm.study_program_id || null,
        academic_status: editForm.academic_status,
        entry_year: editForm.entry_year ? Number(editForm.entry_year) : null,
        entry_semester: editForm.entry_semester,
        entry_period: editForm.entry_period.trim(),
        phone_number: editForm.phone_number.trim(),
        email: editForm.email.trim(),
        address: editForm.address.trim(),
      });
      showToast('Data mahasiswa berhasil diperbarui.', 'success');
      await fetchStudentData();
      setActiveTab('profile');
    } catch (err) {
      setEditError(err.message || 'Gagal memperbarui data mahasiswa.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--line)',
            borderTopColor: 'var(--brand)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>
          Memuat data profil mahasiswa...
        </p>
      </div>
    );
  }

  const st = data?.student || {};
  const sm = data?.summary || {};
  const bills = data?.bills || [];
  const paymentHistory = data?.payment_history || [];

  const totalAmount = Number(sm.total_amount || 0);
  const totalPaid = Number(sm.total_paid || 0);
  const totalOutstanding = Number(sm.total_outstanding || 0);
  const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  // Clean WhatsApp Link helper
  const cleanPhone = (st.phone_number || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;

  return (
    <div className="profile-page-container">
      {/* Top Breadcrumb & Action Header */}
      <div className="profile-header-bar">
        <div className="profile-breadcrumb-wrap">
          <button
            type="button"
            className="btn btn-secondary back-btn-compact"
            onClick={() => navigateTo('students')}
            title="Kembali ke Data Mahasiswa"
          >
            <ArrowLeft size={16} />
            <span>Kembali</span>
          </button>
          <div className="profile-breadcrumb">
            <span className="crumb-link" onClick={() => navigateTo('students')}>Data Mahasiswa</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-active">Profil 360</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-target">{st.full_name || 'Detail Mahasiswa'}</span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchStudentData()}
            title="Refresh Data"
          >
            <RefreshCw size={15} />
            <span>Segarkan</span>
          </button>
          {can('manage_students') && activeTab !== 'edit' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setActiveTab('edit')}
            >
              <Edit3 size={15} />
              <span>Edit Data Mahasiswa</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid Layout */}
      <div className="profile-layout-grid">
        {/* Left Column: Profile Card & Quick Contacts */}
        <div className="profile-left-col">
          {/* Card 1: Identity & Avatar Card */}
          <div className="panel-card profile-id-card">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-circle">
                <span className="profile-avatar-initials">
                  {(st.full_name || 'M').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className={`status-indicator ${st.academic_status === 'aktif' ? 'is-active' : 'is-inactive'}`} />
            </div>

            <h1 className="profile-full-name">{st.full_name || '-'}</h1>
            <div className="profile-role-tag">Customer / Mahasiswa</div>
            <div className="profile-org-label">SALUT AWWABIN SEPATAN TANGERANG</div>

            <div className="profile-badge-row">
              <span className={`badge ${st.academic_status === 'aktif' ? 'badge-success' : st.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}>
                {st.academic_status ? st.academic_status.toUpperCase() : 'AKTIF'}
              </span>
              <span className="badge badge-neutral">
                {st.study_program_name || st.program_study || 'Program Studi'}
              </span>
            </div>

            <div className="profile-divider" />

            {/* Quick Details List */}
            <div className="profile-quick-items">
              <div className="quick-item">
                <span className="quick-label">NIM</span>
                <div className="quick-val-row">
                  <span className="quick-val mono-font">{st.nim || '-'}</span>
                  {st.nim && (
                    <button
                      type="button"
                      className="copy-btn-inline"
                      onClick={() => handleCopy(st.nim, 'NIM')}
                      title="Salin NIM"
                    >
                      {copiedKey === 'NIM' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="quick-item">
                <span className="quick-label">No. Telepon / WA</span>
                <div className="quick-val-row">
                  <span className="quick-val">{st.phone_number || '-'}</span>
                  {waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="copy-btn-inline"
                      title="Chat via WhatsApp"
                      style={{ color: '#16a34a' }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              <div className="quick-item">
                <span className="quick-label">Email</span>
                <div className="quick-val-row">
                  <span className="quick-val text-truncate" title={st.email}>{st.email || '-'}</span>
                  {st.email && (
                    <a
                      href={`mailto:${st.email}`}
                      className="copy-btn-inline"
                      title="Kirim Email"
                      style={{ color: 'var(--brand)' }}
                    >
                      <Mail size={13} />
                    </a>
                  )}
                </div>
              </div>

              <div className="quick-item">
                <span className="quick-label">Alamat</span>
                <span className="quick-val" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                  {st.address || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Financial Summary Card */}
          <div className="panel-card profile-fin-card">
            <div className="card-sub-title">Ringkasan Keuangan Mahasiswa</div>
            <div className="fin-stat-hero">
              <div className="fin-stat-total">
                <span className="label">Total Tagihan</span>
                <span className="val">{formatRupiah(totalAmount)}</span>
              </div>
              <div className="fin-progress-bar">
                <div
                  className="fin-progress-fill"
                  style={{
                    width: `${percentPaid}%`,
                    background: percentPaid === 100 ? 'var(--success)' : percentPaid > 0 ? 'var(--warning)' : 'var(--danger)',
                  }}
                />
              </div>
              <div className="fin-stat-row">
                <div>
                  <span className="label">Terbayar</span>
                  <span className="val-paid">{formatRupiah(totalPaid)} ({percentPaid}%)</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="label">Sisa Tunggakan</span>
                  <span className="val-out">{formatRupiah(totalOutstanding)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Content Area */}
        <div className="profile-right-col">
          {/* Modern Navigation Tabs Header */}
          <div className="panel-card profile-tabs-card">
            <div className="profile-tabs-nav">
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === 'profile' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <User size={16} />
                <span>Profil Biodata</span>
              </button>
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === 'stats' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                <Building2 size={16} />
                <span>Statistik & Ringkasan</span>
              </button>
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === 'billing' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('billing')}
              >
                <CreditCard size={16} />
                <span>Billing & Tagihan ({bills.length})</span>
              </button>
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === 'history' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <Clock size={16} />
                <span>Riwayat Transaksi ({paymentHistory.length})</span>
              </button>
              {can('manage_students') && (
                <button
                  type="button"
                  className={`profile-tab-btn ${activeTab === 'edit' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('edit')}
                >
                  <Edit3 size={16} />
                  <span>Edit Biodata</span>
                </button>
              )}
            </div>

            {/* Tab 1: Profil Biodata */}
            {activeTab === 'profile' && (
              <div className="profile-tab-pane">
                <div className="profile-section-block">
                  <div className="profile-section-heading">
                    <User size={17} color="var(--brand)" />
                    <span>Informasi Data Utama Mahasiswa</span>
                  </div>

                  <div className="profile-kv-grid">
                    <div className="kv-item">
                      <span className="kv-label">ID Pelanggan / NIM</span>
                      <div className="kv-value-wrap">
                        <strong className="mono-font">{st.nim || '-'}</strong>
                        {st.nim && (
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() => handleCopy(st.nim, 'NIM')}
                            title="Salin NIM"
                          >
                            {copiedKey === 'NIM' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Nama Lengkap</span>
                      <strong className="kv-value">{st.full_name || '-'}</strong>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Jenis Pelanggan</span>
                      <span className="kv-value">Individual (Mahasiswa SALUT)</span>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">PIC / Kontak Mahasiswa</span>
                      <span className="kv-value">{st.full_name || '-'}</span>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">No. KTP / NIK</span>
                      <div className="kv-value-wrap">
                        <strong className="mono-font">{st.no_ktp || '-'}</strong>
                        {st.no_ktp && (
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

                    <div className="kv-item">
                      <span className="kv-label">Tempat & Tanggal Lahir</span>
                      <span className="kv-value">
                        {st.tempat_lahir || '-'}, {st.tanggal_lahir || '-'}
                      </span>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Nama Ibu Kandung</span>
                      <span className="kv-value">{st.nama_ibu_kandung || '-'}</span>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Program Studi</span>
                      <strong className="kv-value" style={{ color: 'var(--brand)' }}>
                        {st.study_program_name || st.program_study || '-'}
                      </strong>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">No. Handphone / WhatsApp</span>
                      <div className="kv-value-wrap">
                        <span className="kv-value">{st.phone_number || '-'}</span>
                        {st.phone_number && (
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() => handleCopy(st.phone_number, 'No HP')}
                            title="Salin No HP"
                          >
                            {copiedKey === 'No HP' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Email</span>
                      <span className="kv-value">{st.email || '-'}</span>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Periode Masuk / Semester</span>
                      <span className="kv-value">
                        {st.entry_period_formatted || st.entry_period || (st.entry_year ? `${st.entry_year}.${st.entry_semester === 'genap' ? '2' : '1'}` : '-')}
                      </span>
                    </div>

                    <div className="kv-item">
                      <span className="kv-label">Status Akademik</span>
                      <span className="kv-value">
                        <span className={`badge ${st.academic_status === 'aktif' ? 'badge-success' : st.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}>
                          {st.academic_status ? st.academic_status.toUpperCase() : 'AKTIF'}
                        </span>
                      </span>
                    </div>

                    <div className="kv-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="kv-label">Alamat Lengkap</span>
                      <span className="kv-value">{st.address || '-'}</span>
                    </div>

                    {st.initial_registration && (
                      <div className="kv-item" style={{ gridColumn: '1 / -1' }}>
                        <span className="kv-label">Registrasi Awal</span>
                        <span className="kv-value mono-font">{st.initial_registration}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Grup & BRIVA Terdaftar */}
                <div className="profile-section-block" style={{ marginTop: 24 }}>
                  <div className="profile-section-heading">
                    <CreditCard size={17} color="var(--brand)" />
                    <span>Grup & BRIVA Terdaftar</span>
                  </div>

                  {bills.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', padding: 12 }}>
                      Belum ada nomor BRIVA yang terdaftar untuk mahasiswa ini.
                    </p>
                  ) : (
                    <div className="briva-groups-list">
                      {bills.map((b) => (
                        <div key={b.id} className="briva-group-card">
                          <div className="briva-group-left">
                            <div className="briva-group-title">
                              UNIVERSITAS TERBUKA {b.period || '2023.2'}
                            </div>
                            <div className="briva-group-sub">
                              <span>Jenis: <strong>{b.bill_type}</strong></span>
                              <span>•</span>
                              <span>Nominal: <strong>{b.amount_formatted}</strong></span>
                              {b.due_date_formatted && (
                                <>
                                  <span>•</span>
                                  <span>Jatuh Tempo: <strong>{b.due_date_formatted}</strong></span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="briva-group-right">
                            <div className="briva-number-box">
                              <span className="briva-num-val">{b.briva || '-'}</span>
                              {b.briva && (
                                <button
                                  type="button"
                                  className="copy-btn-inline"
                                  onClick={() => handleCopy(b.briva, `BRIVA ${b.briva}`)}
                                  title="Salin BRIVA"
                                >
                                  {copiedKey === `BRIVA ${b.briva}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                                </button>
                              )}
                            </div>
                            {can('manage_billing') && (
                              <button
                                type="button"
                                className="btn btn-sm btn-brand"
                                onClick={() => navigateTo('bill-payment', { billId: b.id })}
                                title="Catat Pembayaran Tagihan Ini"
                              >
                                <CreditCard size={13} />
                                <span>Bayar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Statistik & Ringkasan */}
            {activeTab === 'stats' && (
              <div className="profile-tab-pane">
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ringkasan Statistik Keuangan</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Akumulasi tagihan dan progres penyelesaian kewajiban mahasiswa
                  </p>
                </div>

                <div className="kpi-cards-grid">
                  <div className="kpi-card">
                    <span className="kpi-label">Total Tagihan Terbit</span>
                    <span className="kpi-value" style={{ color: 'var(--brand-strong)' }}>
                      {sm.total_amount_formatted || 'Rp 0'}
                    </span>
                    <span className="kpi-sub">Dari {sm.total_bills || 0} tagihan terdaftar</span>
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">Total Sudah Terbayar</span>
                    <span className="kpi-value" style={{ color: 'var(--success)' }}>
                      {sm.total_paid_formatted || 'Rp 0'}
                    </span>
                    <span className="kpi-sub">{percentPaid}% dari total kewajiban</span>
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">Sisa Tunggakan (Outstanding)</span>
                    <span className="kpi-value" style={{ color: totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {sm.total_outstanding_formatted || 'Rp 0'}
                    </span>
                    <span className="kpi-sub">{totalOutstanding > 0 ? 'Belum diselesaikan' : 'Lunas sepenuhnya'}</span>
                  </div>

                  <div className="kpi-card">
                    <span className="kpi-label">Jumlah Tagihan</span>
                    <span className="kpi-value">{sm.total_bills || 0}</span>
                    <span className="kpi-sub">Kewajiban aktif</span>
                  </div>
                </div>

                <div className="panel-card" style={{ marginTop: 24, padding: 20, background: '#f8fafc' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Progres Pelunasan Tagihan</h4>
                  <div className="fin-progress-bar" style={{ height: 12, borderRadius: 6 }}>
                    <div
                      className="fin-progress-fill"
                      style={{
                        width: `${percentPaid}%`,
                        background: percentPaid === 100 ? 'var(--success)' : 'linear-gradient(90deg, var(--brand) 0%, #10b981 100%)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: 'var(--muted)' }}>0%</span>
                    <span style={{ color: 'var(--brand-strong)' }}>{percentPaid}% Selesai</span>
                    <span style={{ color: 'var(--muted)' }}>100%</span>
                  </div>

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>Status Pembayaran Agregat:</span>
                    <div>
                      <span className={`badge ${sm.overall_status === 'paid' ? 'badge-success' : sm.overall_status === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ padding: '6px 14px', fontSize: 13 }}>
                        Status Keseluruhan: {sm.overall_status === 'paid' ? 'LUNAS' : sm.overall_status === 'partial' ? 'BAYAR SEBAGIAN' : 'BELUM LUNAS'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Billing & Tagihan */}
            {activeTab === 'billing' && (
              <div className="profile-tab-pane">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Daftar Tagihan Mahasiswa</h3>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Daftar seluruh tagihan yang diterbitkan untuk {st.full_name}
                    </p>
                  </div>
                  {can('manage_billing') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-brand"
                      onClick={() => navigateTo('bills')}
                    >
                      <Plus size={14} />
                      <span>Buat Tagihan Baru</span>
                    </button>
                  )}
                </div>

                {bills.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                    <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontWeight: 600 }}>Belum ada data tagihan untuk mahasiswa ini.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Periode</th>
                          <th>Jenis Tagihan</th>
                          <th>Nomor BRIVA</th>
                          <th style={{ textAlign: 'right' }}>Total Tagihan</th>
                          <th style={{ textAlign: 'right' }}>Terbayar</th>
                          <th style={{ textAlign: 'right' }}>Sisa</th>
                          <th>Jatuh Tempo</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((b) => (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 600 }}>{b.period || '-'}</td>
                            <td>{b.bill_type || '-'}</td>
                            <td>
                              <div className="mono-font" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>{b.briva || '-'}</span>
                                {b.briva && (
                                  <button
                                    type="button"
                                    className="copy-btn-inline"
                                    onClick={() => handleCopy(b.briva, 'BRIVA')}
                                    title="Salin BRIVA"
                                  >
                                    {copiedKey === 'BRIVA' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {b.amount_formatted}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                              {b.paid_amount_formatted}
                            </td>
                            <td style={{ textAlign: 'right', color: b.remaining_amount > 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>
                              {b.remaining_amount_formatted}
                            </td>
                            <td style={{ fontSize: 12.5 }}>{b.due_date_formatted || '-'}</td>
                            <td>
                              <span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                                {b.status === 'paid' ? 'LUNAS' : b.status === 'partial' ? 'SEBAGIAN' : 'BELUM BAYAR'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                {can('manage_billing') && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-brand"
                                    onClick={() => navigateTo('bill-payment', { billId: b.id })}
                                    title="Catat Pembayaran Tagihan Ini"
                                  >
                                    <CreditCard size={13} />
                                    <span>Bayar</span>
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

            {/* Tab 4: Riwayat Transaksi */}
            {activeTab === 'history' && (
              <div className="profile-tab-pane">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Riwayat Mutasi & Transaksi Pembayaran</h3>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Ledger mutasi pembayaran yang tercatat secara kronologis untuk {st.full_name} ({historyPagination.total} transaksi)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleFetchHistory(historyPagination.offset)}
                    disabled={historyLoading}
                    title="Muat Ulang Transaksi"
                  >
                    <RefreshCw size={13} className={historyLoading ? 'spin' : ''} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {historyList.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                    <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontWeight: 600 }}>Belum ada riwayat transaksi pembayaran tercatat.</p>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Waktu & Tanggal</th>
                            <th>Tipe Mutasi</th>
                            <th style={{ textAlign: 'right' }}>Nominal Transaksi</th>
                            <th style={{ textAlign: 'right' }}>Running Total</th>
                            <th>Status Tagihan</th>
                            <th>Metode & Referensi</th>
                            <th>Catatan</th>
                            <th>Operator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyList.map((tx) => (
                            <tr key={tx.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{tx.payment_date || '-'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tx.created_at || ''}</div>
                              </td>
                              <td>
                                <span className={`badge ${tx.transaction_type === 'payment' ? 'badge-success' : tx.transaction_type === 'reversal' ? 'badge-danger' : 'badge-neutral'}`}>
                                  {tx.transaction_type === 'payment' ? 'PEMBAYARAN' : tx.transaction_type === 'reversal' ? 'PEMBATALAN' : 'KOREKSI'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {tx.amount >= 0 ? `+ ${tx.amount_formatted}` : `- ${tx.amount_formatted}`}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {tx.running_paid_total_formatted}
                              </td>
                              <td>
                                <div style={{ fontSize: 12 }}>
                                  <span>{tx.previous_status || 'unpaid'}</span>
                                  <span style={{ margin: '0 4px' }}>→</span>
                                  <strong>{tx.new_status}</strong>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{tx.payment_method || 'BRIVA'}</div>
                                {tx.reference_number && (
                                  <div className="mono-font" style={{ fontSize: 11, color: 'var(--muted)' }}>
                                    Ref: {tx.reference_number}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: 12.5, maxWidth: 200 }}>
                                {tx.notes || '-'}
                              </td>
                              <td style={{ fontSize: 12 }}>
                                {tx.recorded_by_name || 'Admin SALUT'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {historyPagination.total > historyPagination.limit && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Menampilkan {historyList.length} dari {historyPagination.total} transaksi
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={historyLoading || historyPagination.offset <= 0}
                            onClick={() => handleFetchHistory(Math.max(0, historyPagination.offset - historyPagination.limit))}
                          >
                            Sebelumnya
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={historyLoading || historyPagination.offset + historyPagination.limit >= historyPagination.total}
                            onClick={() => handleFetchHistory(historyPagination.offset + historyPagination.limit)}
                          >
                            Berikutnya
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab 5: Edit Biodata Mahasiswa */}
            {activeTab === 'edit' && can('manage_students') && (
              <div className="profile-tab-pane">
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Edit Biodata & Informasi Mahasiswa</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Perbarui data kependudukan, program studi, kontak, dan status akademik mahasiswa
                  </p>
                </div>

                {editError && (
                  <div className="alert-box alert-danger" style={{ marginBottom: 20 }}>
                    <AlertCircle size={18} />
                    <span>{editError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveEdit} className="modern-form">
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>NIM Mahasiswa (Permanen)</label>
                      <input
                        type="text"
                        value={editForm.nim}
                        disabled
                        className="form-input"
                        style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Nama Lengkap Mahasiswa <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                        className="form-input"
                        placeholder="Nama lengkap sesuai KTP"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>No. KTP / NIK (16 Digit)</label>
                      <input
                        type="text"
                        value={editForm.no_ktp}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, no_ktp: e.target.value }))}
                        className="form-input"
                        placeholder="Contoh: 3603100510860014"
                        maxLength={16}
                      />
                    </div>

                    <div className="form-group">
                      <label>Nama Ibu Kandung</label>
                      <input
                        type="text"
                        value={editForm.nama_ibu_kandung}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, nama_ibu_kandung: e.target.value }))}
                        className="form-input"
                        placeholder="Nama ibu kandung"
                      />
                    </div>

                    <div className="form-group">
                      <label>Tempat Lahir</label>
                      <input
                        type="text"
                        value={editForm.tempat_lahir}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, tempat_lahir: e.target.value }))}
                        className="form-input"
                        placeholder="Kota tempat lahir"
                      />
                    </div>

                    <div className="form-group">
                      <label>Tanggal Lahir</label>
                      <input
                        type="text"
                        value={editForm.tanggal_lahir}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, tanggal_lahir: e.target.value }))}
                        className="form-input"
                        placeholder="Contoh: 14 September 2000"
                      />
                    </div>

                    <div className="form-group">
                      <label>Program Studi</label>
                      <select
                        value={editForm.study_program_id}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, study_program_id: e.target.value }))}
                        className="form-input"
                      >
                        <option value="">-- Pilih Program Studi --</option>
                        {prodis.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.degree ? `(${p.degree})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Status Akademik</label>
                      <select
                        value={editForm.academic_status}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, academic_status: e.target.value }))}
                        className="form-input"
                      >
                        <option value="aktif">Aktif</option>
                        <option value="cuti">Cuti</option>
                        <option value="nonaktif">Nonaktif</option>
                        <option value="lulus">Lulus</option>
                        <option value="keluar">Keluar / DO</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>No. Handphone / WhatsApp</label>
                      <input
                        type="text"
                        value={editForm.phone_number}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                        className="form-input"
                        placeholder="Contoh: 085163132520"
                      />
                    </div>

                    <div className="form-group">
                      <label>Alamat Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="form-input"
                        placeholder="Contoh: mahasiswa@email.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Tahun Masuk</label>
                      <input
                        type="number"
                        value={editForm.entry_year}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, entry_year: e.target.value }))}
                        className="form-input"
                        placeholder="Contoh: 2023"
                      />
                    </div>

                    <div className="form-group">
                      <label>Periode Masuk (Kode)</label>
                      <input
                        type="text"
                        value={editForm.entry_period}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, entry_period: e.target.value }))}
                        className="form-input"
                        placeholder="Contoh: 2023.1"
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Alamat Lengkap</label>
                      <textarea
                        value={editForm.address}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                        className="form-input"
                        rows={3}
                        placeholder="Alamat domisili lengkap..."
                      />
                    </div>
                  </div>

                  <div className="form-actions-bar" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setActiveTab('profile')}
                      disabled={savingEdit}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingEdit}
                    >
                      {savingEdit ? (
                        <>
                          <div className="spinner-sm" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>Simpan Perubahan Biodata</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
