# Salut Cek Pembayaran & Sistem Informasi Akademik (SIAKAD)

Aplikasi web terpadu untuk mahasiswa Universitas Terbuka di SALUT Awwabin dalam mengecek status tagihan dan instruksi pembayaran BRIVA secara mandiri, dilengkapi dengan portal admin modern berbasis React 19 + Vite SPA untuk manajemen akademik, tagihan, rekapitulasi keuangan, dan import data master Excel.

## Status Sistem

- Backend: FastAPI dan Uvicorn berjalan di VPS dengan database SQLite, session-based RBAC auth, migrasi otomatis, dan scheduled backup.
- Frontend Admin: Modern Single Page Application (SPA) berbasis React 19 + Vite yang terintegrasi langsung di bundle `Frontend/admin-dist/`.
- Frontend Publik: Antarmuka web statis mandiri untuk pencarian tagihan mahasiswa berbasis NIM dengan rate limit dan proteksi privasi.
- Quality Assurance lokal: 45 unit/integration tests di `Backend.test_core`, build Vite, `npm audit`, `pip check`, dan `pip-audit` lulus pada 2026-08-21. Hasil ini belum mencakup E2E browser atau verifikasi deployment produksi.

## Fitur Utama

### 1. Portal Publik Mahasiswa
- Pencarian tagihan cepat berbasis NIM tanpa login.
- Penanganan multi-bill dengan penomoran otomatis (`Tagihan 1`, `Tagihan 2`, dst.) dan kalkulasi `Total Tagihan`.
- Transparansi status pembayaran: `Lunas`, `Bayar sebagian` (dengan rincian nominal cicilan & sisa tagihan), dan `Belum lunas`.
- Informasi lengkap nomor Virtual Account (BRIVA), nama rekening, batas aktif pembayaran, serta panduan cara pembayaran resmi.

### 2. Portal Admin SIAKAD (React 19 SPA)
- **Dashboard Analytics**: Metrik real-time total mahasiswa, total tagihan, total penerimaan, sisa piutang/tunggakan, dan persentase pelunasan.
- **Data Mahasiswa**: Live search, filter program studi & status akademik, manajemen CRUD, dan modal **Student Profile 360** (biodata lengkap, NIK/KTP, TTL, nama ibu kandung, kontak, registrasi awal/angkatan, dan riwayat seluruh tagihan).
- **Tagihan Mahasiswa**: API paginasi 100 baris, filter status dan sumber data (`import`/`manual`), inline status switcher, pencatatan nominal cicilan (`paid_amount`), dan kalkulasi otomatis sisa piutang (`remaining_amount`). Lihat keterbatasan paginasi SPA pada bagian status audit.
- **Rekapitulasi Keuangan**: Analisis keuangan per Program Studi (penerimaan vs tunggakan) dengan fitur ekspor data ke file CSV.
- **Riwayat File Import**: Kartu batch file import, ringkasan status pembayaran per batch, dan fitur soft delete tagihan per file dengan alasan audit.
- **Wizard Upload Excel 3-Langkah**:
  - Mendukung format Master Data 13 kolom (`MASTER_DATA_2023_1_2026_1.xlsx`) dan format legacy.
  - Normalisasi otomatis nama mahasiswa (Title Case / Capital Each Word).
  - Ekstraksi semester registrasi awal (contoh: `2023.1`, `2023.2`) untuk sorting kronologis angkatan.
  - Deteksi anomali data, preview diff sebelum commit, dan tombol unduh template Excel resmi.
- **Master Data**: Manajemen CRUD Program Studi dan Periode/Semester Akademik (termasuk penetapan semester aktif).
- **Otorisasi RBAC**: Kontrol akses server-side berbasis permission untuk `super_admin`, `admin`, dan `viewer`. API/UI pengelolaan akun admin belum tersedia.
- **Audit & Lookup Logging**: `audit_logs` mencatat aksi admin penting; `lookup_logs` menyimpan hash pencarian publik dan hasilnya.

## Status Audit Codebase 2026-08-21

Audit menyeluruh terbaru ada di [Codebase Audit & Mitigation Plan](docs/14-codebase-audit-mitigation-plan.md). Remediasi P0 lokal pada 2026-08-22 telah memperbaiki permission history, metadata pagination React, penolakan cicilan tanpa nominal, serta konfigurasi Compose. Checkout tetap belum production-ready karena review data partial historis, konsistensi RBAC viewer, reliability SQLite, atomic audit log, dan hardening operasi masih terbuka.

- route history kini memakai permission `view_reports` dan memverifikasi target bill/mahasiswa;
- SPA React membaca `pagination.total` serta `pagination.total_pages` dari API;
- endpoint dan fallback legacy meminta nominal eksplisit untuk status `partial`;
- Compose hanya bind ke loopback, mewajibkan secret dari `.env`, dan mematikan trusted proxy secara default;
- CRUD jenis tagihan, pengelolaan akun admin, pembacaan audit log, laporan per periode, serta input backdate/referensi pembayaran belum diimplementasikan.

Jangan menyatakan checkout ini production-ready sebelum temuan High pada dokumen audit ditutup, test regresi ditambah, dan deployment diverifikasi terpisah.

## Rekomendasi Teknologi

