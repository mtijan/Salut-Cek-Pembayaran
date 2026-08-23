# Salut Cek Pembayaran & Sistem Informasi Akademik (SIAKAD)

Aplikasi web terpadu untuk mahasiswa Universitas Terbuka di SALUT Awwabin dalam mengecek status tagihan dan instruksi pembayaran BRIVA secara mandiri, dilengkapi dengan portal admin modern berbasis React 19 + Vite SPA untuk manajemen akademik, tagihan, rekapitulasi keuangan, dan import data master Excel.

## Status Sistem

- Backend: FastAPI dan Uvicorn berjalan di VPS dengan database SQLite, session-based RBAC auth, migrasi otomatis, dan scheduled backup.
- Frontend Admin: Modern Single Page Application (SPA) berbasis React 19 + Vite yang terintegrasi langsung di bundle `Frontend/admin-dist/`.
- Frontend Publik: Antarmuka web statis mandiri untuk pencarian tagihan mahasiswa berbasis NIM dengan rate limit dan proteksi privasi.
- Quality Assurance: 58 unit/integration tests di `Backend.test_core`, build Vite, audit dependency npm/Python, serta verifikasi VPS lulus untuk release `ec6d65f` pada 2026-08-22. Browser E2E sintetis, RBAC, concurrency SQLite, backup/restore, Nginx, timer, health, dan OpenAPI juga telah diverifikasi; UAT mutasi data bisnis tetap menjadi gate admin terpisah.

## Fitur Utama

### 1. Portal Publik Mahasiswa
- Pencarian tagihan cepat berbasis NIM tanpa login.
- Penanganan multi-bill dengan penomoran otomatis (`Tagihan 1`, `Tagihan 2`, dst.) dan kalkulasi `Total Tagihan`.
- Transparansi status pembayaran: `Lunas`, `Bayar sebagian` (dengan rincian nominal cicilan & sisa tagihan), dan `Belum lunas`.
- Informasi lengkap nomor Virtual Account (BRIVA), nama rekening, batas aktif pembayaran, serta panduan cara pembayaran resmi.

### 2. Portal Admin SIAKAD (React 19 SPA)
- **Dashboard Analytics**: Metrik real-time total mahasiswa, total tagihan, total penerimaan, sisa piutang/tunggakan, dan persentase pelunasan.
- **Data Mahasiswa**: Live search, filter program studi & status akademik, manajemen CRUD, dan modal **Student Profile 360** (biodata lengkap, NIK/KTP, TTL, nama ibu kandung, kontak, registrasi awal/angkatan, dan riwayat seluruh tagihan).
- **Tagihan Mahasiswa**: API/SPA paginasi 100 baris, filter status dan sumber data (`import`/`manual`), inline status switcher, pencatatan nominal cicilan (`paid_amount`), dan kalkulasi otomatis sisa piutang (`remaining_amount`).
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

Audit menyeluruh terbaru tersedia pada artefak lokal `docs/14-codebase-audit-mitigation-plan.md`. Remediasi P0-P2 telah dideploy pada revision `ec6d65f` tanggal 2026-08-22 dan technical smoke test lulus. Deployment release berikutnya wajib mengikuti protokol lokal `docs/15-production-deployment-protocol.md`; UAT yang mengubah data bisnis tetap dilakukan admin pada data yang disetujui.

- route history kini memakai permission `view_reports` dan memverifikasi target bill/mahasiswa;
- SPA React membaca `pagination.total` serta `pagination.total_pages` dari API;
- endpoint dan fallback legacy meminta nominal eksplisit untuk status `partial`;
- Compose hanya bind ke loopback, mewajibkan secret dari `.env`, dan mematikan trusted proxy secara default;
- CRUD jenis tagihan, pengelolaan akun admin, pembacaan audit log, penghapusan CSP `unsafe-inline`, self-host font, alert disk eksternal, serta debt maintainability/P3 masih terbuka.

Status sebuah release hanya boleh dinyatakan selesai setelah commit, backup, health/release ID, migration/schema, smoke test, dan bukti deployment untuk release tersebut diverifikasi; hasil release sebelumnya tidak menggantikan verifikasi release berikutnya.

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
| `docs/` | Dokumentasi teknis lokal, audit, runbook, dan protokol deployment; di-ignore dari Git. |
| `deploy/` | Unit systemd dan konfigurasi Nginx lokal; di-ignore dari Git. |

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

## Akses VPS Production

Jalankan dari Windows PowerShell pada komputer operator yang memiliki private key:

```powershell
Test-Path -LiteralPath "$env:USERPROFILE\.ssh\salut_cek_pembayaran_ed25519"
ssh -i "$env:USERPROFILE\.ssh\salut_cek_pembayaran_ed25519" ubuntu@43.157.224.57
```

Hasil `Test-Path` harus `True`. Pada koneksi pertama, cocokkan fingerprint SSH dengan inventaris VPS/provider sebelum menerima host. Jangan menyalin private key ke repository, VPS, dokumentasi, chat, atau release evidence.

Setelah masuk:

```bash
whoami
hostname
sudo -v
```

`whoami` harus menghasilkan `ubuntu`. Prosedur preflight, backup, migrasi, smoke test, UAT, dan rollback selengkapnya tersedia lokal di `docs/15-production-deployment-protocol.md`.

## Dokumentasi dan Artefak Deployment Lokal

Folder `docs/` dan `deploy/` tercantum pada `.gitignore`. Keduanya dipertahankan hanya pada workspace/operator yang berwenang dan tidak dijamin tersedia dari clone Git baru.

- `docs/15-production-deployment-protocol.md`: protokol deploy production lengkap.
- `docs/14-codebase-audit-mitigation-plan.md`: temuan dan status mitigasi audit.
- `docs/RUNBOOK.md`: panduan operasi dan incident.
- `deploy/`: unit systemd, timer, serta konfigurasi Nginx.

Karena folder tersebut di-ignore, perubahan di dalamnya tidak ikut commit/push normal. Release owner wajib memastikan dokumen dan artefak deployment didistribusikan melalui media internal yang disetujui sebelum deployment.

## Keamanan dan Privasi

1. **Proteksi Lookup NIM**: Lookup publik hanya meminta NIM dan menampilkan informasi tagihan yang relevan untuk verifikasi pembayaran. Risiko enumeration dicegah melalui pesan error generik, lookup log ter-hash menggunakan secret key, rate limit per IP, serta pemantauan lonjakan traffic.
2. **Otorisasi dan Sesi**: Akses dashboard admin diproteksi dengan sesi terenkripsi, cookie HttpOnly dan SameSite, serta kontrol RBAC di level backend.
3. **Integritas Data Import**: File Excel yang diunggah divalidasi struktur kolomnya, dibatasi ukurannya, dan memerlukan konfirmasi preview sebelum data di-commit ke database.
