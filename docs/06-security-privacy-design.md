# Security dan Privacy Design

## Tujuan

Dokumen ini menetapkan desain keamanan dan privasi untuk melindungi data mahasiswa, data tagihan, akun admin, dan secret platform.

## Security Baseline

| Area | Kontrol |
|---|---|
| Secret management | Secret aplikasi hanya di environment file/server secrets di VPS. |
| Database access | File SQLite berada di luar webroot dan hanya diakses oleh proses server. |
| Admin auth | Internal auth, PBKDF2-SHA256, session validation, dan role check untuk import serta pengelolaan data. |
| Public lookup | NIM-only, response generik untuk data tidak ditemukan, dan rate limit 10 request per IP per 10 menit. |
| Rate limiting | Lookup dibatasi per IP; preview dan commit import dibatasi per admin di memori proses. |
| Audit logging | Catat aksi admin dan import data. |
| Error handling | Jangan tampilkan stack trace atau detail database ke user. |
| Transport security | HTTPS wajib. |

## Threat Model

| ID | Ancaman | Dampak | Mitigasi |
|---|---|---|---|
| TH-001 | Enumeration NIM | Orang lain melihat tagihan mahasiswa. | Rate limit, pesan error generik, lookup log ter-hash, dan monitoring lookup gagal. |
| TH-002 | Secret aplikasi bocor | Akses penuh database. | Simpan hanya di env server, scan secret, tidak commit `.env`. |
| TH-003 | Admin account takeover | Data tagihan diubah. | Password kuat, session expiry, audit log, role minimum, dan MFA bila ditambahkan. |
| TH-004 | Import file salah | Data tagihan rusak. | Preview, validasi kritis, commit atomik, dan audit log. |
| TH-005 | Injection | Query atau data rusak. | prepared statement SQLite atau ORM/query builder yang aman, validasi input. |
| TH-006 | Excessive data exposure | Kebocoran data pribadi. | Response DTO publik dibatasi pada NIM, nama, program studi default, periode pembayaran, dan data pembayaran yang diperlukan. |
| TH-007 | Broken access control | Admin biasa mengubah konfigurasi super admin. | RBAC di API, middleware role check, dan test akses negatif. |
| TH-008 | Log berisi data sensitif | Kebocoran lewat observability. | Hash NIM/IP, hindari logging request body penuh. |

## Privacy by Design

| Prinsip | Implementasi |
|---|---|
| Data minimization | Halaman publik hanya menampilkan informasi mahasiswa dan tagihan yang dibutuhkan untuk pembayaran. |
| Purpose limitation | Data digunakan untuk pengecekan tagihan SALUT Awwabin. |
| Access limitation | Admin melihat data sesuai role. |
| Retention limitation | File preview import yang tidak dipakai dibersihkan setelah 24 jam. Retensi lookup log ditetapkan oleh Ops. |
| Transparency | UI memberi informasi bahwa data dipakai untuk pengecekan tagihan. |
| Integrity | Data import divalidasi dan tercatat. |

## Public Data Exposure Policy

| Data | Tampil Publik? | Bentuk |
|---|---|---|
| NIM | Ya | NIM yang dimasukkan user atau sebagian. |
| Nama | Ya | Nama penuh setelah NIM ditemukan, juga dipakai sebagai nama rekening BRIVA. |
| Program studi | Ya | Nilai default konfigurasi rilis ini. |
| Nominal tagihan | Ya | Setelah verifikasi berhasil. |
| Status tagihan | Ya | Setelah verifikasi berhasil. |
| Nomor HP | Tidak | Tidak pernah tampil. |
| Tanggal lahir | Tidak | Tidak digunakan pada dataset MVP saat ini. |
| Email/alamat | Tidak | Tidak disimpan untuk MVP kecuali diperlukan. |

## Role Based Access Control

| Fitur / Modul | Viewer | Admin (SIAKAD & Keuangan) | Super Admin |
|---|:---:|:---:|:---:|
| Lihat Dashboard & Metrik | Ya (Read-only) | Ya | Ya |
| Lihat & Cari Mahasiswa | Belum (403) | Ya | Ya |
| Lihat Student Profile 360 | Belum (403) | Ya | Ya |
| Tambah / Ubah / Hapus Mahasiswa | Tidak | Ya | Ya |
| Lihat Daftar Tagihan | Belum (403) | Ya | Ya |
| Tambah / Ubah / Hapus Tagihan | Tidak | Ya | Ya |
| Ubah Status Pembayaran / Due Date | Tidak | Ya | Ya |
| Import File XLSX (Preview & Commit) | Tidak | Ya | Ya |
| Lihat Rekapitulasi Keuangan & Ekspor | Ya | Ya | Ya |
| Kelola Master Program Studi | Tidak | Ya | Ya |
| Kelola Master Periode Akademik | Tidak | Ya | Ya |
| Hapus Batch File Import | Tidak | Ya | Ya |
| Lihat Riwayat Pembayaran | Ya (`view_reports`) | Ya | Ya |
| Kelola Akun Admin & Hak Akses | Tidak | Tidak | Belum ada API/UI |
| Lihat Audit Log Lengkap | Belum ada API/UI | Belum ada API/UI | Belum ada API/UI |

