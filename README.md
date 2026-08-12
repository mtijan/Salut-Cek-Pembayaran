# Salut Cek Pembayaran

Aplikasi web untuk membantu mahasiswa Universitas Terbuka yang berafiliasi dengan SALUT Awwabin mengecek tagihan dan melihat instruksi pembayaran secara mandiri.

## Status

Baseline production berjalan di VPS dengan FastAPI/Uvicorn, frontend publik, login admin, import workbook Excel, kontrol rate limit dasar, dan SQLite. Perubahan `Unreleased` tetap harus divalidasi, dicommit, dipush, dan dideploy sebelum dianggap aktif di VPS.

## Target MVP

- Mahasiswa dapat mencari tagihan menggunakan NIM.
- Sistem menampilkan tagihan, status pembayaran, nomor BRIVA, dan cara pembayaran; bila satu NIM punya beberapa tagihan, nominal tampil sebagai `Tagihan 1`, `Tagihan 2`, dan seterusnya lalu dijumlahkan menjadi `Total Tagihan`.
- Admin SALUT dapat login, mengimpor workbook tagihan dengan nama file apa pun selama struktur header sesuai template resmi, melihat data per nama file import, mengatur status `Belum lunas`, `Bayar sebagian`, atau `Lunas`, serta mengubah batas aktif pembayaran.
- Sistem mencatat audit penting seperti import data, login admin, dan pencarian tagihan.
- Deployment awal menggunakan VPS dan SQLite.

## Dokumentasi

Dokumentasi awal disusun agar selaras dengan praktik ISO/IEC/IEEE dan pengembangan software modern:

- [Portal Dokumentasi HTML](docs/index.html)
- [Standar dan Metodologi](docs/00-standards-and-methodology.md)
- [Product Requirements](docs/01-product-requirements.md)
- [System Design](docs/02-system-design.md)
- [Diagram Sistem](docs/03-diagrams.md)
- [Database Design](docs/04-database-design.md)
- [API Contract](docs/05-api-contract.md)
- [Security dan Privacy Design](docs/06-security-privacy-design.md)
- [Admin dan Operasional](docs/07-admin-operations.md)
- [Test dan Quality Plan](docs/08-test-quality-plan.md)
- [Deployment Plan](docs/09-deployment-plan.md)
- [Project Management Plan](docs/10-project-management.md)
- [Risk Register](docs/11-risk-register.md)
- [Requirements Traceability Matrix](docs/12-traceability-matrix.md)
- [Change dan Release Plan](docs/13-change-release-plan.md)
- [Changelog](docs/CHANGELOG.md)
- [Security Policy](docs/SECURITY.md)
- [Runbook](docs/RUNBOOK.md)

Untuk membaca dokumentasi dalam tampilan yang lebih nyaman, buka file `docs/index.html` langsung dari browser.

## Rekomendasi Stack

- Backend: FastAPI dan Uvicorn di VPS.
- Frontend: HTML, CSS, dan JavaScript statis.
- Database: SQLite.
- Auth admin: session/password internal berbasis database.
- File import: upload langsung melalui API route dan penyimpanan file mentah di Filesystem VPS bila diperlukan.
- Security: pemeriksaan role server-side, prepared statement SQLite, rate limit, cookie aman di production, audit log, dan backup SQLite terjadwal.

## Struktur Project

| Folder | Isi |
|---|---|
| `Backend/` | API lookup, schema SQLite, importer Excel. |
| `Frontend/` | Halaman cek pembayaran mahasiswa dan dashboard admin import/CRUD manual. |
| `docs/` | Dokumentasi requirement, desain, deployment, dan runbook. |

## Menjalankan Lokal

```powershell
python -m unittest Backend.test_core
python -m py_compile Backend\*.py Backend\app\*.py
node --check .\Frontend\app.js
node --check .\Frontend\admin.js
python .\Backend\import_excel.py
python -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000
```

Buka `http://127.0.0.1:8000`, lalu coba data contoh:

| NIM |
|---|
| `050117077` |

Sebelum bootstrap admin pertama, set `ADMIN_BOOTSTRAP_EMAIL` dan `ADMIN_BOOTSTRAP_PASSWORD`. Untuk VPS juga wajib set `APP_ENV=production` dan `LOOKUP_HASH_SECRET`; lihat [template environment](Backend/.env.example) dan [panduan deployment](docs/09-deployment-plan.md).

## Catatan Keamanan

NIM bukan rahasia kuat. Lookup publik tetap hanya meminta NIM, lalu menampilkan nama mahasiswa, program studi default, periode pembayaran, dan detail BRIVA agar mahasiswa dapat memverifikasi tagihan. Risiko enumeration dikurangi dengan response error generik, lookup log ter-hash, rate limit 10 request per IP per 10 menit, dan monitoring lookup gagal.
