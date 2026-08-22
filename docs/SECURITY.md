# Security Policy

## Scope

Security policy ini berlaku untuk aplikasi Salut Cek Pembayaran, termasuk frontend, API, database, konfigurasi deployment, dan dokumen operasional.

## Data Sensitif

| Data | Perlakuan |
|---|---|
| Secret aplikasi | Secret server-only, tidak boleh masuk frontend atau Git. |
| File SQLite | Simpan di luar webroot, batasi permission, dan backup terenkripsi bila memungkinkan. |
| `.env` | Tidak boleh di-commit. Gunakan `.env.example` untuk template non-secret. |
| Bootstrap admin | Tidak ada default. Bootstrap pertama wajib menggunakan environment variable. |
| NIM | Identifier pribadi, gunakan hati-hati dan hash pada log. |
| Nama mahasiswa | Tampil penuh setelah NIM ditemukan. |
| Nominal tagihan | Tampil hanya setelah NIM ditemukan. |
| Tanggal lahir/HP | nama, tidak ditampilkan publik. |
| File import | Anggap sensitif, batasi akses dan retensi. |

## Reporting Vulnerability

Untuk fase awal proyek, vulnerability dilaporkan langsung ke pengelola proyek atau developer yang bertanggung jawab. Laporan ideal berisi:

| Field | Isi |
|---|---|
| Ringkasan | Deskripsi singkat masalah. |
| Dampak | Data/fitur yang terdampak. |
| Langkah reproduksi | Langkah teknis yang jelas. |
| Bukti | Screenshot, request ID, atau log aman. |
| Saran mitigasi | Opsional. |

Jangan menyertakan secret, dump database, atau data mahasiswa nyata dalam laporan yang tidak terenkripsi.

## Security Baseline

| Kontrol | Status Awal |
|---|---|
| Kontrol akses server-side untuk import sensitif. | Implemented |
| Admin authentication. | Implemented untuk MVP |
| Role based access control untuk import. | Implemented; viewer/history matrix masih open |
| Public lookup rate limit. | Implemented |
| CAPTCHA atau abuse protection. | Planned |
| Audit log login dan import. | Implemented |
| Backup SQLite otomatis. | Artefak tersedia; aktivasi dan uji restore VPS wajib |
| Secret scanning sebelum release. | Planned |
| Dependency audit. | npm 0 vulnerability; Python `pip check` dan `pip-audit 2.10.1` terisolasi lulus 0 known vulnerability pada 2026-08-21. |

## Python Dependency Audit

Audit Python wajib dijalankan dari environment khusus agar hasil tidak tercampur paket global:

```powershell
.\scripts\audit_python_dependencies.ps1
```

Skrip membuat `.venv-audit`, memasang runtime dependency dan `pip-audit` versi yang dikunci melalui `requirements-audit.txt`, kemudian menjalankan `pip check` dan `pip-audit -r requirements.txt`. Setiap broken requirement atau known vulnerability memblokir release sampai dependency diperbarui dan regression test lulus. Hasil audit bertanggal bukan jaminan permanen; jalankan ulang sebelum release.

## Open Security Findings 2026-08-21

- Compose kini memerlukan secret eksternal, bind ke loopback, dan default trusted proxy mati. Verifikasi environment `.env` serta topologi reverse proxy tetap wajib sebelum deployment.
- Endpoint payment history menolak seluruh role karena permission salah.
- CSP tidak kompatibel dengan inline style SPA/external font dan memerlukan perbaikan yang tetap ketat.
- Rate limiter per-process serta retensi log/backup belum cukup untuk deployment scale-out atau operasi jangka panjang.
- Export CSV perlu pencegahan spreadsheet formula injection.

## Pre-Commit Security Checklist

| Check |
|---|
| Tidak ada `.env`, token, private key, atau credential. |
| Tidak ada file import berisi data mahasiswa nyata. |
| Tidak ada backup database lokal. |
| Tidak ada file SQLite production atau export mahasiswa dalam repository. |
| Tidak ada log yang berisi NIM mentah secara massal. |
| Dokumentasi tidak memuat secret atau data mahasiswa nyata. |

## Incident Severity

| Severity | Contoh | Target Respons |
|---|---|---|
| Critical | Secret aplikasi bocor, data mahasiswa terbuka publik. | Segera containment dan rotasi secret. |
| High | Broken access control admin. | Perbaikan prioritas sebelum perubahan lain. |
| Medium | Rate limit bypass terbatas. | Jadwalkan fix cepat. |
| Low | Informasi error kurang ideal tanpa data sensitif. | Perbaiki pada patch berikutnya. |
