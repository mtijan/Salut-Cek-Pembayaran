# System Design

## Ringkasan Arsitektur

Aplikasi menggunakan arsitektur web single-server VPS:

- Backend Python berjalan sebagai service di VPS, di depan reverse proxy Nginx atau Caddy.
- Frontend statis berada di folder `Frontend/` dan dapat disajikan oleh backend.
- SQLite menjadi database utama dengan file database tersimpan di storage VPS yang dibackup berkala.
- Auth admin memakai session/password internal berbasis database.
- File import mentah disimpan di Filesystem VPS bila retensi disetujui.
- API route mengatur seluruh akses data agar file SQLite dan secret aplikasi tidak pernah dapat diakses dari browser.

## Komponen

| Komponen | Tanggung Jawab |
|---|---|
| Public Web | Form cek tagihan NIM dan halaman hasil untuk mahasiswa. |
| Admin Web | Dashboard admin untuk data mahasiswa, tagihan, import, dan metode pembayaran. |
| API Layer | Validasi input, rate limit, query server-side, dan logging lookup. |
| Internal Auth | Login admin, password hashing, session management, dan role check. |
| SQLite | Penyimpanan mahasiswa, tagihan, pembayaran, audit, konfigurasi. |
| Filesystem VPS | Penyimpanan file import mentah jika dibutuhkan. |
| Reverse Proxy | HTTPS termination, routing, compression, dan basic hardening. |
| Process Manager | Menjalankan service aplikasi, restart otomatis, dan log runtime. |
| Observability | Log aplikasi, audit log, health check, dan alert error. |

## Deployment Target

| Layer | Platform |
|---|---|
| Frontend | Static HTML/CSS/JS di VPS |
| Server-side API | Python HTTP service |
| Database | SQLite |
| Auth | Internal auth berbasis database |
| Storage | Filesystem VPS |
| Reverse proxy | Nginx atau Caddy |
| Process manager | systemd |
| DNS | Registrar atau DNS provider |

## Boundary Sistem

| Di Dalam Sistem | Di Luar Sistem |
|---|---|
| Cek tagihan publik | Payment gateway otomatis |
| Admin tagihan | Rekonsiliasi bank otomatis |
| Import workbook XLSX | Sinkronisasi API UT |
| Metode pembayaran | WhatsApp bot otomatis |
| Audit log | Accounting system eksternal |

## Modul Aplikasi

| Modul | Deskripsi |
|---|---|
| `lookup` | Pencarian tagihan publik berdasarkan NIM. |
| `billing` | Pengelolaan tagihan, status, periode, nominal. |
| `students` | Pengelolaan data mahasiswa. |
| `payment-methods` | Rencana pengelolaan instruksi pembayaran manual. |
| `imports` | Upload, preview, validasi, dan commit data tagihan. |
| `admin-auth` | Login, session, role admin. |
| `audit` | Audit log untuk aktivitas sensitif. |
| `settings` | Konfigurasi aplikasi. |

## Keputusan Desain

| ID | Keputusan | Alasan |
|---|---|---|
| ADR-001 | Menggunakan VPS dan SQLite untuk MVP. | Lebih cepat dieksekusi di satu server, biaya operasional mudah diprediksi, backup bisa dikontrol, dan cukup untuk beban awal web lookup. |
| ADR-002 | Query tagihan dilakukan melalui API server-side. | Menghindari akses langsung browser ke data sensitif. |
| ADR-003 | Lookup publik memakai NIM-only berdasarkan feedback pengguna. | UX diprioritaskan agar mahasiswa cukup memasukkan NIM; risiko enumeration dimitigasi dengan rate limit, pesan error generik, dan monitoring. |
| ADR-004 | Semua import memakai batch ID. | Memudahkan audit, rollback manual, dan investigasi kesalahan data. |
| ADR-005 | Soft delete untuk data penting. | Menjaga histori dan mengurangi risiko kehilangan data. |

## Public Lookup Rules

| Aturan | Detail |
|---|---|
| Verifikasi | NIM. |
| Error message | Pesan umum agar tidak membocorkan mana data yang salah. |
| Identitas | Hasil publik hanya menampilkan NIM dan detail tagihan; nama mahasiswa tidak dikirim. |
| Rate limit | Berdasarkan IP, device fingerprint ringan, dan hash NIM. |
| Logging | Simpan hash NIM, hasil umum, waktu, dan metadata request terbatas. |

## Admin Rules

| Aturan | Detail |
|---|---|
| Auth | Wajib login melalui internal auth dengan password hash kuat dan session server-side. |
| Role | Minimal `admin` dan `super_admin`. |
| Audit | Create/update/delete/import wajib tercatat. |
| Import | Harus preview sebelum commit. |
| Data correction | Koreksi manual boleh, tetapi wajib menyimpan alasan perubahan. |

## Error Handling

| Kondisi | Response |
|---|---|
| Input tidak valid | 400 dengan pesan validasi aman. |
| NIM tidak ditemukan/verifikasi gagal | 404 dengan pesan generik. |
| Rate limit | 429 dengan instruksi coba lagi. |
| Admin tidak login | 401. |
| Role tidak cukup | 403. |
| Error database | 500 dengan request ID, tanpa detail internal. |

## Observability

| Area | Data yang Dicatat |
|---|---|
| Public lookup | Waktu, hash NIM, status hasil, request ID. |
| Admin action | Admin ID, aksi, entity, before/after terbatas, alasan. |
| Import | File name, checksum, total rows, rows valid, rows failed. |
| Error | Request ID, endpoint, stack trace server-side, user impact. |

## Roadmap Teknis

| Tahap | Fokus |
|---|---|
| MVP-0 | Dokumentasi, desain, skema awal. |
| MVP-1 | Public lookup dan database dasar. |
| MVP-2 | Admin CRUD dan auth. |
| MVP-3 | Import workbook XLSX dan audit log. |
| MVP-4 | Hardening, testing, UAT, production deployment. |
| Post-MVP | Payment gateway, notifikasi, rekonsiliasi, integrasi UT. |
