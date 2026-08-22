# Codebase Audit dan Mitigation Plan

Tanggal audit: 2026-08-21  
Pembaruan remediasi: 2026-08-22  
Scope: seluruh source backend, frontend publik, SPA React, skema/migrasi SQLite, import XLSX, konfigurasi Docker/systemd/Nginx, dependency, test, dokumentasi, dan kondisi working tree lokal.  
Boundary awal audit hanya checkout lokal. Pada 2026-08-22 remediasi dideploy tanpa Docker dan diverifikasi langsung pada VPS production revision `ec6d65f`.

## Ringkasan Eksekutif

Fungsi inti backend memiliki coverage lokal/VPS yang cukup baik dan 58 test lulus. Build SPA serta audit dependency npm/Python telah lulus. Remediasi P0-P2 telah dideploy tanpa Docker. Gate teknis lulus: 0 data partial aktif, API production 596 tagihan/6 halaman, browser E2E sintetis 100/5 row tanpa CSP violation, backup/restore, RBAC lima role, concurrency, rate limit, dan topologi Nginx/systemd telah diverifikasi.

Prioritas perbaikan:

1. tutup blocker transaksi pembayaran dan paginasi sebelum rilis frontend/backend berikutnya;
2. satukan kontrak RBAC antara backend, sidebar, dan dokumentasi;
3. hilangkan mutasi/migrasi database dari read path dan satukan perubahan data dengan audit log dalam satu transaksi;
4. harden Docker, validasi domain data, retensi, dan rate limiter;
5. pecah modul besar, hapus duplikasi frontend legacy, dan tambah quality gate otomatis.

## Bukti Validasi Lokal

| Pemeriksaan | Hasil 2026-08-21 |
|---|---|
| `.\.venv\Scripts\python.exe -m unittest Backend.test_core` | Lulus lokal dan VPS: 58 test. Deprecation warning TestClient/cookie tetap ada. |
| `npm.cmd run build` di `Frontend-Admin` | Lulus: 1.605 module ditransformasi; bundle JS 319,56 kB (gzip 86,19 kB). |
| `node --check Frontend/admin.js` | Lulus. |
| `docker compose config --quiet` dengan secret non-placeholder | Lulus; Compose meminta secret eksternal dan bind loopback. |
| `npm.cmd audit` | Lulus: 0 vulnerability npm. |
| `.\.venv\Scripts\python.exe -m pip check` | Lulus: `No broken requirements found`; environment proyek terisolasi dari paket global. |
| `.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --progress-spinner off` | Audit awal: 9 advisory pada Starlette 0.37.2. Setelah FastAPI/Starlette diperbarui ke 0.141.1/1.6.0: lulus 0 known vulnerability dengan `pip-audit 2.10.1`. |
| FastAPI route inventory | 33 API operations aktif. |
| SQLite schema inventory | 12 tabel aplikasi aktif. |
| Permission/RBAC production-copy | Lima role lulus endpoint positif/negatif; history 200 untuk role pembaca dan anonymous 401. |
| Documentation audit sebelum sinkronisasi | 0 error, 0 warning, tetapi pemeriksaan tersebut tidak mendeteksi klaim fitur yang salah atau fakta bahwa `docs/` di-ignore Git. |

## Temuan Terbuka

### AUD-2026-001 - Endpoint riwayat pembayaran selalu 403

Severity: High  
Status: Remediated dan dideploy 2026-08-22

Sebelumnya `GET /api/admin/bills/{bill_id}/transactions` dan `GET /api/admin/students/{student_id}/transactions` memakai `require_admin("viewer")`. Argumen helper tersebut adalah nama permission, sedangkan `ROLE_PERMISSIONS` tidak memberikan permission bernama `viewer` kepada role mana pun.

Remediasi: kedua route kini memakai `require_admin("view_reports")`, memeriksa target aktif sebelum query, dan mengembalikan 404 untuk bill/mahasiswa tidak ada. Regression test mencakup viewer/admin/super_admin (200), anonymous (401), target tidak ada (404), dan pagination invalid (400). Konsistensi viewer lintas modul tetap ditangani AUD-2026-007.

