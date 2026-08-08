# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format mengikuti prinsip Keep a Changelog dan Semantic Versioning.

## [Unreleased]

### Added

- Health check sekarang menyertakan `release_id` non-rahasia agar versi code yang aktif di VPS dapat diverifikasi setelah deploy.
- Backend FastAPI/Uvicorn dengan struktur modul `Backend/app` untuk routing, konfigurasi, response, security, rate limit, dan service.
- Preview import sekarang membedakan tagihan baru, tidak berubah, akan diperbarui, perubahan nominal, dan penggantian BRIVA.
- Dashboard admin sekarang menampilkan tagihan terimport per nama file dan menyediakan checkbox status lunas/belum lunas.
- Public lookup memberi label `Tagihan 1`, `Tagihan 2`, dan seterusnya bila satu NIM memiliki lebih dari satu tagihan.
- Public lookup sekarang menjumlahkan beberapa nominal tagihan menjadi `Total Tagihan` sambil tetap menampilkan nominal masing-masing tagihan.
- Endpoint admin untuk daftar tagihan terimport dan update status tagihan.
- Endpoint admin CRUD manual untuk mahasiswa dan tagihan: list/search, create, update, delete, dan audit log.
- Dashboard admin bagian `Kelola Manual` untuk tambah/edit/hapus mahasiswa dan tagihan tanpa import Excel.
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

- UI admin import sekarang memberi validasi file, status upload/commit, pesan alasan saat commit belum siap, dan notifikasi hasil commit yang terlihat di dekat form.
- Backend berpindah dari `http.server` manual ke FastAPI agar routing, upload, validasi, dan deployment lebih mudah dipelihara.
- Import XLSX menerima nama file apa pun selama sheet dan header mengikuti struktur workbook resmi.
- NIM yang muncul lebih dari sekali diperlakukan sebagai beberapa tagihan, termasuk saat BRIVA sama, bukan error kritis.
- Public lookup tetap hanya memakai NIM sebagai input dan sekarang menampilkan format informasi pembayaran mahasiswa, termasuk nama, program studi default, periode pembayaran, jumlah tagihan, status, nomor BRIVA, nama rekening BRIVA, dan petunjuk pembayaran.
- Status `Lunas` pada hasil publik dipusatkan di header Informasi Mahasiswa dan memakai warna hijau; tabel admin tetap memakai indikator status lunas/belum lunas.
- Upload ulang workbook yang sama tidak lagi menimpa data, mereset status tagihan, atau mengubah waktu pembaruan.
- Mengubah target deployment MVP dari platform terkelola sebelumnya menjadi VPS + SQLite.
- Menetapkan Internal Auth berbasis database, Filesystem VPS untuk import opsional, dan backup SQLite sebagai baseline operasional.
- Menghapus seluruh kredensial default dari halaman admin dan bootstrap server.
- Rate limit lookup di belakang reverse proxy sekarang memakai `X-Real-IP` tepercaya dari Nginx, bukan nilai `X-Forwarded-For` yang dapat dikirim client.
- Health check publik sekarang hanya menampilkan status dan versi, bukan jumlah data mahasiswa/tagihan.
- Dependency auth admin sekarang memakai exception handler terpusat sehingga endpoint admin tidak perlu guard manual.

### Security

- Menetapkan prinsip bahwa Secret aplikasi dan akses database hanya boleh berada di server environment.
- Menetapkan mitigasi NIM-only lookup melalui rate limit, pesan error generik, lookup log ter-hash, dan monitoring lookup gagal.
- Menambahkan perhatian khusus untuk permission file SQLite, penyimpanan di luar webroot, dan uji restore backup.
- Memperketat commit import agar token harus valid, aktif, dan dimiliki admin pembuat preview atau `super_admin`.

## [0.0.0] - 2026-08-01

### Added

- Repository awal dan README dasar.
