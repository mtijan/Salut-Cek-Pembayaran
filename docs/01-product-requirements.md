# Product Requirements

## Ringkasan Produk

Salut Cek Pembayaran adalah aplikasi web ringan untuk membantu mahasiswa UT yang berafiliasi dengan SALUT Awwabin mengecek status tagihan dan instruksi pembayaran tanpa harus menghubungi admin secara manual.

## Sasaran Bisnis

| ID | Sasaran | Indikator |
|---|---|---|
| OBJ-001 | Mengurangi pertanyaan manual terkait tagihan. | Penurunan chat/telepon pengecekan tagihan. |
| OBJ-002 | Mempercepat akses informasi pembayaran. | Mahasiswa mendapat hasil dalam kurang dari 3 detik pada kondisi normal. |
| OBJ-003 | Menjaga keamanan data mahasiswa. | Tidak ada data pribadi berlebih tampil di halaman publik. |
| OBJ-004 | Memudahkan admin memperbarui data. | Admin dapat import data tagihan tanpa bantuan developer. |

## Stakeholder

| Stakeholder | Kepentingan |
|---|---|
| Mahasiswa | Mendapat informasi tagihan dan cara pembayaran dengan cepat. |
| Admin SALUT | Mengelola data mahasiswa, tagihan, batas aktif pembayaran, import, dan koreksi data. |
| Super Admin | Mengelola admin, konfigurasi sistem, dan audit. |
| Pengelola SALUT | Memastikan data pembayaran akurat dan layanan berjalan. |
| Developer/Ops | Menjaga aplikasi aman, stabil, dan mudah dipelihara. |

## Aktor

| Aktor | Tipe | Deskripsi |
|---|---|---|
| Mahasiswa | Publik terbatas | Mengakses halaman cek tagihan. |
| Admin | Internal | Mengelola mahasiswa, tagihan, status pembayaran, batas aktif, dan import. |
| Super Admin | Internal | Mengelola admin dan konfigurasi global. |
| Sistem | Otomatis | Melakukan validasi, logging, dan pembatasan akses lookup. |

## Scope MVP

### In Scope

| ID | Fitur |
|---|---|
| S-MVP-001 | Cek tagihan berdasarkan NIM. |
| S-MVP-002 | Tampilan tagihan aktif dari workbook yang diimpor. |
| S-MVP-003 | Tampilan instruksi pembayaran aktif. |
| S-MVP-004 | Login admin. |
| S-MVP-005 | Import tagihan dari workbook XLSX yang disetujui dengan preview (format legacy dan format terbaru). |
| S-MVP-006 | Rate limit lookup, login gagal, dan import. |
| S-MVP-007 | Audit log login, import, update status/due-date, dan CRUD manual. |
| S-MVP-008 | Admin melihat tagihan per file import, mengatur status `Belum lunas`, `Bayar sebagian`, atau `Lunas`, serta menghapus data import per file dengan alasan. |
| S-MVP-009 | Admin mengatur batas aktif pembayaran per tagihan atau secara massal per file import. |
| S-MVP-010 | Admin mengelola data mahasiswa dan tagihan dengan pencarian, filter status/sumber, paginasi, dan soft delete berdasar alasan. |
| S-MVP-011 | Master data terstruktur: Program Studi dan Periode Akademik; Jenis Tagihan masih berupa tabel/seed dan pilihan form, belum CRUD penuh. |
| S-MVP-012 | Student Profile 360 (biodata lengkap, status akademik, angkatan, histori tagihan seluruh periode). |
| S-MVP-013 | Dashboard statistik & rekapitulasi keuangan (penerimaan vs tunggakan per prodi dan semester). |
| S-MVP-014 | Role-Based Access Control (RBAC) terpadu (`super_admin`, `admin`, `viewer`). |
| S-MVP-015 | Portal Dokumentasi Interaktif & ISO/IEC Standard Compliance Docs. |

### Out of Scope MVP

| ID | Fitur |
|---|---|
| S-OOS-001 | Payment gateway otomatis. |
| S-OOS-002 | Sinkronisasi langsung dengan sistem UT. |
| S-OOS-003 | Notifikasi WhatsApp otomatis. |
| S-OOS-004 | Rekonsiliasi bank otomatis. |
| S-OOS-005 | Mobile app native. |
| S-OOS-006 | Login portal mahasiswa untuk pengisian KRS dan kartu hasil studi (KHS) mandiri (disiapkan untuk fase SIAKAD lanjutan). |

