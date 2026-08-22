# Deploy VPS

Artefak ini menjalankan aplikasi FastAPI/Uvicorn di belakang Nginx dengan service Python yang hanya mendengar pada `127.0.0.1:8000`.

1. Salin project ke `/opt/salut-cek-pembayaran` dan buat user sistem `salut`.
2. Buat folder `/var/lib/salut-cek-pembayaran`, `/var/lib/salut-cek-pembayaran/imports`, dan `/var/backups/salut-cek-pembayaran`; jadikan semuanya milik user `salut`.
3. Buat virtual environment di `/opt/salut-cek-pembayaran/.venv` dan install dependency dari `requirements.txt`.
4. Salin `Backend/.env.example` menjadi `/etc/salut-cek-pembayaran.env`, isi secret unik, pertahankan `RELEASE_ID=auto`, lalu jalankan `chmod 600 /etc/salut-cek-pembayaran.env`.
5. Salin `nginx-rate-limit.conf` ke `/etc/nginx/conf.d/`, ganti domain pada `nginx-salut-cek-pembayaran.conf`, uji `nginx -t`, lalu reload Nginx dan aktifkan HTTPS.
6. Salin seluruh file `.service` dan `.timer` ke `/etc/systemd/system/`, lalu jalankan `systemctl daemon-reload`.
7. Aktifkan `salut-cek-pembayaran.service`, `salut-cek-pembayaran-backup.timer`, `salut-cek-pembayaran-maintenance.timer`, dan `salut-cek-pembayaran-backup-verify.timer`.
8. Jalankan smoke test pada `docs/09-deployment-plan.md`, termasuk login admin, lookup, pembatasan request, rotasi backup, dan restore backup uji.

Jangan menyimpan file environment, database SQLite, workbook mahasiswa, atau backup dalam Git maupun webroot.

Retensi default: session kedaluwarsa 7 hari, lookup log 90 hari, issue import 180 hari, dan preview/file import 24 jam. Audit log tidak dipangkas otomatis. Backup mempertahankan 14 harian, 8 mingguan, dan 12 bulanan; timer verifikasi bulanan mengekstrak backup terbaru sementara dan menjalankan SQLite `integrity_check`.