- **Backend**: FastAPI, Uvicorn, Python 3.10+
- **Database**: SQLite (dengan migrasi otomatis dan indeks pencarian)
- **Frontend Publik**: HTML5, CSS3 Modern, Vanilla JavaScript
- **Frontend Admin**: React 19, Vite, Lucide Icons, Modern CSS SPA
- **Keamanan**: Server-side RBAC, Session Cookie HttpOnly/Secure, X-Real-IP Rate Limiter, Hash Logging untuk pencarian publik.

## Struktur Direktori

| Direktori | Deskripsi |
|---|---|
| `Backend/` | Aplikasi FastAPI (`Backend/app/`), modul database & migrasi (`Backend/db.py`), dan unit tests (`Backend/test_core.py`). |
| `Frontend/` | Antarmuka publik mahasiswa, file statis, dan direktori bundle produksi admin (`Frontend/admin-dist/`). |
| `Frontend-Admin/` | Source code Single Page Application (React 19 + Vite) untuk Portal Admin. |
| `docs/` | Dokumentasi teknis terstandarisasi ISO/IEC/IEEE, desain arsitektur, API contract, runbook, dan security policy. |

## Panduan Menjalankan Lokal

### Prasyarat
- Python 3.10 atau versi lebih baru
- Node.js 18 atau versi lebih baru

### 1. Menjalankan Backend & Public Frontend

```powershell
# Buat environment proyek agar paket global tidak ikut diperiksa/digunakan
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Jalankan unit test
.\.venv\Scripts\python.exe -m unittest Backend.test_core

# Jalankan server backend (FastAPI + Public Frontend)
.\.venv\Scripts\python.exe -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Akses portal publik di `http://127.0.0.1:8000`. Coba pencarian dengan contoh NIM: `050117077`.

### 2. Menjalankan Frontend Admin React (Development Mode)

```powershell
cd Frontend-Admin
npm install
npm run dev
```

Akses dev server admin di `http://localhost:5173`. Request API akan otomatis di-proxy ke backend `http://127.0.0.1:8000`.

### 3. Melakukan Build Frontend Admin untuk Produksi

```powershell
cd Frontend-Admin
npm run build
```

Hasil build akan otomatis disimpan ke direktori `Frontend/admin-dist/` dan langsung disajikan oleh server FastAPI melalui rute `/admin`.

### 4. Audit Dependency Python

Jalankan audit melalui skrip berikut dari root repository. Skrip membuat `.venv-audit` khusus, memasang dependency dari `requirements-audit.txt`, lalu menjalankan `pip check` dan `pip-audit` tanpa mencampur paket Python global.

```powershell
.\scripts\audit_python_dependencies.ps1
```

Snapshot terakhir pada 2026-08-21 menggunakan `pip-audit 2.10.1`: tidak ada broken requirements dan tidak ada known vulnerability pada dependency yang di-resolve dari `requirements.txt`. Audit harus dijalankan ulang pada setiap perubahan dependency dan sebelum release karena basis data advisory terus berubah.

Catatan: Di server produksi (VPS), gunakan `APP_ENV=production`. Set `TRUST_PROXY_HEADERS=true` hanya bila aplikasi dapat diakses **eksklusif** melalui reverse proxy tepercaya; akses Docker langsung harus tetap `false`.

## Indeks Dokumentasi

Dokumentasi proyek disusun mengikuti prinsip ISO/IEC/IEEE dan best practices pengembangan software:

- [Portal Dokumentasi HTML](docs/index.html)
- [00 - Standar dan Metodologi](docs/00-standards-and-methodology.md)
- [01 - Product Requirements Document](docs/01-product-requirements.md)
- [02 - System Design](docs/02-system-design.md)
- [03 - Diagram Sistem](docs/03-diagrams.md)
- [04 - Database Design](docs/04-database-design.md)
- [05 - API Contract](docs/05-api-contract.md)
- [06 - Security dan Privacy Design](docs/06-security-privacy-design.md)
- [07 - Admin dan Operasional](docs/07-admin-operations.md)
- [08 - Test dan Quality Plan](docs/08-test-quality-plan.md)
- [09 - Deployment Plan](docs/09-deployment-plan.md)
- [10 - Project Management Plan](docs/10-project-management.md)
- [11 - Risk Register](docs/11-risk-register.md)
- [12 - Requirements Traceability Matrix](docs/12-traceability-matrix.md)
- [13 - Change dan Release Plan](docs/13-change-release-plan.md)
- [14 - Codebase Audit & Mitigation Plan](docs/14-codebase-audit-mitigation-plan.md)
- [Changelog](docs/CHANGELOG.md)
- [Handoff Document](docs/HANDOFF.md)
- [Security Policy](docs/SECURITY.md)
- [Runbook](docs/RUNBOOK.md)

## Keamanan dan Privasi

1. **Proteksi Lookup NIM**: Lookup publik hanya meminta NIM dan menampilkan informasi tagihan yang relevan untuk verifikasi pembayaran. Risiko enumeration dicegah melalui pesan error generik, lookup log ter-hash menggunakan secret key, rate limit per IP, serta pemantauan lonjakan traffic.
2. **Otorisasi dan Sesi**: Akses dashboard admin diproteksi dengan sesi terenkripsi, cookie HttpOnly dan SameSite, serta kontrol RBAC di level backend.
3. **Integritas Data Import**: File Excel yang diunggah divalidasi struktur kolomnya, dibatasi ukurannya, dan memerlukan konfirmasi preview sebelum data di-commit ke database.