## Functional Requirements

| ID | Requirement | Prioritas | Acceptance Criteria |
|---|---|---|---|
| FR-001 | Mahasiswa dapat membuka halaman cek tagihan tanpa login. | Must | Halaman publik dapat diakses tanpa sesi/akun. |
| FR-002 | Mahasiswa dapat memasukkan NIM. | Must | Form hanya meminta NIM; validasi format dilakukan di client dan server. |
| FR-003 | Sistem mencari tagihan berdasarkan NIM. | Must | Lookup berhasil bila NIM ditemukan pada data mahasiswa aktif. |
| FR-004 | Sistem menampilkan tagihan yang ditemukan. | Must | Menampilkan periode, jenis tagihan, nominal rupiah, status, nomor BRIVA, petunjuk, batas aktif jika ada, dan label `Tagihan 1`, `Tagihan 2`, serta `Total Tagihan` jika lebih dari satu tagihan. |
| FR-005 | Lookup publik menampilkan identitas mahasiswa terbatas. | Must | Hasil lookup menampilkan NIM, nama lengkap mahasiswa, program studi, dan periode pembayaran default. |
| FR-006 | Sistem menampilkan instruksi pembayaran default. | Must | Instruksi pembayaran BRIVA ditampilkan secara terstruktur. |
| FR-007 | Sistem menampilkan pesan aman jika data tidak ditemukan. | Must | Menampilkan pesan umum tanpa membocorkan detail database. |
| FR-008 | Admin dapat login. | Must | Login menggunakan email dan password yang diverifikasi terhadap database internal. |
| FR-009 | Admin dapat mengimpor tagihan dari workbook XLSX. | Must | Mendukung format legacy (`Data Sinkron` & `Data Belum Lengkap`) dan format master data 13 kolom (`NIM`, `Nama`, `NO KTP`, `Tempat Lahir`, `Tanggal Lahir`, `Nama Ibu Kandung`, `e-Mail`, `No Kontak`, `Registrasi Awal`, `Program Studi`, `No Rek`, `Jumlah`, `Batas Pembayaran`); preview membedakan data baru, tidak berubah, dan perubahan sebelum commit. |
| FR-010 | Sistem menolak import dengan error kritis. | Must | Commit ditolak bila ada BRIVA sama untuk NIM berbeda, format angka rusak, atau data wajib kosong. |
| FR-016 | Sistem mewajibkan konfirmasi admin saat nominal atau BRIVA berubah pada import. | Must | Preview mendeteksi perubahan; commit ditolak tanpa persetujuan eksplisit admin. |
| FR-011 | Lookup publik dicatat untuk audit keamanan. | Must | Hash NIM dan status pencarian dicatat pada `lookup_logs`. |
| FR-012 | Admin dengan role yang tepat dapat mengimpor data. | Must | Role `admin` atau `super_admin` dapat import; `viewer` ditolak 403. |
| FR-013 | Rate limit melindungi endpoint publik dan admin. | Must | Lookup dibatasi per IP (10/10m); login dibatasi per IP+email (5/15m); import dibatasi per admin. |
| FR-014 | CRUD manual mahasiswa dan tagihan. | Must | Admin dapat tambah, cari, ubah, dan hapus (soft delete dengan alasan) mahasiswa/tagihan dari dashboard; edit tagihan mempertahankan identitas mahasiswa tanpa dropdown pilih mahasiswa. |
| FR-015 | Sistem dapat mengekspor laporan tagihan dan template. | Should | Admin dapat mengunduh data tagihan, rekapitulasi, dan template Excel Master Data 13 kolom. |
| FR-017 | Admin dapat melihat tagihan terimport berdasarkan nama file. | Must | Dashboard admin mengelompokkan tagihan berdasarkan `source_file` lengkap dengan metrik total tagihan, jumlah mahasiswa, total nominal, dan ringkasan status. |
| FR-018 | Admin dapat mengubah status pembayaran dan nominal bayar sebagian. | Must | Select status pada tabel admin atau modal edit mengubah `bills.status` menjadi `unpaid`, `partial`, atau `paid`; pada status `partial`, admin wajib memasukkan `paid_amount` sehingga sisa tagihan terhitung otomatis dan tercatat pada audit log. |
| FR-019 | Admin dapat mengubah batas aktif pembayaran. | Must | Admin dapat menyimpan `due_date` satu tagihan atau massal per file import, update tercatat di audit log, dan tanggal tampil di dashboard admin serta hasil lookup publik. |
| FR-020 | Admin dapat menghapus kumpulan tagihan per file import. | Must | Admin dapat menghapus file import melalui API/UI dengan alasan wajib; seluruh tagihan terkait di-soft-delete dan `import_issues` dibersihkan. |
| FR-021 | Admin dapat memfilter dan menavigasi daftar tagihan secara terpaginasi. | Must | Tabel tagihan admin menyediakan pencarian teks, filter status (`unpaid`, `partial`, `paid`), filter sumber (`import`, `manual`), dan paginasi (100 data per halaman). |
| FR-022 | Admin dapat mengelola Master Program Studi. | Must | Admin dapat membuat, melihat, mengubah, dan menonaktifkan program studi dengan kode seragam 4 karakter alfanumerik kapital unik (misal `HKUM`, `MANJ`, `AKUN`, `SIFO`, `PGSD`, `PGAI`). |
| FR-023 | Admin dapat mengelola Master Periode Akademik. | Must | Admin dapat mengelola semester/periode akademik (kode misal `20251`, nama, tipe ganjil/genap, status aktif, batas pembayaran default). |
| FR-024 | Admin dapat mengelola Master Jenis Tagihan. | Should | Admin dapat mendefinisikan komponen biaya (kode, nama, nominal standar). API/UI belum diimplementasikan pada checkout audit 2026-08-21. |
| FR-025 | Admin dapat melihat Student Profile 360 lengkap. | Must | Tampilan profil terpusat per mahasiswa memuat biodata lengkap (NIM, Nama, No KTP, Tempat/Tgl Lahir, Ibu Kandung, Email, No Kontak, Alamat), status akademik, periode masuk (Ganjil/Genap), serta riwayat tagihan. |
| FR-026 | Sistem menyediakan Dashboard Statistik & Ringkasan Metrik. | Must | Halaman utama admin memuat metrik total mahasiswa aktif, total tagihan semester berjalan, persentase lunas/cicilan, dan total tunggakan. |
| FR-027 | Admin dapat melihat dan mengekspor Rekapitulasi Keuangan. | Must | Implementasi saat ini menghasilkan rekap penerimaan vs tunggakan per program studi dan ekspor CSV; dimensi/filter periode akademik masih backlog. |
| FR-028 | Sistem menerapkan Role-Based Access Control (RBAC) terpadu. | Must | Mendukung `super_admin`, `admin`, dan `viewer` dengan pembatasan server-side. Viewer read-only lintas students/bills/history dan user management super admin masih backlog. |
| FR-029 | Panel Admin berbasis Single Page Application (SPA) React + Vite. | Must | Antarmuka admin dibangun menggunakan React + Vite dengan rendering modular, responsive design, dan integrasi penuh ke REST API backend. |
| FR-030 | Normalisasi Nama Mahasiswa Capital Each Word. | Must | Sistem otomatis membersihkan spasi berlebih dan memformat nama mahasiswa menjadi Capital Each Word (Title Case) saat import maupun simpan manual. |
| FR-031 | Ekstraksi Periode Masuk (Ganjil/Genap) & Sorting Kronologis. | Must | Sistem mengekstrak Registrasi Awal (Tahun.1 = Ganjil, Tahun.2 = Genap) ke kolom `entry_year`, `entry_semester`, `entry_period` sehingga daftar mahasiswa dapat diurutkan dan difilter berdasarkan angkatan/periode awal masuk. |
| FR-032 | Download Template Master Data Mahasiswa. | Must | Admin dapat mengunduh template resmi file Excel 13 kolom dengan format dan petunjuk pengisian yang valid. |
| FR-033 | Filter & Pencarian Mahasiswa Berdasarkan Program Studi. | Must | Admin dapat mencari dan memfilter daftar mahasiswa berdasarkan dropdown Program Studi (mencakup seluruh jurusan UT) serta pencarian teks (nama/kode prodi). |
| FR-034 | Form Edit Tagihan Terstruktur & Kalkulasi Bayar Sebagian. | Must | Modal edit tagihan menampilkan data mahasiswa read-only; Jenis Tagihan berupa dropdown (`UKT`, `WISUDA`, `Custom`); Periode Tagihan berupa dropdown Master Periode + `Custom` (otomatis terdaftar global); Status `Bayar sebagian` meminta nominal dibayar dan menampilkan sisa tagihan secara real-time. |
| FR-035 | Sistem mencatat setiap perubahan status pembayaran sebagai histori transaksi kronologis. | Must | Perubahan manual `status` atau `paid_amount` menghasilkan entry `payment_transactions` dalam transaksi yang sama, termasuk tanggal, referensi, dan catatan opsional. Trigger SQLite mencegah update/delete entry. |
| FR-036 | Admin dapat melihat riwayat pembayaran per tagihan dan per mahasiswa. | Must | Student Profile 360 dan detail tagihan menampilkan histori terpaginasi melalui endpoint transaksi. |

