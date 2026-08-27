k
300704
# Salut Cek Pembayaran & SIAKAD

Aplikasi web untuk membantu mahasiswa SALUT mengecek tagihan secara mandiri dan membantu admin mengelola data akademik, pembayaran, serta import data Excel dalam satu sistem.

Project ini menggabungkan portal publik yang sederhana dengan dashboard admin berbasis React. Backend FastAPI menyediakan API, autentikasi, pengolahan data, dan penyajian kedua frontend dari satu service.

## Fitur Utama

### Portal Mahasiswa

- Pencarian tagihan menggunakan NIM.
- Informasi status `Belum lunas`, `Bayar sebagian`, dan `Lunas`.
- Rincian nominal tagihan, jumlah yang sudah dibayar, dan sisa pembayaran.
- Informasi BRIVA, periode, jenis tagihan, serta batas pembayaran.
- Dukungan beberapa tagihan untuk satu mahasiswa.

### Portal Admin

- Dashboard ringkasan mahasiswa, tagihan, penerimaan, dan piutang.
- Pengelolaan data mahasiswa dan tagihan.
- Pencatatan pembayaran parsial maupun lunas.
- Riwayat transaksi pembayaran per mahasiswa dan tagihan.
- Import workbook Excel melalui proses upload, preview, validasi, dan commit.
- Rekapitulasi keuangan berdasarkan program studi dan periode.
- Pengelolaan program studi serta periode akademik.
- Kontrol akses berbasis role dan pencatatan aktivitas admin.

## Nilai Teknis

- Migrasi database SQLite dijalankan secara versioned.
- Ledger transaksi pembayaran dibuat append-only untuk menjaga histori.
- Import Excel divalidasi sebelum data disimpan.
- Operasi penting dicatat dalam audit log.
- API mendukung pagination dan filter untuk dataset besar.
- Antarmuka publik dan dashboard admin disajikan oleh backend yang sama.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite |
| Frontend publik | HTML, CSS, JavaScript |
| Frontend admin | React 19, Vite, Lucide React |
| Import Excel | OpenPyXL |
| Autentikasi | Session cookie dan role-based access control |

## Struktur Project

| Path | Keterangan |
|---|---|
| `Backend/app/` | Route FastAPI, konfigurasi, keamanan, dan business service. |
| `Backend/app/domain/` | Validasi dan presenter murni per domain mahasiswa/tagihan. |
| `Backend/app/repositories/` | Akses data terfokus untuk lookup publik dan reporting read-only. |
| `Backend/app/use_cases/` | Orkestrasi business flow lookup publik serta dashboard/financial reporting. |
| `Backend/db.py` | Koneksi, skema, dan migrasi SQLite. |
| `Backend/import_excel.py` | Preview, validasi, dan import workbook. |
| `Backend/test_core.py` | Unit dan integration test backend. |
| `Frontend/` | Portal mahasiswa dan bundle admin hasil build. |
| `Frontend-Admin/` | Source dashboard admin React. |
| `scripts/` | Utility pengembangan dan audit dependency. |
| `VERSION` | Sumber tunggal versi aplikasi untuk backend dan bundle admin. |

## Menjalankan di Lokal

### Prasyarat

- Python 3.10 atau lebih baru.
- Node.js 20.19 atau lebih baru (Node.js 22 direkomendasikan).
- npm.

### 1. Siapkan backend

Buka PowerShell dari root project:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Siapkan konfigurasi untuk sesi PowerShell lokal. Nilai berikut hanya contoh development dan jangan digunakan untuk production:

```powershell
$env:APP_ENV = "development"
$env:WEB_CONCURRENCY = "1"
$env:ADMIN_BOOTSTRAP_EMAIL = "admin@local.test"
$env:ADMIN_BOOTSTRAP_PASSWORD = "AdminLocal-123!"
$env:LOOKUP_HASH_SECRET = "local-development-secret-32-char"
```

Database SQLite lokal akan dibuat otomatis di `Backend/data/salut.sqlite` saat aplikasi pertama kali dijalankan. Akun bootstrap hanya dibuat ketika database belum memiliki admin.

### 2. Build dashboard admin

```powershell
Set-Location Frontend-Admin
npm install
npm run build
Set-Location ..
```

Hasil build disimpan di `Frontend/admin-dist/` dan disajikan langsung oleh FastAPI.

### 3. Jalankan aplikasi

```powershell
.\.venv\Scripts\python.exe -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Buka aplikasi melalui:

- Portal mahasiswa: `http://127.0.0.1:8000/`
- Portal admin: `http://127.0.0.1:8000/admin`
- Dokumentasi API: `http://127.0.0.1:8000/docs`

Login admin lokal menggunakan email dan password bootstrap yang diatur pada langkah pertama.

### Quality gate lokal

Dependency quality Python dipisahkan dari runtime production:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\ruff.exe check Backend scripts
.\.venv\Scripts\mypy.exe
python -m unittest Backend.test_core Backend.test_database_lifecycle Backend.test_operations Backend.test_version Backend.test_domain Backend.test_lookup
Set-Location Frontend-Admin
npm ci
npm run lint
npm test
npm run build
```

Versi aplikasi diubah hanya melalui file `VERSION`. FastAPI/OpenAPI, health check, metadata package admin, dan bundle Vite divalidasi agar memakai nilai yang sama. `release_id` tetap terpisah sebagai identitas commit/deployment.

### 4. Development frontend dengan hot reload

Biarkan backend berjalan pada port `8000`, lalu buka PowerShell kedua:

```powershell
Set-Location Frontend-Admin
npm run dev
```

Dashboard development tersedia di `http://localhost:5173/admin/`. Request `/api` akan diteruskan ke backend lokal.

## Menjalankan Test

Backend:

```powershell
.\.venv\Scripts\python.exe -m unittest Backend.test_core Backend.test_database_lifecycle Backend.test_operations
```

Build frontend:

```powershell
Set-Location Frontend-Admin
npm test
npm run build
```

## Catatan Keamanan Lokal

- Jangan commit file `.env`, database SQLite, workbook, backup, atau private key.
- Gunakan data sintetis ketika mendemonstrasikan aplikasi.
- Ganti kredensial bootstrap bila workspace digunakan bersama.
- Jangan menggunakan contoh secret dan password development untuk server publik.
- Pertahankan `WEB_CONCURRENCY=1`/`UVICORN_WORKERS=1` selama rate limiter masih in-memory; konfigurasi production akan fail-fast bila worker lebih dari satu.
- `docs/` dan `deploy/` adalah artefak internal dan tidak boleh dilacak pada repository publik.
- Jalankan `python scripts/check_public_repo_boundary.py` sebelum commit atau pull request.
- Kebijakan pelaporan kerentanan tersedia di [`SECURITY.md`](SECURITY.md).