### AUD-2026-002 - Paginasi tagihan SPA selalu berhenti di halaman pertama

Severity: High  
Status: Remediated, dideploy, dan browser E2E lulus 2026-08-22

Sebelumnya backend mengembalikan total pada `data.pagination.total`, tetapi `BillsPage.jsx` membaca `res.total_count`. `totalCount` menjadi 0, `totalPages` menjadi 1, dan data setelah 100 baris tidak dapat dinavigasi melalui SPA.

Remediasi: SPA memakai `pagination.total` dan `pagination.total_pages`. API production membuktikan 596 record/6 halaman. Chrome headless dengan bundle release dan 105 data sintetis membuktikan halaman 1 berisi 100 row, halaman 2 berisi 5 row, navigasi kembali berhasil, dan console mencatat 0 CSP violation.

### AUD-2026-003 - Status partial tanpa nominal membuat angka pembayaran fiktif

Severity: High  
Status: Remediated dan review production selesai 2026-08-22

Sebelumnya `update_bill_status()` mengisi `amount // 2` ketika status diubah ke `partial` tanpa `paid_amount`. Frontend legacy `Frontend/admin.js` mengirim status saja, sehingga fallback admin dapat mencatat cicilan 50% yang tidak pernah dimasukkan admin.

Remediasi: backend selalu memanggil `validate_paid_amount()` untuk `partial`, API mengembalikan 400 tanpa nominal, dan legacy admin meminta nominal eksplisit. Review database production menemukan 0 tagihan aktif berstatus `partial`, sehingga tidak ada nilai fallback historis yang perlu dikoreksi saat deployment.

### AUD-2026-004 - Docker Compose berisi default credential dan trusted proxy yang tidak aman

Severity: High bila port Docker dapat diakses jaringan  
Status: Remediated; topologi VPS non-Docker diverifikasi 2026-08-22

Sebelumnya `docker-compose.yml` mempublikasikan port 8000, menyetel password bootstrap yang diketahui, memakai lookup secret statis, dan mengaktifkan `TRUST_PROXY_HEADERS=true`. Jika container diakses langsung, client dapat mengirim `X-Real-IP` berbeda untuk menghindari rate limit.

Remediasi: Compose kini memerlukan tiga secret dari `.env`, bind ke `127.0.0.1`, serta default `TRUST_PROXY_HEADERS=false`. `.env.docker.example` menyediakan template yang aman untuk diisi; `.env` tetap di-ignore. Validasi production menolak placeholder, lookup secret kurang dari 32 karakter, password bootstrap kurang dari 12 karakter, dan email invalid. `docker compose config --quiet` lulus dengan secret valid. Topologi reverse proxy/port VPS tetap harus diverifikasi sebelum deployment.

### AUD-2026-005 - Migrasi dan seed berjalan berulang pada read path

Severity: High untuk reliability/maintainability  
Status: Remediated dan diverifikasi production-copy 2026-08-22

`init_db()` dipanggil oleh sekitar 26 service path. Fungsi tersebut tidak hanya membuat tabel, tetapi juga menjalankan update paid amount, upsert puluhan program studi, scan/link mahasiswa, dan migrasi lain. Read request dapat mengambil write lock SQLite, mengulang kerja migrasi, dan meningkatkan risiko `database is locked`.

Mitigasi: gunakan migration version table dan jalankan migrasi sekali saat startup/deploy. Repository/service read hanya membuka koneksi dan melakukan query. Aktifkan strategi koneksi yang eksplisit (`busy_timeout`, evaluasi WAL) serta test concurrent read/write.

### AUD-2026-006 - Mutasi bisnis dan audit log tidak atomik

Severity: High  
Status: Remediated dan dideploy 2026-08-22

Sebagian besar handler memanggil service yang sudah commit, lalu membuka koneksi kedua untuk menulis `audit_logs`. Jika audit write gagal, data sudah berubah tetapi jejak audit hilang dan API dapat tampak gagal. Import commit memiliki risiko retry setelah perubahan sebenarnya sudah tersimpan.

