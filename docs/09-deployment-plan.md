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
| `RELEASE_ID` | Server only | Tidak | Identitas release non-rahasia yang tampil pada `/api/health`; gunakan ID yang sama dengan commit rilis. |
| `DEFAULT_PROGRAM_STUDY` | Server only | Tidak | Label program studi default pada hasil lookup publik. |
| `DEFAULT_PAYMENT_PERIOD_LABEL` | Server only | Tidak | Label periode pembayaran default pada hasil lookup publik. |
| `SESSION_RETENTION_DAYS` | Server only | Tidak | Retensi session kedaluwarsa; default `7`. |
| `LOOKUP_LOG_RETENTION_DAYS` | Server only | Tidak | Retensi lookup log; default `90`. |
| `IMPORT_ISSUE_RETENTION_DAYS` | Server only | Tidak | Retensi issue import; default `180`. |

## Deployment Flow

1. Developer membuat perubahan di branch fitur.
2. Pull request dibuat.
3. CI menjalankan test backend (`python -m unittest Backend.test_core`) dan build frontend React SPA (`cd Frontend-Admin && npm run build`).
4. CI membuat build artifact (`Frontend/admin-dist/`) siap disajikan oleh FastAPI.
5. Reviewer memeriksa UI, API, migration, dan docs.
6. Setelah disetujui, merge ke `main`.
7. Developer/Ops pull release di VPS atau upload artifact.
8. Buat virtual environment, install dependency dari `requirements.txt`, dan build frontend admin.
9. Salin `Backend/.env.example` ke `/etc/salut-cek-pembayaran.env`, isi seluruh secret, lalu atur permission `600`.
10. Salin `deploy/nginx-rate-limit.conf` ke `/etc/nginx/conf.d/`, pasang konfigurasi site Nginx, lalu validasi dengan `nginx -t` sebelum reload.
11. Salin seluruh file `.service` dan `.timer` dari `deploy/` ke `/etc/systemd/system/`, lalu jalankan `systemctl daemon-reload`.
12. Aktifkan application, backup, maintenance, dan verifikasi backup timer dengan perintah pada bagian **Operasi Retensi, Backup, dan Rate Limit**.
13. Aktifkan HTTPS di reverse proxy.
14. Jalankan migration SQLite dengan backup sebelum perubahan skema.
15. Restart service melalui systemd (`systemctl restart salut-cek-pembayaran.service`).
16. Smoke test production dijalankan.
17. Release notes diperbarui.

## Operasi Retensi, Backup, dan Rate Limit

### Aktivasi VPS

```bash
sudo install -m 0644 deploy/nginx-rate-limit.conf /etc/nginx/conf.d/salut-rate-limit.conf
sudo install -m 0644 deploy/nginx-salut-cek-pembayaran.conf /etc/nginx/sites-available/salut-cek-pembayaran.conf
sudo nginx -t && sudo systemctl reload nginx

sudo cp deploy/*.service deploy/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now salut-cek-pembayaran.service
sudo systemctl enable --now salut-cek-pembayaran-backup.timer
sudo systemctl enable --now salut-cek-pembayaran-maintenance.timer
sudo systemctl enable --now salut-cek-pembayaran-backup-verify.timer
sudo systemctl list-timers 'salut-cek-pembayaran-*'
```

`nginx-rate-limit.conf` harus berada di `/etc/nginx/conf.d/` agar `limit_req_zone` dibaca di konteks `http`. Layer Nginx membatasi lookup, login, dan import per IP; limiter aplikasi tetap berlaku sebagai lapisan tambahan per scope.

### Kebijakan Retensi dan Backup

| Data | Kebijakan | Mekanisme |
|---|---|---|
| Session admin kedaluwarsa | Hapus setelah 7 hari | `salut-cek-pembayaran-maintenance.timer` setiap hari 02:00. |
| Lookup log | Hapus setelah 90 hari | Timer maintenance. |
| Issue import | Hapus setelah 180 hari | Timer maintenance. |
| Preview/file import | Hapus setelah 24 jam | Timer maintenance dan cleanup aplikasi. |
| Audit log | Tidak dihapus otomatis | Review manual hingga kebijakan retensi formal disetujui. |
| Backup SQLite | 14 harian, 8 mingguan, 12 bulanan | Timer backup harian menjalankan rotasi aman. |
| Verifikasi backup | Bulanan, tanggal 1 pukul 03:15 | Timer mengekstrak backup terbaru ke lokasi sementara dan menjalankan `PRAGMA integrity_check`. |

