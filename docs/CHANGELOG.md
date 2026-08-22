# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format mengikuti prinsip Keep a Changelog dan Semantic Versioning.

## [Unreleased]

### Deployed
- Revision `ec6d65f` dideploy tanpa Docker ke VPS production pada 2026-08-22. Health/release ID, OpenAPI, Nginx, systemd, tiga timer, SQLite schema v2/WAL/integrity, backup/restore, rate limit, permission file, dan disk telah diverifikasi.
- Smoke production lulus untuk HTTPS/API/admin session dan pagination 596 tagihan/6 halaman. Chrome E2E dengan bundle release dan data sintetis membuktikan pagination 100/5 row serta 0 CSP violation tanpa menyalin data production.
- Hotfix systemd memakai module entrypoint (`python -m Backend...`); regression suite meningkat menjadi 58 test dan lulus lokal/VPS.

### Added
- **Payment Transaction History (FR-035, FR-036)**: Tabel `payment_transactions` untuk mencatat setiap perubahan status pembayaran secara kronologis dan append-only. Setiap perubahan `status` atau `paid_amount` pada tagihan otomatis menghasilkan entry transaksi yang mencatat nominal perubahan, status sebelum/sesudah, tanggal pembayaran, metode, referensi, dan admin pencatat.
- **API Riwayat Transaksi**: Endpoint `GET /api/admin/bills/{bill_id}/transactions` dan `GET /api/admin/students/{student_id}/transactions` untuk mengambil riwayat transaksi pembayaran per tagihan atau per mahasiswa.
- **Tab Riwayat Pembayaran di Student Profile 360**: Tab baru pada modal Student Profile 360 yang menampilkan daftar kronologis seluruh transaksi pembayaran mahasiswa.
- **Tombol Riwayat pada Tabel Tagihan**: Akses cepat ke histori transaksi per tagihan dari halaman Tagihan Mahasiswa.
- **Audit Dependency Python Terisolasi**: `requirements-audit.txt` dan `scripts/audit_python_dependencies.ps1` menyediakan `pip check` serta `pip-audit` yang tidak tercampur paket Python global.

### Security
- FastAPI diperbarui dari 0.111.1 ke 0.141.1 dan Uvicorn dari 0.30.6 ke 0.52.4. Starlette transitif naik dari 0.37.2 ke 1.6.0 untuk menutup 9 advisory yang ditemukan audit awal; audit ulang 2026-08-21 melaporkan 0 known vulnerability.
- Versi dependency runtime langsung dan `pip-audit 2.10.1` dikunci agar validasi lokal lebih konsisten.
- Route riwayat pembayaran memakai permission `view_reports` yang dimiliki role pembaca, mengembalikan 404 untuk bill/mahasiswa tidak ada, dan tervalidasi untuk viewer/admin/super_admin.
- Status `partial` kini wajib menerima `paid_amount`; fallback angka 50% telah dihapus dari backend dan legacy admin meminta nominal eksplisit.
- Docker Compose tidak lagi memiliki default credential/secret, bind ke loopback, dan default `TRUST_PROXY_HEADERS=false`; validasi production menolak placeholder dan secret/password lemah.

### Documentation
- Audit codebase menyeluruh 2026-08-21 ditambahkan dengan 17 temuan terprioritas, release gate, bukti validasi lokal, dan mitigation plan.
- README, PRD, system design, database design, API contract, security/RBAC, admin operations, test plan, deployment plan, risk register, traceability, handoff, diagram, security policy, dan portal HTML diselaraskan dengan kondisi working tree.
- `docs/` tidak lagi di-ignore agar dokumentasi yang dirujuk README dapat direview dan di-commit.

### Known Issues
- CRUD jenis tagihan, user management, audit-log viewer, penghapusan `unsafe-inline`, self-host font, alert disk eksternal, dan debt maintainability/P3 masih terbuka.
- Backfill transaksi historis tidak dilakukan otomatis karena tidak ada bukti tanggal/referensi yang dapat diverifikasi.

## [2.3.0] - 2026-08-18