Remediasi: mutasi mahasiswa, tagihan, master data, penghapusan batch import, dan commit import menulis audit pada transaksi service/import yang sama. `payment_transactions` juga dicatat pada boundary yang sama.

### AUD-2026-007 - RBAC viewer berbeda antara dokumentasi, UI, dan backend

Severity: Medium-High  
Status: Remediated dan dideploy 2026-08-22

Sidebar menampilkan semua modul kepada viewer, tetapi endpoint students/bills/detail memakai `manage_data`, imported files memakai `import`, dan payment history salah memakai permission `viewer`. Viewer praktis hanya dapat memakai dashboard, rekap keuangan, serta read master prodi/periode. Klaim viewer read-only seluruh data belum benar. Konfigurasi backend juga masih menyimpan role kompatibilitas `admin_akademik` dan `admin_keuangan` sementara UI hanya memodelkan tiga role. Pengelolaan akun admin belum memiliki API/UI meskipun permission `manage_users` tersedia.

Remediasi: permission matrix tunggal membedakan capability read/write dan navigation SPA memakai capability. Lima role diuji positif/negatif pada salinan konsisten database production.

### AUD-2026-008 - Soft-delete mahasiswa mencegah pembuatan ulang NIM

Severity: Medium-High  
Status: Remediated dan dideploy 2026-08-22

`students.nim` tetap unique untuk row soft-deleted. `ensure_student()` hanya mencari row aktif lalu mencoba insert baru; NIM yang pernah dihapus dapat menghasilkan `sqlite3.IntegrityError`/500. Tidak ada restore flow.

Remediasi: pembuatan ulang NIM yang soft-deleted memulihkan row lama dan memiliki regression test delete lalu recreate/restore.

### AUD-2026-009 - Default program studi yang dihapus dapat muncul kembali

Severity: Medium  
Status: Remediated dan dideploy 2026-08-22

Delete program studi melakukan hard delete, sementara `migrate_study_programs_to_4char_codes()` meng-upsert default program pada hampir setiap `init_db()`. Program default yang dihapus akan dibuat kembali pada request berikutnya.

Remediasi: hapus program studi menjadi deactivate (`is_active=0`), seed berjalan melalui migration satu kali, dan read path tidak menulis ulang master.

### AUD-2026-010 - Content Security Policy tidak cocok dengan SPA

Severity: Medium  
Status: Mitigated dan browser-verified 2026-08-22

Middleware hanya mengirim `default-src 'self'`, sementara bundle admin memakai banyak inline style/`<style>` React dan `admin-dist/index.html` memuat Google Fonts. Browser modern akan memblokir inline style dan resource font tersebut; layout/animasi/warna inline dapat hilang walau build lulus.

Remediasi saat ini: CSP eksplisit kompatibel dengan bundle dan browser E2E mencatat 0 CSP violation. Penghapusan `unsafe-inline` dan self-host font tetap hardening lanjutan, bukan blocker release saat ini.

### AUD-2026-011 - Validasi domain mahasiswa dan tanggal belum cukup ketat

Severity: Medium  
Status: Remediated sesuai kebijakan data 2026-08-22

Lookup menormalisasi huruf menjadi digit alih-alih menolak format NIM invalid; `academic_status` menerima teks apa pun; validasi `YYYY-MM-DD` tidak memastikan kalender nyata sehingga tanggal seperti `2026-99-99` dapat disimpan. Email, NIK/KTP, dan tahun masuk tidak dibatasi oleh validator aplikasi berdasarkan kebijakan pemilik sistem; nilainya direview dan dikoreksi manual oleh admin bila ditemukan kesalahan.

Remediasi: [`Backend/app/services.py`](../Backend/app/services.py) menolak NIM yang mengandung huruf, membatasi `academic_status` pada enum resmi, dan memakai `date.fromisoformat` untuk memastikan tanggal kalender valid. Regression test negatif ada di [`Backend/test_core.py`](../Backend/test_core.py). Email, NIK/KTP, dan tahun masuk sengaja tidak divalidasi secara format; admin bertanggung jawab melakukan pemeriksaan manual saat koreksi data.

