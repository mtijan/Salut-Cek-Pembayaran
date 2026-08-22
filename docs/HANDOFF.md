# Handoff Salut Cek Pembayaran & SIAKAD Admin

Tanggal handoff: 2026-08-21

## Status Singkat

Audit menyeluruh dan sinkronisasi dokumentasi telah dilakukan pada checkout lokal. Tidak ada code application bug yang diperbaiki dalam pekerjaan audit ini; perubahan backend/frontend yang sudah ada tetap dipertahankan. Release baru berstatus **blocked** sampai temuan High pada `docs/14-codebase-audit-mitigation-plan.md` ditutup.

Jangan masukkan password admin, private key SSH, file SQLite produksi, backup, upload Excel pelanggan, workbook lokal, atau isi `.env` ke commit/dokumentasi.

## Kondisi Working Tree Saat Audit

Sebelum dokumentasi diubah, working tree sudah berisi perubahan pengguna pada:

- `Backend/app/main.py`, `Backend/app/services.py`, `Backend/db.py`, `Backend/schema.sql`, `Backend/test_core.py`;
- `Frontend-Admin/src/pages/BillsPage.jsx`, `Student360Modal.jsx`, dan `services/api.js`;
- bundle `Frontend/admin-dist/` (asset lama dihapus dan asset baru dibuat).

Perubahan tersebut menambahkan tabel/service/UI riwayat transaksi pembayaran. Remediasi P0 lokal 2026-08-22 memperbaiki route history, pagination React, validasi partial, dan Compose; audit juga membuka tracking `docs/` dengan menghapus ignore yang sebelumnya membuat seluruh dokumentasi tidak masuk Git.

## Blocker Utama

1. Review dan koreksi data `partial` historis yang mungkin dibuat oleh fallback 50% sebelum rilis.
2. Browser E2E/visual pagination dengan lebih dari 100 tagihan belum ada.
3. Migrasi/seed berjalan pada banyak read path dan mutasi bisnis belum atomik dengan audit log.
4. Viewer RBAC lintas modul, recreate NIM soft-deleted, seeded prodi, CSP, validasi domain, retensi, laporan periode, CSV injection, dan maintainability masih terbuka.

Temuan lain: viewer RBAC/UI mismatch, recreate NIM soft-deleted gagal, seeded prodi yang dihapus muncul lagi, CSP tidak cocok dengan inline style SPA, validasi domain lemah, retensi tidak otomatis, laporan belum per periode, CSV injection, dan debt maintainability.

## Validasi Lokal Terakhir

| Command | Hasil |
|---|---|
| `.\.venv\Scripts\python.exe -m unittest Backend.test_core` | 50 test lulus; deprecation warning Starlette TestClient/cookie tetap ada. |
| `npm.cmd run build` (`Frontend-Admin`) | Lulus; bundle JS 319,56 kB. |
| `node --check Frontend/admin.js` | Lulus. |
| `docker compose config --quiet` | Lulus dengan secret non-placeholder; port bind loopback dan trusted proxy default false. |
| `npm.cmd audit` | 0 vulnerability. |
| `.\.venv\Scripts\python.exe -m pip check` | Lulus: tidak ada broken requirements dalam environment proyek terisolasi. |
| `.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --progress-spinner off` | Lulus: 0 known vulnerability dengan `pip-audit 2.10.1`; Starlette dinaikkan dari 0.37.2 ke 1.6.0 melalui FastAPI 0.141.1 setelah audit awal menemukan 9 advisory. |
| Route/schema inventory | 33 API operations; 12 tabel aplikasi. |

Dokumentasi perlu divalidasi ulang setelah seluruh edit dengan script `documentation_audit.py`, link check, OpenAPI parse, dan pencarian klaim stale.

## Urutan Aman Agent Berikutnya

1. Review perubahan P0 serta data partial historis dengan admin sebelum release.
2. Tambahkan browser E2E/visual untuk pagination dan CSP.
3. Jalankan seluruh test/build/audit, termasuk `.\scripts\audit_python_dependencies.ps1`.
4. Pisahkan migration dari service read dan satukan transaction boundary audit secara incremental, bukan rewrite besar.
5. Review `git status` dan diff; pastikan workbook/log/database/temp config tidak ikut stage.
6. Commit/push hanya setelah approval user.
7. Deployment adalah pekerjaan terpisah: backup DB, pull revision, migrate/restart, poll `/api/health`, cek `/openapi.json`, hard refresh SPA, smoke test role/history/pagination, dan verifikasi release ID.

## Git dan Safety

Repo dapat memunculkan `fatal: detected dubious ownership`. Jangan mengubah global Git config. Gunakan protected temporary/global config yang scoped ke proses atau minta pemilik mesin menetapkan safe directory secara sadar. Jangan reset dirty worktree dan jangan menyentuh SQLite/session/runtime production tanpa instruksi eksplisit.
