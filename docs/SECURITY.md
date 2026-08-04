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
| Nama mahasiswa | Masking pada halaman publik. |
| Nominal tagihan | Tampil hanya setelah verifikasi berhasil. |
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
| Role based access control untuk import. | Implemented |
| Public lookup rate limit. | Implemented |
| CAPTCHA atau abuse protection. | Planned |
| Audit log login dan import. | Implemented |
| Backup SQLite otomatis. | Artefak tersedia; aktivasi dan uji restore VPS wajib |
| Secret scanning sebelum release. | Planned |
| Dependency audit. | Planned |

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
