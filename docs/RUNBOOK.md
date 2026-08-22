# Runbook

## Tujuan

Runbook ini menjadi panduan cepat untuk menjalankan, memeriksa, dan menangani masalah operasional aplikasi Salut Cek Pembayaran.

## Status Saat Ini

Aplikasi production aktif di `https://salutcektagihan.web.id` dengan backend FastAPI/Uvicorn, frontend statis, importer XLSX, SQLite, rate limit in-memory, Nginx HTTPS, systemd, dan backup harian.

Pernyataan tersebut adalah baseline historis. Audit lokal 2026-08-21 tidak memverifikasi VPS current dan working tree Unreleased masih memiliki release blocker. Cocokkan Git revision dengan `/api/health.release_id`, cek `/openapi.json`, lalu smoke test SPA sebelum menyatakan production terbaru.

## Local Development

```powershell
# 1. Menjalankan Unit Tests & Validasi
python -m unittest Backend.test_core

# 2. Build Frontend Admin (React + Vite SPA)
cd Frontend-Admin
npm install
npm run build
cd ..

# 3. Menjalankan Backend Server (FastAPI)
python -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **URL Publik (Lookup Mahasiswa)**: `http://127.0.0.1:8000/`
- **URL Admin Workspace (React SPA)**: `http://127.0.0.1:8000/admin`
- **URL Dev Vite (Opsional HMR)**: `http://localhost:5173/admin/` (dari folder `Frontend-Admin` via `npm run dev`)

Untuk memeriksa production, gunakan `systemctl status salut-cek-pembayaran.service`, `systemctl status salut-cek-pembayaran-backup.timer`, dan `https://salutcektagihan.web.id/api/health` melalui akses ops yang berwenang.

Set `ADMIN_BOOTSTRAP_EMAIL` dan `ADMIN_BOOTSTRAP_PASSWORD` sebelum bootstrap admin pertama. Tidak ada kredensial default di aplikasi.

## Environment Variables

Lihat `docs/09-deployment-plan.md` untuk daftar environment variable. Jangan menyimpan secret di repository.

## Health Check

| Check | Cara |
|---|---|
| Halaman publik | Buka URL aplikasi. |
| API health | Pastikan `status`, `version`, dan `release_id` sesuai release yang direncanakan. |
| API lookup | Jalankan lookup data contoh. |
| Admin auth | Login sebagai admin test. |
| Database | Cek koneksi SQLite dan migration status. |
| Logs | Cek journal systemd, log reverse proxy, dan audit log aplikasi. |
| Retensi/disk | Timer maintenance harian memangkas session expired >7 hari, lookup log >90 hari, issue import >180 hari, serta preview/file import expired. Audit log tidak dipangkas otomatis. Cek backup, `systemctl status` timer, dan kapasitas disk. |

## Incident: Lookup Publik Gagal

1. Cek apakah service aplikasi di VPS aktif.
2. Cek `DATABASE_URL` dan permission file SQLite.
3. Cek koneksi SQLite dari proses aplikasi.
4. Cek apakah data mahasiswa dan tagihan ada.
5. Cek rate limit dan lookup logs.
6. Bila error 500, ambil `request_id` dan cek server logs.

## Incident: Admin Tidak Bisa Login

1. Cek `APP_ENV`, `LOOKUP_HASH_SECRET`, dan konfigurasi auth internal.
2. Pastikan user admin ada di tabel `admin_users`.
3. Pastikan password hash valid dan belum perlu reset.
4. Pastikan `is_active = true`.
5. Pastikan role sesuai.

## Incident: Import Salah

1. Identifikasi token import dan nama file pada audit log.
2. Cek jumlah row valid, kritis, dan warning.
3. Jika commit sudah terjadi, cek audit log dan lakukan import ulang dengan workbook koreksi.
4. Dokumentasikan penyebab dan tindakan perbaikan.

## Incident: Secret Bocor

1. Cabut atau rotasi secret di VPS.
2. Restart atau redeploy aplikasi.
3. Cek audit log dan akses mencurigakan.
4. Hapus secret dari commit history bila sudah terlanjur committed.
5. Update risk register dan checklist.

## Deployment Verification

| Step | Expected |
|---|---|
| Build selesai | Tidak ada error. |
| Public page terbuka | Form tampil. |
| Lookup valid | Data contoh tampil aman. |
| Lookup invalid | Pesan generik. |
| Admin login | Dashboard tampil. |
| Admin import preview | Jumlah valid, kritis, warning, perubahan sensitif, dan multiple bill sesuai workbook yang diuji. |
| Admin import commit | Import selesai dan audit tercatat. |
| Admin status tagihan | `Belum lunas`, `Bayar sebagian`, dan `Lunas` dapat disimpan. |
| Admin batas aktif | Batas aktif satu tagihan dan massal per file import dapat disimpan. |
| Audit log | Aksi login, preview, dan commit tercatat. |

## Escalation

| Kondisi | Eskalasi |
|---|---|
| Data pribadi terekspos | Pengelola SALUT dan Developer/Ops segera. |
| Pembayaran salah tujuan | Pengelola SALUT segera. |
| Aplikasi down produksi | Developer/Ops. |
| Import data salah massal | Admin SALUT dan Developer/Ops. |