## Status Implementasi Audit 2026-08-21

Requirement adalah target produk, bukan bukti bahwa semua item selesai. Status per requirement berada di `docs/12-traceability-matrix.md`; temuan dan release blocker berada di `docs/14-codebase-audit-mitigation-plan.md`. Item yang paling penting belum selesai adalah FR-024, dimensi periode FR-027, viewer/user-management FR-028, serta endpoint FR-036.

## Non-Functional Requirements

| ID | Kategori ISO/IEC 25010 | Requirement | Target |
|---|---|---|---|
| NFR-001 | Performance efficiency | Lookup tagihan cepat. | P95 kurang dari 3 detik. |
| NFR-002 | Availability | Aplikasi tersedia untuk publik. | 99 persen pada fase MVP best effort. |
| NFR-003 | Security | Secret tidak terekspos di frontend. | Secret aplikasi hanya di server environment. |
| NFR-004 | Confidentiality | Data pribadi dibatasi. | Hanya NIM, nama, program studi, periode pembayaran, dan detail pembayaran yang dikirim setelah lookup berhasil; alamat, email, dan HP tidak dikirim atau ditampilkan pada halaman publik. |
| NFR-005 | Integrity | Import dan koreksi manual tidak merusak data lama tanpa jejak. | Upload ulang yang sama tidak mengubah tagihan; perubahan nominal/BRIVA memerlukan konfirmasi; update status, batas aktif, dan delete manual tercatat di audit log. |
| NFR-006 | Usability | Mahasiswa non-teknis mudah mengecek tagihan. | Form sederhana, pesan error jelas. |
| NFR-007 | Maintainability | Skema dan API terdokumentasi. | Perubahan wajib memperbarui docs terkait. |
| NFR-008 | Portability | Stack deployable di VPS standar. | Tidak bergantung pada layanan database/auth terkelola untuk MVP. |

