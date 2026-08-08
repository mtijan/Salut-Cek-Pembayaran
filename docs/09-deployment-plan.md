# Deployment Plan

## Target Platform

| Komponen | Platform |
|---|---|
| Web app | FastAPI service di VPS |
| API route | FastAPI route di service yang sama |
| Database | SQLite file di storage VPS |
| Auth | Internal auth berbasis database |
| Storage | Filesystem VPS untuk upload/import opsional |
| Reverse proxy | Nginx atau Caddy |
| Process manager | systemd |
| Domain | Registrar atau DNS provider eksternal |

## Environment

| Environment | Tujuan | Branch |
|---|---|---|
| Local | Development developer. | Local only |
| Staging | Review perubahan sebelum production. | `staging` atau release candidate |
| Production | Akses publik mahasiswa dan admin. | `main` |

## Environment Variables

| Nama | Scope | Secret? | Keterangan |
|---|---|---:|---|
| `DATABASE_URL` | Server only | Tidak | Path SQLite, contoh `/var/lib/salut-cek-pembayaran/salut.sqlite`. |
| `IMPORT_DIR` | Server only | Tidak | Folder preview XLSX sementara, di luar folder kode/webroot. |
| `APP_ENV` | Server only | Tidak | Wajib bernilai `production` pada VPS. |
| `ADMIN_BOOTSTRAP_EMAIL` | Server only | Ya | Email admin awal saat bootstrap, jika dibutuhkan. |
| `ADMIN_BOOTSTRAP_PASSWORD` | Server only | Ya | Password admin awal sementara, wajib diganti setelah login pertama. |
| `LOOKUP_HASH_SECRET` | Server | Ya | Salt/HMAC secret untuk hash NIM/IP logs. |
| `TRUST_PROXY_HEADERS` | Server only | Tidak | Bernilai `true` hanya di belakang reverse proxy tepercaya. |
| `DEFAULT_PROGRAM_STUDY` | Server only | Tidak | Label program studi default pada hasil lookup publik. |
| `DEFAULT_PAYMENT_PERIOD_LABEL` | Server only | Tidak | Label periode pembayaran default pada hasil lookup publik. |

## Deployment Flow

1. Developer membuat perubahan di branch fitur.
2. Pull request dibuat.
3. CI menjalankan lint, typecheck, test, dan build.
4. CI membuat build artifact atau hasil build siap deploy.
5. Reviewer memeriksa UI, API, migration, dan docs.
6. Setelah disetujui, merge ke `main`.
7. Developer/Ops pull release di VPS atau upload artifact.
8. Buat virtual environment, lalu install dependency dari `requirements.txt`.
9. Salin `Backend/.env.example` ke `/etc/salut-cek-pembayaran.env`, isi seluruh secret, lalu atur permission `600`.
10. Pasang unit dalam folder `deploy/`, Nginx, dan timer backup; aktifkan HTTPS di reverse proxy.
11. Jalankan migration SQLite dengan backup sebelum perubahan skema.
12. Restart service melalui systemd.
13. Smoke test production dijalankan.
14. Release notes diperbarui.

## Production Deployment

Production aktif pada `https://salutcektagihan.web.id` sejak 2026-08-02 dengan Nginx, HTTPS Let's Encrypt, service systemd, SQLite di storage VPS, dan timer backup harian. Tidak ada secret, database, atau file workbook yang dicatat pada dokumen ini.

## Database Migration Flow

| Langkah | Aturan |
|---|---|
| Buat migration | Semua perubahan skema harus melalui migration. |
| Review migration | Cek destructive change dan data migration. |
| Apply staging | Jalankan di environment staging bila tersedia. |
| Backup | Salin file SQLite dan upload/import penting sebelum production migration. |
| Apply production | Jalankan sesuai release window. |
| Verify | Cek endpoint utama dan data sampling. |

## Smoke Test Production

| ID | Check |
|---|---|
| SMK-001 | Halaman publik terbuka. |
| SMK-002 | Lookup data contoh berhasil. |
| SMK-003 | Lookup invalid aman dan tidak bocor data. |
| SMK-004 | Admin login berhasil. |
| SMK-005 | Admin dapat melihat dashboard. |
| SMK-006 | Metode pembayaran tampil sesuai konfigurasi. |
| SMK-007 | Audit log mencatat aksi smoke test. |
| SMK-008 | Lookup ke-11 dari IP yang sama menerima `429`. |
| SMK-009 | File XLSX dengan baris kritis tidak dapat di-commit. |

## Rollback Plan

| Kondisi | Tindakan |
|---|---|
| Frontend/API error | Rollback service VPS ke release sebelumnya dan restart service. |
| Migration bermasalah | Stop service, restore file SQLite dari backup, lalu restart. |
| Data import salah | Nonaktifkan batch import dan pulihkan data melalui audit/import history. |
| Secret bocor | Rotasi secret VPS, cabut session aktif, dan redeploy/restart service. |

## Monitoring Setelah Release

| Durasi | Fokus |
|---|---|
| 0 sampai 30 menit | Error 500, login admin, lookup publik. |
| 30 menit sampai 24 jam | Rate limit, feedback admin, performa query. |
| 1 minggu | Pola lookup gagal, kebutuhan fitur, data quality. |

## Production Readiness Gate

| Gate | Status Awal |
|---|---|
| Semua Must requirement rilis ini selesai. | Implemented, perlu UAT |
| Role check server-side untuk import aktif dan diuji. | Implemented, perlu UAT |
| Secret tersimpan di environment VPS dan tidak berada di webroot. | Verified 2026-08-02 |
| Backup SQLite otomatis diuji restore. | Verified 2026-08-02 |
| Backup plan disetujui. | Pending |
| Test utama lulus. | Local dan smoke test VPS verified; UAT admin pending |
| UAT admin selesai. | Pending |
| Rollback plan tersedia. | Available dengan backup SQLite terverifikasi |
