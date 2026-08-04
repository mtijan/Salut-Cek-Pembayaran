# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format mengikuti prinsip Keep a Changelog dan Semantic Versioning.

## [Unreleased]

### Added

- Preview import sekarang membedakan tagihan baru, tidak berubah, akan diperbarui, perubahan nominal, dan penggantian BRIVA.
- Konfirmasi eksplisit admin untuk perubahan nominal atau BRIVA, termasuk daftar contoh perubahan sebelum commit.
- Validasi kritis untuk BRIVA/NIM duplikat dalam workbook, konflik tagihan per NIM/periode, dan perubahan tagihan berstatus `paid`.
- Baseline dokumentasi ISO-aligned untuk requirement, desain sistem, diagram, database, API, keamanan, operasi, testing, deployment, project management, risk register, traceability, dan release plan.
- `.gitignore` awal untuk melindungi dependency, build output, secret, runtime data, backup, session, database lokal, dan log.
- Portal HTML dokumentasi dengan tampilan ringkas untuk membaca requirement, diagram, database, API, security, testing, deployment, risiko, dan traceability.
- Diagram tambahan untuk DFD Level 0, DFD Level 1, UML-style class diagram, dan UML-style component diagram.
- Paket diagram lanjutan untuk activity lookup/import, BPMN-style business process, C4 container, data lifecycle, data privacy, authentication dan authorization, keputusan validasi import, backup dan recovery, CI/CD, serta sitemap.
- Implementasi awal `Backend/` dan `Frontend/` untuk lookup tagihan publik.
- Importer Excel khusus workbook `Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx` dengan 408 data lengkap dan 9 issue data belum lengkap.
- Admin MVP untuk login, session cookie, upload Excel, preview import, commit import, dan audit log dasar.
- Rate limit untuk lookup, login gagal, dan import; role check untuk import; validasi commit tanpa baris kritis; serta header keamanan respons.
- Template environment production, konfigurasi Nginx/systemd, dan timer backup SQLite.
- Deployment production VPS pada 2026-08-02 dengan HTTPS Let's Encrypt, service systemd, backup SQLite terjadwal, dan smoke test lookup/login.

### Changed

- Public lookup sekarang hanya memakai NIM dan menampilkan nama mahasiswa penuh setelah data ditemukan.
- Upload ulang workbook yang sama tidak lagi menimpa data, mereset status tagihan, atau mengubah waktu pembaruan.
- Mengubah target deployment MVP dari platform terkelola sebelumnya menjadi VPS + SQLite.
- Menetapkan Internal Auth berbasis database, Filesystem VPS untuk import opsional, dan backup SQLite sebagai baseline operasional.
- Menghapus seluruh kredensial default dari halaman admin dan bootstrap server.

### Security

- Menetapkan prinsip bahwa Secret aplikasi dan akses database hanya boleh berada di server environment.
- Menetapkan mitigasi NIM-only lookup melalui rate limit, pesan error generik, lookup log ter-hash, dan monitoring lookup gagal.
- Menambahkan perhatian khusus untuk permission file SQLite, penyimpanan di luar webroot, dan uji restore backup.

## [0.0.0] - 2026-08-01

### Added

- Repository awal dan README dasar.