Matrix ini mencatat perilaku aktual, bukan target. Target viewer read-only lintas modul tetap FR-028, tetapi belum tercapai. Sidebar saat ini juga masih menampilkan menu yang akan gagal `403` untuk viewer.

## Access Policy Konseptual

| Tabel | Policy |
|---|---|
| `students` | Admin aktif dapat read/write sesuai role. Public tidak punya akses langsung. |
| `bills` | Admin aktif dapat read/write sesuai role. Public tidak punya akses langsung. |
| `payment_methods` | Belum diimplementasikan pada rilis ini; instruksi pembayaran saat ini berasal dari data tagihan/default aplikasi. |
| `audit_logs` | Insert dilakukan proses server; endpoint/UI read belum tersedia. Banyak mutasi dan audit masih memakai transaksi terpisah. |
| `payment_transactions` | Insert dilakukan service saat perubahan manual status/paid_amount. Route read sedang salah permission. Append-only baru policy aplikasi, belum constraint database. |
| `lookup_logs` | Insert melalui API. Read admin terbatas. |

## Rate Limit Awal

| Endpoint | Limit Awal |
|---|---|
| `POST /api/lookup` | 10 request per IP per 10 menit. |
| `POST /api/admin/import/preview` | 20 request per admin per jam. |
| `POST /api/admin/import/commit` | 10 request per admin per jam. |
| Login admin | 5 percobaan gagal per akun/IP per 15 menit, plus monitoring gagal login. |

## Security Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| SEC-001 | Secret tidak boleh berada di repository. | `.env*` diignore kecuali `.env.example`; scan manual sebelum commit. |
| SEC-002 | Public lookup harus memakai NIM. | Endpoint menolak lookup tanpa NIM. |
| SEC-003 | Response publik hanya mengirim identitas dan data pembayaran yang diperlukan. | Hasil lookup memuat NIM, nama, program studi default, periode pembayaran, dan detail tagihan setelah NIM ditemukan; alamat, email, dan HP tidak dikirim. |
| SEC-004 | API admin harus memvalidasi role. | Request tanpa role sesuai ditolak 403. |
| SEC-005 | Audit log wajib untuk perubahan data penting. | Create/update/delete/import menghasilkan audit log. |
| SEC-006 | Error tidak membocorkan detail internal. | Response 500 hanya menampilkan request ID. |
| SEC-007 | Import file harus divalidasi. | Commit ditolak bila ada error kritis pada validasi workbook Excel. |

## Incident Response Ringkas

| Tahap | Tindakan |
|---|---|
| Identify | Kumpulkan request ID, audit log, deployment version, dan waktu kejadian. |
| Contain | Rotasi secret, disable admin terdampak, aktifkan maintenance bila perlu. |
| Eradicate | Perbaiki bug/policy, hapus file sensitif, patch dependency. |
| Recover | Deploy versi aman, validasi data, pantau log. |
| Lessons learned | Update risk register, test case, dan SOP. |

## Checklist Pre-Production Security

| Check | Status |
|---|---|
| `.env` tidak tracked Git. | Implemented; verifikasi sebelum release. |
| File SQLite berada di luar webroot dan permission file dibatasi. | Konfigurasi VPS wajib. |
| Secret aplikasi hanya di environment VPS. | Compose meminta secret dari `.env`; VPS tetap wajib menggunakan environment file berpermission ketat. |
| Password admin di-hash dengan algoritma kuat. | Implemented. |
| Public endpoint punya rate limit. | Implemented. |
| Public response informasi pembayaran diuji. | Implemented. |
| Admin endpoint punya role check. | Partial; history memakai `view_reports`, tetapi matrix viewer lintas modul masih belum konsisten. |
| Audit log diuji. | Penulisan ada, tetapi atomicity dengan mutasi dan endpoint read belum selesai. |
| Dependency audit dijalankan. | npm audit 0 vulnerability; `pip check` dan `pip-audit 2.10.1` dalam environment terisolasi juga lulus 0 known vulnerability pada 2026-08-21. |

## Known Security Gaps 2026-08-22

- Docker direct exposure aman secara default karena bind loopback dan trusted proxy mati; topologi reverse proxy production tetap perlu diverifikasi.
- Limiter hanya berada di memory proses, tidak shared dan key lifecycle belum dibersihkan.
- CSP saat ini memblokir inline style SPA dan external font; perbaikan harus mempertahankan policy ketat tanpa sekadar menambahkan `unsafe-inline` secara permanen.
- Export CSV perlu mitigasi spreadsheet formula injection.
- Credential bootstrap tetap ada pada env production untuk bootstrap pertama; lifecycle secret dan akun admin perlu didesain ulang.
