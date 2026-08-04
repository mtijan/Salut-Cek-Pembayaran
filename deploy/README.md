# Deploy VPS

Artefak ini menjalankan aplikasi di belakang Nginx dengan service Python yang hanya mendengar pada `127.0.0.1:8000`.

1. Salin project ke `/opt/salut-cek-pembayaran` dan buat user sistem `salut`.
2. Buat folder `/var/lib/salut-cek-pembayaran`, `/var/lib/salut-cek-pembayaran/imports`, dan `/var/backups/salut-cek-pembayaran`; jadikan semuanya milik user `salut`.
3. Salin `Backend/.env.example` menjadi `/etc/salut-cek-pembayaran.env`, isi secret unik, lalu jalankan `chmod 600 /etc/salut-cek-pembayaran.env`.
4. Ganti `example.com` pada `nginx-salut-cek-pembayaran.conf`, pasang konfigurasi ke Nginx, lalu aktifkan sertifikat HTTPS dengan Certbot atau sertifikat organisasi.
5. Salin dua file `.service` dan file `.timer` ke `/etc/systemd/system/`, lalu jalankan `systemctl daemon-reload`.
6. Aktifkan `salut-cek-pembayaran.service` dan `salut-cek-pembayaran-backup.timer`, kemudian cek `systemctl status` keduanya.
7. Jalankan smoke test pada `docs/09-deployment-plan.md`, termasuk login admin, lookup, pembatasan request, dan restore backup uji.

Jangan menyimpan file environment, database SQLite, workbook mahasiswa, atau backup dalam Git maupun webroot.
