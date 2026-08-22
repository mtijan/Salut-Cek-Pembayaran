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
| Public Web | Form cek tagihan NIM dan halaman hasil untuk mahasiswa (informasi mahasiswa, rincian tagihan, total, status, BRIVA, dan petunjuk). |
| Admin Web | Dashboard admin dengan 3 area utama: Upload File (preview & commit), Data Mahasiswa (CRUD, filter status/sumber, paginasi), dan Data Mahasiswa per File (kartu grup import, ubah status, batas aktif, hapus file). |
| API Layer | Validasi input, rate limit, query server-side, soft delete, dan logging lookup/audit. |
| Internal Auth | Login admin, password hashing (PBKDF2-SHA256), session management cookie HttpOnly, dan role check. |
| SQLite | Penyimpanan mahasiswa, tagihan, histori transaksi pembayaran, issue import, session admin, preview import, dan audit log. |
| Filesystem VPS | Penyimpanan file import mentah sementara jika dibutuhkan sebelum commit. |
| Reverse Proxy | HTTPS termination, routing, compression, forwarding header tepercaya (`X-Real-IP`), dan security headers. |
| Process Manager | Menjalankan service aplikasi via systemd, restart otomatis, dan log runtime. |
| Observability | Log aplikasi, audit log, health check (`/api/health` dengan `release_id`), dan alert error. |

## Deployment Target

| Layer | Platform |
|---|---|
| Frontend | Static HTML/CSS/JS di VPS |
| Server-side API | FastAPI/Uvicorn service |
| Database | SQLite |
| Auth | Internal auth berbasis database |
| Storage | Filesystem VPS |
| Reverse proxy | Nginx atau Caddy |
| Process manager | systemd |
| Domain | Registrar atau DNS provider |

## Boundary Sistem

| Di Dalam Sistem | Di Luar Sistem |
|---|---|
| Cek tagihan publik | Payment gateway otomatis |
| Admin tagihan dan data mahasiswa | Rekonsiliasi bank otomatis |
| Import workbook XLSX (legacy dan terbaru) | Sinkronisasi API UT |
| Instruksi pembayaran BRIVA default | WhatsApp bot otomatis |
| Batas aktif pembayaran | CRUD metode pembayaran configurable |
| Audit log dan soft delete | Accounting system eksternal |

## Modul Aplikasi

| Modul | Deskripsi |
|---|---|
| `lookup` | Pencarian tagihan publik berdasarkan NIM dengan payload data mahasiswa dan tagihan terbatas. |
| `master-data` | Pengelolaan Program Studi dan Periode/Semester Akademik; tabel/seed Jenis Tagihan tersedia tetapi CRUD API/UI belum ada. |
| `students` | Pengelolaan mahasiswa, biodata lengkap, status akademik (`Aktif`, `Cuti`, `Lulus`), angkatan, serta Student Profile 360. |
| `billing` | Pengelolaan tagihan, status, periode, nominal, batas aktif pembayaran, dan generate tagihan massal. |
| `reports` | Rekapitulasi keuangan (penerimaan vs piutang/tunggakan) per prodi dan periode, serta ekspor file laporan. |
| `imports` | Upload, preview, validasi, commit data tagihan (legacy & format terbaru), serta hapus file import. |
| `admin-auth` | Login, session cookie, dan RBAC (`super_admin`, `admin`, `viewer`). |
| `audit` | Audit log untuk aktivitas sensitif (login, logout, import, update status/due date, CRUD manual, delete file, master data). |
| `payment-history` | Pencatatan perubahan manual status/nominal dan tampilan riwayat per tagihan/mahasiswa; endpoint read masih terblokir salah permission pada audit 2026-08-21. |
| `settings` | Konfigurasi runtime aplikasi dan periode akademik aktif. |

## Keputusan Desain

| ID | Keputusan | Alasan |
|---|---|---|
| ADR-001 | Menggunakan VPS dan SQLite untuk MVP. | Lebih cepat dieksekusi di satu server, biaya operasional mudah diprediksi, backup bisa dikontrol, dan cukup untuk beban awal web lookup. |
| ADR-002 | Query tagihan dilakukan melalui API server-side. | Menghindari akses langsung browser ke data sensitif. |
| ADR-003 | Lookup publik memakai NIM-only berdasarkan feedback pengguna. | UX diprioritaskan agar mahasiswa cukup memasukkan NIM; risiko enumeration dimitigasi dengan rate limit, pesan error generik, dan monitoring. |
| ADR-004 | Semua import memakai batch ID / source file tracking. | Memudahkan audit, grouping data per file, dan investigasi kesalahan data. |
| ADR-005 | Soft delete untuk data penting. | Menjaga histori dan mengurangi risiko kehilangan data dengan menyertakan alasan penghapusan. |
| ADR-006 | Menambahkan tabel master data relasional terpisah (Prodi, Periode) tanpa merusak parser Excel teks bebas eksisting. | Menyiapkan fondasi SIAKAD yang terstruktur dengan tetap menjamin kompatibilitas file Excel lama melalui mekanisme *auto-linking / mapping fallback*. |
| ADR-007 | Mengadopsi Role-Based Access Control (RBAC) terpadu (`super_admin`, `admin`, `viewer`). | Mengintegrasikan seluruh wewenang operasional akademik dan keuangan ke dalam satu peran `admin` terpadu demi efisiensi operasional satu pintu. |
| ADR-008 | Membangun antarmuka Admin menggunakan React + Vite (Single Page Application). | Memberikan pengalaman interaksi modern, performa HMR instan, rendering data modular, dan efisiensi deployment statis yang dilayani langsung oleh FastAPI. |
| ADR-009 | Menyimpan `paid_amount` pada tabel tagihan dan auto-registrasi periode custom ke master data global. | Memastikan pencatatan cicilan/bayar sebagian akurat pada laporan keuangan dan menjaga konsistensi format periode akademik di seluruh modul sistem. |
| ADR-010 | Tabel `payment_transactions` terpisah dari `bills` sebagai append-only log. | `bills` tetap menyimpan state terakhir untuk efisiensi query. `payment_transactions` menyimpan kronologi lengkap setiap perubahan pembayaran tanpa overwrite. |
| ADR-011 | Menyimpan `running_paid_total` (snapshot kumulatif) di setiap transaksi. | Memudahkan rekonstruksi saldo tanpa harus menjumlahkan seluruh transaksi sebelumnya. |
| ADR-012 | `payment_date` terpisah dari `created_at` pada payment transaction. | Schema sudah memisahkan keduanya, tetapi API/UI backdating belum ada; saat ini `payment_date` diisi tanggal server. |
| ADR-013 | Otomatis insert `payment_transactions` saat perubahan status/paid_amount pada tagihan. | Menjamin setiap perubahan pembayaran tercatat tanpa memerlukan aksi manual tambahan dari admin. |