Verifikasi manual yang dapat dijalankan Ops:

```bash
sudo systemctl status salut-cek-pembayaran-maintenance.timer
sudo systemctl status salut-cek-pembayaran-backup.timer
sudo systemctl status salut-cek-pembayaran-backup-verify.timer
sudo journalctl -u salut-cek-pembayaran-maintenance.service -n 50 --no-pager
sudo journalctl -u salut-cek-pembayaran-backup-verify.service -n 50 --no-pager
sudo -u salut sh -c 'cd /opt/salut-cek-pembayaran && .venv/bin/python -m Backend.verify_backup --directory /var/backups/salut-cek-pembayaran'
df -h /var/lib/salut-cek-pembayaran /var/backups/salut-cek-pembayaran
```

Atur alert disk pada monitoring VPS/provider saat penggunaan mencapai 80% dan eskalasi wajib pada 90%. Kredensial notifikasi tidak disimpan dalam repository; integrasi email/Telegram/monitoring dilakukan di lingkungan Ops.

## Production Deployment

Production diverifikasi langsung pada 2026-08-22 di `https://salutcektagihan.web.id` tanpa Docker. Revision aktif `ec6d65f`; health/Git HEAD cocok, OpenAPI 200, Nginx valid, Uvicorn aktif di loopback, tiga timer aktif, backup/restore lulus, SQLite schema v2 memakai WAL dan integrity `ok`, serta disk terpakai 12%.

Smoke API production lulus untuk halaman publik, lookup, admin session, dashboard/laporan, pagination/filter/history, dan bundle SPA. Production memiliki 596 tagihan/6 halaman. Browser pagination memakai bundle release yang sama dan 105 data sintetis agar data production tidak keluar VPS: halaman pertama 100 row, halaman kedua 5 row, navigasi kembali berhasil, 0 console severe error, dan 0 CSP violation. Lima role serta 40 concurrent writes diuji pada salinan sementara database production yang dihapus setelah test.

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
| SMK-006 | Status `Belum lunas`, `Bayar sebagian`, dan `Lunas` dapat disimpan dari dashboard admin. |
| SMK-007 | Audit log mencatat aksi smoke test. |
| SMK-008 | Lookup ke-11 dari IP yang sama menerima `429`. |
| SMK-009 | File XLSX dengan baris kritis tidak dapat di-commit. |
| SMK-010 | Batas aktif pembayaran dapat disimpan pada satu tagihan dan massal per file import. |
| SMK-011 | `/api/health` hanya menampilkan `status`, `version`, dan `release_id`. |
| SMK-012 | File import dapat dihapus dari dashboard admin dengan alasan wajib (soft delete). |
| SMK-013 | Paginasi 100 data/halaman serta filter status dan sumber pada Data Mahasiswa berfungsi. |
| SMK-014 | Timer maintenance, backup, dan verifikasi backup aktif; journal tidak menunjukkan error. |
| SMK-015 | Verifikasi backup manual lulus dan disk backup tidak melewati ambang alert. |

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
| Semua Must requirement rilis ini selesai. | Lulus untuk gate teknis P0-P2; lihat audit untuk debt P3. |
| Role check server-side untuk import aktif dan diuji. | Lulus positif/negatif untuk lima role pada salinan production. |
| Secret tersimpan di environment VPS dan tidak berada di webroot. | Lulus; env `600 root:root`, database `600 salut:salut`. |
| Backup SQLite otomatis dan restore uji. | Lulus; backup dibuat sebelum migration dan restore sementara terverifikasi. |
| Backup plan disetujui. | Timer retensi, backup, dan verifikasi aktif. |
| Test utama lulus. | 58 test lokal/VPS, build/audit dependency, smoke HTTPS/API, browser sintetis, RBAC, concurrency, dan restore lulus. |
| UAT admin selesai. | Smoke read-only selesai; UAT mutasi data bisnis tetap tanggung jawab admin. |
| Rollback plan tersedia. | Prosedur dan backup current terverifikasi. |

`docker-compose.yml` meminta secret dari `.env`, hanya bind port aplikasi ke `127.0.0.1`, dan default `TRUST_PROXY_HEADERS=false`. Salin `.env.docker.example` menjadi `.env`, isi secret unik minimal 32 karakter, lalu gunakan `TRUST_PROXY_HEADERS=true` hanya jika akses dipaksa melalui reverse proxy tepercaya. Compose bukan pengganti hardening VPS/Nginx atau verifikasi deployment.