### AUD-2026-012 - Rate limiter dan retensi dapat menghabiskan resource

Severity: Medium  
Status: Remediated dan diaktifkan di VPS 2026-08-22

Rate limiter bersifat per-process, hilang saat restart, tidak konsisten pada multi-worker, dan dictionary key tidak pernah dihapus. Lookup log, audit log, session kedaluwarsa, import issue, dan backup ZIP belum memiliki pruning otomatis yang terukur. Timer backup harian dapat memenuhi disk.

Remediasi: limiter menghapus bucket expired; retention, rotasi backup 14 harian/8 mingguan/12 bulanan, timer verifikasi bulanan, dan Nginx edge rate limit aktif di VPS. Maintenance dan restore drill lulus; lookup ke-11 menerima 429. Alert disk eksternal tetap pekerjaan Ops; penggunaan disk saat deploy 12%.

### AUD-2026-013 - Rekap dan master count dapat menampilkan angka tidak akurat

Severity: Medium  
Status: Remediated dan dideploy 2026-08-22

Dokumentasi pernah menyebut laporan per prodi dan periode, tetapi implementasi hanya mengelompokkan per prodi. Join fuzzy pada `list_study_programs()` juga dapat menghitung mahasiswa tanpa prodi ke setiap prodi karena pola `LIKE '%%'`, dan nama prodi substring dapat terhitung ganda.

Remediasi: laporan keuangan menerima filter periode eksplisit melalui `GET /api/admin/reports/financial-summary?period=YYYY.N`; SPA menyediakan kolom filter periode. Student count master mengutamakan FK dan hanya memakai fallback mapping yang tidak kosong serta deterministik.

### AUD-2026-014 - Payment history belum lengkap sebagai ledger operasional

Severity: Medium  
Status: Remediated dan dideploy 2026-08-22 / backfill historis sengaja tidak otomatis

Schema menyediakan `payment_date`, reference, dan notes, tetapi API tidak menerima field tersebut; tanggal selalu tanggal server lokal, existing payment tidak di-backfill, Student 360 memotong history di 100 row tanpa metadata, dan “append-only” belum dipaksa oleh trigger/constraint database. Endpoint saat ini juga tidak mengembalikan 404 untuk bill/student yang tidak ada.

Remediasi: `payment_transactions` ditetapkan sebagai state-change ledger internal. API dan form tagihan menerima tanggal transaksi, nomor referensi, dan catatan; tanggal default memakai WIB UTC+07:00; Student 360 membaca endpoint transaksi dengan pagination 50 baris; dan trigger SQLite menolak update/delete. Backfill tidak dilakukan otomatis karena data lama tidak memiliki bukti tanggal/referensi yang dapat diverifikasi.

### AUD-2026-015 - CSV report rentan formula injection

Severity: Medium  
Status: Remediated dan dideploy 2026-08-22

Export CSV dibangun di browser dari nama program studi tanpa escape quote/newline dan tanpa menetralkan prefix formula spreadsheet (`=`, `+`, `-`, `@`). Data master yang dikontrol admin dapat dieksekusi sebagai formula ketika CSV dibuka.

Remediasi: serializer CSV melakukan escape quote/newline dan menetralkan prefix formula spreadsheet sebelum export.

### AUD-2026-016 - Maintainability dan quality gate belum memadai

Severity: Medium  
Status: Open

Hotspot terbesar adalah `Frontend/styles.css` 3.697 baris, `Backend/app/services.py` 1.725 baris, `Frontend/admin.js` 1.484 baris, `Backend/test_core.py` 1.544 baris, `BillsPage.jsx` 917 baris, dan `StudentsPage.jsx` 877 baris. `_analyze_workbook()` sendiri 265 baris. Terdapat dua implementasi admin (React dan legacy), belum ada lint/type-check/formatter/CI config, belum ada test frontend, dan walaupun dependency langsung Python serta versi alat audit kini dikunci, dependency transitif belum memiliki lock file lengkap.