## Public Lookup Rules

| Aturan | Detail |
|---|---|
| Verifikasi | NIM. |
| Error message | Pesan umum agar tidak membocorkan mana data yang salah. |
| Identitas | Hasil publik menampilkan NIM, nama, program studi, periode pembayaran, dan detail tagihan serta batas aktif pembayaran bila tersedia. |
| Rate limit | 10 request per IP per 10 menit (di belakang reverse proxy memakai `X-Real-IP`). |
| Logging | Simpan hash NIM, hasil umum (`found`, `not_found`, `invalid`, `rate_limited`), waktu, dan metadata request terbatas. |

## Admin Rules

| Aturan | Detail |
|---|---|
| Auth | Wajib login melalui internal auth dengan password hash kuat (PBKDF2-SHA256) dan session server-side (cookie `salut_admin_session`). |
| Role | `super_admin` dan `admin` memiliki akses operasional; `viewer` saat ini hanya efektif pada dashboard/laporan dan read master data. User management dan viewer read-only lintas mahasiswa/tagihan masih backlog. |
| Audit | Create/update/delete/import/master data wajib tercatat di `audit_logs`. |
| Import | Harus preview sebelum commit; mendukung format legacy dan format terbaru; perubahan sensitif memerlukan konfirmasi eksplisit admin. |
| Data correction | Koreksi manual boleh, tetapi penghapusan wajib menyertakan alasan (`delete_reason`). |

## Error Handling

| Kondisi | Response |
|---|---|
| Input tidak valid | 400 dengan pesan validasi aman (`VALIDATION_ERROR`). |
| NIM tidak ditemukan/verifikasi gagal | 404 dengan pesan generik (`NOT_FOUND`). |
| Rate limit | 429 dengan instruksi coba lagi dan header `Retry-After` (`RATE_LIMITED`). |
| Admin tidak login | 401 (`UNAUTHORIZED`). |
| Role tidak cukup | 403 (`FORBIDDEN`). |
| Konflik / Perlu konfirmasi | 409 (`IMPORT_CONFIRMATION_REQUIRED`). |
| Error database | 500 dengan request ID, tanpa detail internal (`INTERNAL_ERROR`). |

## Observability

| Area | Data yang Dicatat |
|---|---|
| Public lookup | Waktu, hash NIM, hash nama, status hasil, request ID. |
| Admin action | Actor ID, aksi, entity type, entity ID, metadata JSON (before/after/alasan). |
| Import | Nama file, token preview, total baris valid, baris kritis, warning, perubahan sensitif, dan hasil commit. |
| Error | Request ID, endpoint, stack trace server-side, user impact. |

## Roadmap Teknis

| Tahap | Fokus |
|---|---|
| MVP-0 | Dokumentasi, desain, skema awal. Selesai. |
| MVP-1 | Public lookup dan database dasar. Selesai. |
| MVP-2 | Admin CRUD dan auth. Selesai. |
| MVP-3 | Import workbook XLSX dan audit log. Selesai. |
| MVP-4 | Hardening, testing, UAT, production deployment. Implemented; UAT dan verifikasi release tetap wajib per perubahan. |
| MVP-5 | Payment Transaction History: In Progress; schema/service/UI sudah ada di working tree, tetapi endpoint read salah permission, contract backdate belum ada, dan belum ada E2E. |

## Known Architecture Gaps

- `init_db()` masih dijalankan pada banyak read/service path dan melakukan seed/migrasi berulang; target desain adalah migration sekali saat startup/deploy.
- Mutasi bisnis dan `audit_logs` masih memakai koneksi/transaksi terpisah pada banyak handler.
- SPA React dan admin legacy masih hidup bersamaan sehingga kontrak UI dapat berbeda.
- CSP saat ini tidak kompatibel dengan inline style SPA dan external Google Fonts.
- Rate limiter bersifat in-memory per process dan lifecycle/retensi log/backup belum otomatis.

Detail dan prioritas mitigasi ada di `docs/14-codebase-audit-mitigation-plan.md`.
| Post-MVP | Payment gateway, notifikasi, rekonsiliasi, integrasi UT. |