### Added
- **Fitur Bayar Sebagian (Partial Payment) & Kalkulasi Sisa Tagihan**: Dukungan pencatatan nominal cicilan (`paid_amount`) pada tagihan berstatus `Bayar sebagian` (`partial`), kalkulasi otomatis sisa piutang (`remaining_amount = amount - paid_amount`), serta integrasi nominal pembayaran parsial ke Dashboard Statistik, Rekapitulasi Keuangan, dan Student Profile 360.
- **Dropdown Terstruktur Jenis Tagihan**: Opsi terstandarisasi (`UKT`, `WISUDA`, `Custom`) pada form buat dan edit tagihan dengan input fleksibel saat memilih custom.
- **Dropdown Terstruktur Periode Tagihan & Auto-Register Global**: Opsi periode akademik berbasis master data `academic_periods` dengan fitur pendaftaran otomatis periode custom baru ke master data global untuk menjamin konsistensi data.

### Changed
- **Modal Edit Tagihan Mahasiswa**: Menghilangkan dropdown pemilihan mahasiswa saat mode edit tagihan dan menggantinya dengan kartu informasi mahasiswa statis (read-only) untuk mencegah pemindahan tagihan antar mahasiswa.
- **Perbaikan Backend `update_bill`**: Menghapus dependensi wajib `nim` dan registrasi ulang mahasiswa pada `update_bill`, sehingga tagihan yang sudah ada dapat diperbarui secara stabil.
- **Skema Database**: Penambahan kolom `paid_amount integer not null default 0` pada tabel `bills` melalui migrasi otomatis `migrate_bills_for_paid_amount`.

### Added
- **Master Data Mahasiswa 13 Kolom (`MASTER_DATA_2023_1_2026_1.xlsx`)**: Dukungan penuh terhadap format master data Excel dengan 13 kolom header: `NIM`, `Nama`, `NO KTP`, `Tempat Lahir`, `Tanggal Lahir`, `Nama Ibu Kandung`, `e-Mail`, `No Kontak`, `Registrasi Awal`, `Program Studi`, `No Rek`, `Jumlah`, `Batas Pembayaran`.
- **Ekstraksi Periode Masuk & Sorting Kronologis**: Parsing pintar kolom `Registrasi Awal` (Tahun.1 = Semester Ganjil, Tahun.2 = Semester Genap) yang diekstrak ke kolom `entry_year`, `entry_semester`, `entry_period` (contoh: `2023.1`, `2023.2`) sehingga data mahasiswa dapat difilter dan diurutkan secara kronologis berdasarkan angkatan awal.
- **Normalisasi Nama Mahasiswa (Capital Each Word / Title Case)**: Sistem otomatis membersihkan spasi berlebih dan memformat nama mahasiswa menjadi Title Case rapi (contoh: `Muhamad Romli`, `Riyanita Meirina`) saat import maupun create/update manual.
- **Download Template Master Data Excel**: Penambahan endpoint `GET /api/admin/template/master-data` dan tombol "Unduh Template Excel" di antarmuka Admin Upload untuk mendapatkan template 13 kolom resmi beserta contoh pengisian.
- **Ekspansi Student Profile 360**: Penambahan data kependudukan (No KTP / NIK, Tempat & Tanggal Lahir, Nama Ibu Kandung), periode registrasi awal, dan nomor kontak pada modal Student Profile 360 dan form CRUD mahasiswa.

### Changed
- Skema tabel `students` diperluas dengan kolom `no_ktp`, `tempat_lahir`, `tanggal_lahir`, `nama_ibu_kandung`, `entry_semester`, `entry_period` beserta indeks pencarian.
- Fungsi migrasi database otomatis `migrate_students_for_master_data` di `Backend/db.py`.

## [2.1.0] - 2026-08-16

### Added
- **React + Vite Admin SPA**: Antarmuka admin modern berbasis Single Page Application di folder `Frontend-Admin/` yang terintegrasi penuh ke backend FastAPI melalui bundle `Frontend/admin-dist/`.
- **Modul SIAKAD Admin Terpadu**:
  - Dashboard statistik dengan metrik real-time total mahasiswa, tagihan, penerimaan, piutang, dan progress bar pelunasan.
  - Data Mahasiswa dengan pencarian live, filter prodi & status, modal editor mahasiswa, dan modal **Student Profile 360** (biodata lengkap, status akademik, angkatan, riwayat seluruh tagihan).
  - Tagihan Mahasiswa dengan paginasi 100 baris, filter status/sumber, status switcher inline, dan modal buat/edit tagihan.
  - Rekapitulasi Keuangan per Program Studi dan fitur ekspor CSV.
  - Riwayat File Import dengan kartu batch dan penghapusan kumpulan tagihan per file dengan alasan audit.
  - Wizard Upload Excel 3-langkah (Pilih file, preview perubahan data & baris kritis, commit ke database).
  - Master Data: Manajemen Program Studi (CRUD) dan Periode/Semester Akademik (CRUD + semester aktif).