Mitigasi: pecah repository/service/import rules berdasarkan domain, ekstrak component/hooks, tentukan masa akhir frontend legacy, tambah Ruff/mypy atau Pyright, ESLint, formatter, frontend test, CI, serta lock/constraints lengkap untuk dependency transitif.

### AUD-2026-017 - Identitas versi tidak tunggal

Severity: Low-Medium  
Status: Open

FastAPI/health memakai `0.2.0`, changelog memakai `2.3.0`, dan package SPA memakai `1.0.0`. `release_id` Git membantu identifikasi commit, tetapi version label tetap membingungkan operasi dan dokumentasi.

Mitigasi: pilih satu source of truth version dan inject ke health, OpenAPI, frontend build, changelog, serta dokumentasi.

## Fitur yang Belum Diimplementasikan Tetapi Pernah Diklaim Selesai

| Fitur | Kondisi kode saat audit |
|---|---|
| CRUD master jenis tagihan | Tabel dan seed ada; API/UI CRUD tidak ada. |
| Pengelolaan akun admin/role | Permission `manage_users` ada; API/UI tidak ada. |
| Tampilan audit log | Data ditulis; endpoint aktif/UI pembaca tidak ada. |
| Rekap keuangan per periode | Filter periode tersedia pada API dan SPA. |
| Backdate/reference/notes pembayaran | Tersedia untuk mutasi tagihan baru; tidak ada backfill otomatis untuk transaksi lama. |
| Viewer read-only semua modul | Capability baca tersedia dan diuji lintas endpoint. |
| E2E/UI verification | Chrome headless sintetis lulus pagination/CSP; smoke API/HTTPS production lulus. |

## Temuan Historis yang Tetap Termitigasi

Audit 2026-08-08 sebelumnya memperbaiki spoofed `X-Forwarded-For` pada jalur Nginx VPS, parse `limit`, validasi token preview import, batas ekstraksi XLSX, soft delete, minimisasi health response, dan centralized auth exception. Mitigasi tersebut masih ada pada checkout, tetapi tidak menutup risiko Docker direct exposure, lifecycle SQLite, atau gap RBAC baru.

## Urutan Remediasi

| Prioritas | Item |
|---:|---|
| P0 | AUD-001 sampai AUD-004 diremediasi, dideploy, dan gate data/browser lulus. |
| P1 | AUD-005, AUD-006, AUD-007, AUD-008 untuk reliability, auditability, dan akses. |
| P2 | AUD-009 sampai AUD-015 untuk konsistensi data, keamanan browser, dan operasi. |
| P3 | AUD-016 dan AUD-017 sebagai refactor bertahap setelah behavior dikunci test. |

## Checklist Implementasi P0-P2 (pembaruan 2026-08-22)

Checklist ini adalah referensi status implementasi terbaru; uraian temuan di atas dipertahankan sebagai konteks audit awal.

### P0

- [x] AUD-001 — histori pembayaran memakai permission baca dan memverifikasi target: [`Backend/app/main.py`](../Backend/app/main.py), [`Backend/test_core.py`](../Backend/test_core.py).
- [x] AUD-002 — metadata pagination API digunakan SPA: [`Frontend-Admin/src/pages/BillsPage.jsx`](../Frontend-Admin/src/pages/BillsPage.jsx).
- [x] AUD-003 — nominal partial wajib eksplisit: [`Backend/app/services.py`](../Backend/app/services.py), [`Frontend/admin.js`](../Frontend/admin.js).
- [x] AUD-004 — Compose tidak lagi membawa credential default dan bind ke loopback: [`docker-compose.yml`](../docker-compose.yml), [`.env.docker.example`](../.env.docker.example).
- [x] Gate deploy P0 — production memiliki 0 partial aktif; API 596 tagihan/6 halaman dan browser sintetis 105 tagihan/2 halaman lulus.

### P1

