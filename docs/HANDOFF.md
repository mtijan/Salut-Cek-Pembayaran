# Handoff Salut Cek Pembayaran & SIAKAD Admin

Tanggal handoff: 2026-08-22

## Status Singkat

Remediasi audit P0-P2 telah dideploy tanpa Docker ke production pada revision `ec6d65f`. Health/revision, OpenAPI, HTTPS/API smoke, browser E2E sintetis, lima role, concurrency SQLite, backup/restore, maintenance, rate limit, Nginx, permission file, timer, dan disk telah diverifikasi. UAT yang mengubah data bisnis tetap dilakukan admin secara terpisah.

Jangan masukkan password admin, private key SSH, file SQLite produksi, backup, upload Excel pelanggan, workbook lokal, atau isi `.env` ke commit/dokumentasi.

## Kondisi Working Tree Saat Audit

Sebelum dokumentasi diubah, working tree sudah berisi perubahan pengguna pada:

- `Backend/app/main.py`, `Backend/app/services.py`, `Backend/db.py`, `Backend/schema.sql`, `Backend/test_core.py`;
- `Frontend-Admin/src/pages/BillsPage.jsx`, `Student360Modal.jsx`, dan `services/api.js`;
- bundle `Frontend/admin-dist/` (asset lama dihapus dan asset baru dibuat).

Perubahan tersebut menambahkan tabel/service/UI riwayat transaksi pembayaran. Remediasi P0 lokal 2026-08-22 memperbaiki route history, pagination React, validasi partial, dan Compose; audit juga membuka tracking `docs/` dengan menghapus ignore yang sebelumnya membuat seluruh dokumentasi tidak masuk Git.

## Sisa Pekerjaan Non-Blocker

1. UAT admin untuk mutasi status/due-date/import pada data bisnis yang disetujui.
2. Hardening CSP lanjutan: hapus `unsafe-inline` dan self-host font.
3. Integrasi alert disk eksternal provider pada 80%/90%.
4. P3 maintainability: pecah modul besar, frontend legacy, lint/type-check/CI, dan satu source version.

## Validasi Lokal Terakhir

| Command | Hasil |
|---|---|
| `.\.venv\Scripts\python.exe -m unittest Backend.test_core` | 58 test lulus lokal dan VPS; deprecation warning Starlette TestClient/cookie tetap ada. |
| `npm.cmd run build` (`Frontend-Admin`) | Lulus; bundle JS 319,56 kB. |
| `node --check Frontend/admin.js` | Lulus. |
| `docker compose config --quiet` | Lulus dengan secret non-placeholder; port bind loopback dan trusted proxy default false. |
| `npm.cmd audit` | 0 vulnerability. |
| `.\.venv\Scripts\python.exe -m pip check` | Lulus: tidak ada broken requirements dalam environment proyek terisolasi. |
| `.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --progress-spinner off` | Lulus: 0 known vulnerability dengan `pip-audit 2.10.1`; Starlette dinaikkan dari 0.37.2 ke 1.6.0 melalui FastAPI 0.141.1 setelah audit awal menemukan 9 advisory. |
| Route/schema inventory | 33 API operations; 12 tabel aplikasi. |

Dokumentasi perlu divalidasi ulang setelah seluruh edit dengan script `documentation_audit.py`, link check, OpenAPI parse, dan pencarian klaim stale.

## Urutan Aman Agent Berikutnya

1. Pantau journal, health, lookup 429, disk, dan timer selama 24 jam pertama.
2. Jalankan UAT admin pada data yang disetujui dan catat audit trail.
3. Kerjakan P3 secara incremental dengan regression test.
4. Pada release berikutnya: backup DB, pull fast-forward, install dependency sebagai user `salut`, pasang unit, restart, poll health/OpenAPI, dan ulangi smoke test.

## Git dan Safety

Repo dapat memunculkan `fatal: detected dubious ownership`. Jangan mengubah global Git config. Gunakan protected temporary/global config yang scoped ke proses atau minta pemilik mesin menetapkan safe directory secara sadar. Jangan reset dirty worktree dan jangan menyentuh SQLite/session/runtime production tanpa instruksi eksplisit.