## Data Sensitivity

| Data | Kategori | Aturan |
|---|---|---|
| NIM | Personal identifier | Tidak dijadikan satu-satunya autentikasi jika memungkinkan. |
| Nama mahasiswa | Personal data | Ditampilkan setelah NIM ditemukan agar mahasiswa dapat memverifikasi nama rekening BRIVA. |
| Nominal tagihan | Financial data | Tampil hanya setelah verifikasi. |
| NIM | Lookup data | Dipakai sebagai kunci pencarian dan dicatat di log dalam bentuk hash. |
| Audit log | Operational data | Hanya admin berwenang. |

## Assumption

| ID | Asumsi |
|---|---|
| ASM-001 | Sumber data tagihan adalah workbook XLSX dengan format legacy (`Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx`) atau format terbaru (`NIM`, `Nama`, `No Rek`, `Jumlah`). |
| ASM-002 | Data tidak tersinkronisasi otomatis dengan UT pada MVP. |
| ASM-003 | SALUT Awwabin memiliki kewenangan menampilkan informasi tagihan kepada mahasiswa terkait. |
| ASM-004 | VPS dan SQLite cukup untuk beban awal aplikasi. |

## Constraint

| ID | Constraint |
|---|---|
| CON-001 | Biaya operasional harus rendah. |
| CON-002 | Admin harus dapat mengelola data tanpa akses database langsung. |
| CON-003 | Sistem harus menghindari kebocoran data akibat NIM enumeration. |
| CON-004 | Implementasi MVP harus sederhana dan mudah dipelihara. |

## Success Metrics

| Metric | Target Awal |
|---|---|
| Lookup berhasil | Lebih dari 95 persen untuk data valid. |
| Error import | Semua error baris tampil sebelum data disimpan. |
| Waktu pencarian | P95 kurang dari 3 detik. |
| Security incident | 0 insiden kebocoran secret/data. |
| Admin manual support | Menurun setelah publikasi web. |