- [x] AUD-005 — migration version table, busy timeout, dan WAL: [`Backend/db.py`](../Backend/db.py), [`Backend/schema.sql`](../Backend/schema.sql), `test_schema_migration_runs_once_and_does_not_restore_deleted_master_data`.
- [x] AUD-006 — mutasi mahasiswa, tagihan, master, file import, dan commit import menulis audit dalam transaksi yang sama: [`Backend/app/services.py`](../Backend/app/services.py), [`Backend/app/main.py`](../Backend/app/main.py), [`Backend/import_excel.py`](../Backend/import_excel.py).
- [x] AUD-007 — capability read/write tunggal dan UI berbasis capability: [`Backend/app/config.py`](../Backend/app/config.py), [`Frontend-Admin/src/context/AuthContext.jsx`](../Frontend-Admin/src/context/AuthContext.jsx).
- [x] AUD-008 — rekreasi NIM soft-deleted memulihkan row lama: [`Backend/app/services.py`](../Backend/app/services.py), `test_recreate_soft_deleted_student_restores_existing_nim`.
- [x] Gate deploy P1 — lima role lulus endpoint positif/negatif; 40 concurrent writes pada salinan production lulus.

### P2

- [x] AUD-009 — hapus prodi menjadi deactivate dan seed tidak berulang: [`Backend/app/services.py`](../Backend/app/services.py), [`Backend/db.py`](../Backend/db.py).
- [~] AUD-010 — CSP eksplisit kompatibel dengan SPA dan browser mencatat 0 violation: [`Backend/app/main.py`](../Backend/app/main.py). Penghapusan `unsafe-inline` dan self-host font menjadi hardening lanjutan.
- [x] AUD-011 — NIM huruf, status akademik invalid, dan tanggal kalender invalid ditolak: [`Backend/app/services.py`](../Backend/app/services.py). Email, NIK/KTP, dan tahun masuk mengikuti pemeriksaan manual admin berdasarkan kebijakan data yang disetujui.
- [x] AUD-012 — retention, rotasi/verifikasi backup, dan edge rate limit aktif serta diuji di VPS: [`Backend/maintenance.py`](../Backend/maintenance.py), [`Backend/backup_sqlite.py`](../Backend/backup_sqlite.py), [`deploy/nginx-rate-limit.conf`](../deploy/nginx-rate-limit.conf).
- [x] AUD-013 — count prodi memakai FK/exact fallback dan rekap mendukung filter periode: [`Backend/app/services.py`](../Backend/app/services.py), [`Frontend-Admin/src/pages/ReportsPage.jsx`](../Frontend-Admin/src/pages/ReportsPage.jsx).
- [x] AUD-014 — ledger append-only, metadata/backdate, dan pagination Student 360 tersedia serta diuji: [`Backend/db.py`](../Backend/db.py), [`Frontend-Admin/src/pages/Student360Modal.jsx`](../Frontend-Admin/src/pages/Student360Modal.jsx).
- [x] AUD-015 — CSV escape dan formula neutralization: [`Frontend-Admin/src/utils/csv.js`](../Frontend-Admin/src/utils/csv.js), [`Frontend-Admin/src/pages/ReportsPage.jsx`](../Frontend-Admin/src/pages/ReportsPage.jsx).
- [x] Gate deploy P2 — timer aktif, restore backup lulus, disk 12%, dan browser mencatat 0 CSP violation.

## Release Gate

Status saat pembaruan: **Deployed dan technical smoke test lulus** pada `ec6d65f` tanggal 2026-08-22. Bukti utama: 58 test VPS, health/release ID cocok, OpenAPI 200, HTTPS/API/admin login lulus, pagination production 596/6 halaman, Chrome E2E sintetis 100→5 row, RBAC lima role dan concurrency pada salinan, schema v2/WAL/integrity `ok`, maintenance/backup/restore lulus, lookup ke-11 429, Nginx valid, dan disk 12%. UAT mutasi data bisnis tetap dilakukan terpisah agar automation tidak mengubah data mahasiswa/tagihan production.