- **Penyatuan Role Admin Operasional**: Penyatuan peran operasional akademik dan keuangan menjadi satu peran `admin` terpadu (`super_admin`, `admin`, `viewer`).

### Changed
- Rute `/admin` dan `/admin/*` pada FastAPI dikonfigurasi untuk menyajikan bundle statis SPA React secara otomatis.
- Skema database SQLite dan migrasi diperbarui dengan tabel master data (`study_programs`, `academic_periods`, `bill_types`) dan atribut profil mahasiswa (`study_program_id`, `academic_status`, `entry_year`, `email`, `address`).

- Endpoint `DELETE /api/admin/imported-files` untuk menghapus seluruh tagihan per file import secara soft delete dengan alasan wajib.
- Dukungan pagination (100 item/halaman) serta filter status (`paid`, `partial`, `unpaid`) dan filter sumber (`import`, `manual`) pada endpoint `GET /api/admin/bills` dan antarmuka Data Mahasiswa.
- Dukungan parser untuk workbook format terbaru (`NIM`, `Nama`, `No Rek`, `Jumlah`) dengan pemetaan otomatis profil prodi, registrasi awal, no HP, dan batas aktif pembayaran.
- Status tagihan `Bayar sebagian` (`partial`) untuk mencatat pembayaran cicilan, tersedia pada form dan daftar tagihan admin serta hasil lookup publik.
- Navigasi admin menggunakan sidebar dengan 3 menu: `Upload File`, `Data Mahasiswa`, dan `Data Mahasiswa per File`.
- Data Mahasiswa per File menampilkan kartu per versi import dengan waktu import, jumlah mahasiswa, jumlah tagihan, total nominal, ringkasan status pembayaran, dan aksi hapus file.
- Health check sekarang menyertakan `release_id` non-rahasia agar versi code yang aktif di VPS dapat diverifikasi setelah deploy.
- Backend FastAPI/Uvicorn dengan struktur modul `Backend/app` untuk routing, konfigurasi, response, security, rate limit, dan service.
- Preview import sekarang membedakan tagihan baru, tidak berubah, akan diperbarui, perubahan nominal, dan penggantian BRIVA.
- Dashboard admin sekarang menampilkan tagihan terimport per nama file dan menyediakan select status untuk `Belum lunas`, `Bayar sebagian`, dan `Lunas`.
- Public lookup memberi label `Tagihan 1`, `Tagihan 2`, dan seterusnya bila satu NIM memiliki lebih dari satu tagihan.
- Public lookup sekarang menjumlahkan beberapa nominal tagihan menjadi `Total Tagihan` sambil tetap menampilkan nominal masing-masing tagihan.
- Endpoint admin untuk daftar tagihan terimport dan update status tagihan.
- Endpoint admin CRUD manual untuk mahasiswa dan tagihan: list/search, create, update, delete, dan audit log.
- Konfirmasi eksplisit admin untuk perubahan nominal atau BRIVA, termasuk daftar contoh perubahan sebelum commit.
- Validasi kritis untuk BRIVA yang sama pada NIM berbeda, konflik BRIVA lintas periode, dan perubahan tagihan berstatus `paid`.
- Baseline dokumentasi ISO-aligned untuk requirement, desain sistem, diagram, database, API, keamanan, operasi, testing, deployment, project management, risk register, traceability, dan release plan.
- `.gitignore` awal untuk melindungi dependency, build output, secret, runtime data, backup, session, database lokal, dan log.
- Portal HTML dokumentasi dengan tampilan ringkas untuk membaca requirement, diagram, database, API, security, testing, deployment, risiko, dan traceability.
- Diagram tambahan untuk DFD Level 0, DFD Level 1, UML-style class diagram, dan UML-style component diagram.
- Paket diagram lanjutan untuk activity lookup/import, BPMN-style business process, C4 container, data lifecycle, data privacy, authentication dan authorization, keputusan validasi import, backup dan recovery, CI/CD, serta sitemap.
- Implementasi awal `Backend/` dan `Frontend/` untuk lookup tagihan publik.
- Importer Excel khusus workbook `Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx` dengan 409 data lengkap, 11 issue/warning, dan 2 baris multiple bill pada workbook saat ini.
- Admin MVP untuk login, session cookie, upload Excel, preview import, commit import, dan audit log dasar.
- Rate limit untuk lookup, login gagal, dan import; role check untuk import; validasi commit tanpa baris kritis; serta header keamanan respons.
- Template environment production, konfigurasi Nginx/systemd, dan timer backup SQLite.
- Deployment production VPS pada 2026-08-02 dengan HTTPS Let's Encrypt, service systemd, backup SQLite terjadwal, dan smoke test lookup/login.
- Registry `import_previews` untuk mengikat token preview import ke admin pembuat preview sebelum commit.
- Soft delete mahasiswa dan tagihan dengan `deleted_at`, `deleted_by`, dan alasan penghapusan.
- Batas hardening XLSX: 20 MB per entry ZIP, 30 MB total uncompressed, dan 5.000 baris data per worksheet.
- Test keamanan tambahan untuk spoofed proxy header, token import lintas admin, delete tanpa alasan, health check publik, dan workbook abnormal.

