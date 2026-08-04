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
| Admin SALUT | Mengelola data tagihan, metode pembayaran, dan koreksi data. |
| Super Admin | Mengelola admin, konfigurasi sistem, dan audit. |
| Pengelola SALUT | Memastikan data pembayaran akurat dan layanan berjalan. |
| Developer/Ops | Menjaga aplikasi aman, stabil, dan mudah dipelihara. |

## Aktor

| Aktor | Tipe | Deskripsi |
|---|---|---|
| Mahasiswa | Publik terbatas | Mengakses halaman cek tagihan. |
| Admin | Internal | Mengelola tagihan dan metode pembayaran. |
| Super Admin | Internal | Mengelola admin dan konfigurasi global. |
| Sistem | Otomatis | Melakukan validasi, logging, dan masking data. |

## Scope MVP

### In Scope

| ID | Fitur |
|---|---|
| S-MVP-001 | Cek tagihan berdasarkan nama dan NIM. |
| S-MVP-002 | Tampilan tagihan aktif dari workbook yang diimpor. |
| S-MVP-003 | Tampilan instruksi pembayaran aktif. |
| S-MVP-004 | Login admin. |
| S-MVP-005 | Import tagihan dari workbook XLSX yang disetujui dengan preview. |
| S-MVP-006 | Rate limit lookup dan import. |
| S-MVP-007 | Audit log login dan import. |

### Out of Scope MVP

| ID | Fitur |
|---|---|
| S-OOS-001 | Payment gateway otomatis. |
| S-OOS-002 | Sinkronisasi langsung dengan sistem UT. |
| S-OOS-003 | Notifikasi WhatsApp otomatis. |
| S-OOS-004 | Rekonsiliasi bank otomatis. |
| S-OOS-005 | Mobile app native. |
| S-OOS-006 | CRUD manual mahasiswa, tagihan, dan metode pembayaran. |
| S-OOS-007 | Jatuh tempo dan histori pembayaran, karena kolom tersebut tidak tersedia pada workbook saat ini. |

## Functional Requirements

| ID | Requirement | Prioritas | Acceptance Criteria |
|---|---|---|---|
| FR-001 | Mahasiswa dapat membuka halaman cek tagihan tanpa login. | Must | Halaman publik tersedia dan dapat diakses. |
| FR-002 | Mahasiswa dapat memasukkan NIM. | Must | Input menerima NIM dengan format angka sesuai konfigurasi. |
| FR-003 | Sistem meminta nama mahasiswa sebagai pasangan verifikasi NIM. | Must | Form memiliki field nama dan NIM; lookup hanya berhasil bila keduanya cocok. |
| FR-004 | Sistem menampilkan tagihan ditemukan. | Must | Hasil memuat periode, jenis tagihan, nominal, status, BRIVA, dan instruksi. |
| FR-005 | Sistem memasking identitas mahasiswa. | Must | Nama tampil sebagian, contoh `Muh*** Ad***`. |
| FR-006 | Sistem menampilkan instruksi pembayaran aktif. | Must | Minimal satu metode pembayaran tampil jika ada tagihan belum lunas. |
| FR-007 | Sistem menampilkan pesan data tidak ditemukan. | Must | Pesan tidak membocorkan apakah nama salah atau NIM tidak ada. |
| FR-008 | Admin dapat login. | Must | Admin berhasil masuk menggunakan internal auth berbasis email, password hash, dan session server-side. |
| FR-009 | Admin dapat upload workbook XLSX tagihan. | Must | Sistem menampilkan preview, warning, error kritis, tagihan baru, tagihan tidak berubah, dan rencana pembaruan sebelum commit. |
| FR-010 | Sistem menolak commit import bila terdapat baris kritis. | Must | Tidak ada perubahan ketika validasi `Data Sinkron` gagal, BRIVA/NIM duplikat ditemukan, atau tagihan lunas akan diubah. |
| FR-016 | Admin mengonfirmasi perubahan tagihan sensitif. | Must | Perubahan nominal atau BRIVA hanya dapat di-commit setelah konfirmasi eksplisit admin. |
| FR-011 | Sistem mencatat lookup publik. | Should | Log menyimpan waktu, hash NIM, dan hasil umum termasuk `rate_limited`. |
| FR-012 | Admin dengan role yang tepat dapat mengimpor data. | Must | Role `admin` atau `super_admin` dapat import; `viewer` ditolak 403. |
| FR-013 | Rate limit melindungi endpoint publik dan admin. | Must | Lookup dibatasi per IP; import dibatasi per admin. |
| FR-014 | CRUD manual mahasiswa, tagihan, dan metode pembayaran. | Could | Dirilis setelah model data dan SOP koreksi disetujui. |
| FR-015 | Sistem dapat mengekspor laporan tagihan. | Could | Admin dapat mengunduh CSV sesuai filter. |

## Non-Functional Requirements

| ID | Kategori ISO/IEC 25010 | Requirement | Target |
|---|---|---|---|
| NFR-001 | Performance efficiency | Lookup tagihan cepat. | P95 kurang dari 3 detik. |
| NFR-002 | Availability | Aplikasi tersedia untuk publik. | 99 persen pada fase MVP best effort. |
| NFR-003 | Security | Secret tidak terekspos di frontend. | Secret aplikasi hanya di server environment. |
| NFR-004 | Confidentiality | Data pribadi dibatasi. | Nama dimasking, tidak tampil alamat/email/HP penuh. |
| NFR-005 | Integrity | Import tidak merusak data lama tanpa jejak. | Upload ulang yang sama tidak mengubah tagihan; perubahan nominal/BRIVA memerlukan konfirmasi dan audit log preview/commit. |
| NFR-006 | Usability | Mahasiswa non-teknis mudah mengecek tagihan. | Form sederhana, pesan error jelas. |
| NFR-007 | Maintainability | Skema dan API terdokumentasi. | Perubahan wajib memperbarui docs terkait. |
| NFR-008 | Portability | Stack deployable di VPS standar. | Tidak bergantung pada layanan database/auth terkelola untuk MVP. |

## Data Sensitivity

| Data | Kategori | Aturan |
|---|---|---|
| NIM | Personal identifier | Tidak dijadikan satu-satunya autentikasi jika memungkinkan. |
| Nama mahasiswa | Personal data | Tampil publik dalam bentuk masking. |
| Nominal tagihan | Financial data | Tampil hanya setelah verifikasi. |
| Nama + NIM | Verification data | Dipakai sebagai pasangan lookup dan dicatat di log dalam bentuk hash. |
| Audit log | Operational data | Hanya admin berwenang. |

## Assumption

| ID | Asumsi |
|---|---|
| ASM-001 | Sumber data tagihan adalah workbook XLSX `Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx` atau workbook dengan struktur sheet yang sama. |
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
