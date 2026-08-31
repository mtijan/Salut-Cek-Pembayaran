import {
  Database,
  FileSpreadsheet,
  Layers,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', kicker: 'Ringkasan Sistem', icon: LayoutDashboard },
  { id: 'students', label: 'Data Mahasiswa', kicker: 'Data Akademik', icon: Users },
  { id: 'bills', label: 'Tagihan Mahasiswa', kicker: 'Manajemen Keuangan', icon: Receipt },
  { id: 'reports', label: 'Rekap Keuangan', kicker: 'Laporan & Evaluasi', icon: FileSpreadsheet },
  { id: 'files', label: 'Data File Import', kicker: 'Riwayat Import', icon: Layers },
  { id: 'upload', label: 'Upload File', kicker: 'Upload Excel', icon: UploadCloud },
  { id: 'master', label: 'Master Data', kicker: 'Master Data Akademik', icon: Database },
  {
    id: 'users',
    label: 'Kelola Admin',
    kicker: 'Manajemen Pengguna',
    icon: ShieldCheck,
    permission: 'manage_users',
  },
];