### Changed

- Dokumentasi README, PRD, system design, API contract, admin operations, test plan, deployment plan, runbook, traceability, dan portal HTML diselaraskan dengan status `partial`, batas aktif pembayaran, soft delete, import issues, dan health check `release_id`.
- UI admin import sekarang memberi validasi file, status upload/commit, pesan alasan saat commit belum siap, dan notifikasi hasil commit yang terlihat di dekat form.
- Backend berpindah dari `http.server` manual ke FastAPI agar routing, upload, validasi, dan deployment lebih mudah dipelihara.
- Import XLSX menerima nama file apa pun selama sheet dan header mengikuti struktur workbook resmi.
- NIM yang muncul lebih dari sekali diperlakukan sebagai beberapa tagihan, termasuk saat BRIVA sama, bukan error kritis.
- Public lookup tetap hanya memakai NIM sebagai input dan sekarang menampilkan format informasi pembayaran mahasiswa, termasuk nama, program studi default, periode pembayaran, jumlah tagihan, status, nomor BRIVA, nama rekening BRIVA, dan petunjuk pembayaran.
- Status pembayaran pada hasil publik dipusatkan di header Informasi Mahasiswa dan memakai warna sesuai `Lunas`, `Bayar sebagian`, atau `Belum lunas`; tabel admin memakai indikator status yang sama.
- Upload ulang workbook yang sama tidak lagi menimpa data, mereset status tagihan, atau mengubah waktu pembaruan.
- Mengubah target deployment MVP dari platform terkelola sebelumnya menjadi VPS + SQLite.
- Menetapkan Internal Auth berbasis database, Filesystem VPS untuk import opsional, dan backup SQLite sebagai baseline operasional.
- Menghapus seluruh kredensial default dari halaman admin dan bootstrap server.
- Rate limit lookup di belakang reverse proxy sekarang memakai `X-Real-IP` tepercaya dari Nginx, bukan nilai `X-Forwarded-For` yang dapat dikirim client.
- Health check publik sekarang hanya menampilkan status, versi, dan `release_id`, bukan jumlah data mahasiswa/tagihan.
- Dependency auth admin sekarang memakai exception handler terpusat sehingga endpoint admin tidak perlu guard manual.

### Security

- Menetapkan prinsip bahwa Secret aplikasi dan akses database hanya boleh berada di server environment.
- Menetapkan mitigasi NIM-only lookup melalui rate limit, pesan error generik, lookup log ter-hash, dan monitoring lookup gagal.
- Menambahkan perhatian khusus untuk permission file SQLite, penyimpanan di luar webroot, dan uji restore backup.
- Memperketat commit import agar token harus valid, aktif, dan dimiliki admin pembuat preview atau `super_admin`.

## [0.0.0] - 2026-08-01

### Added

- Repository awal dan README dasar.
