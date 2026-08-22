# Database Design

## Status Implementasi

Database MVP memakai SQLite di `Backend/data/salut.sqlite`. File database ini diinisialisasi melalui `Backend/schema.sql` dan migrasi otomatis di `Backend/db.py`.

Sistem mendukung 2 layout format Excel:

1. **Format Legacy** (contoh `Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx`):
   - Sheet `Data Sinkron`: `NIM` -> `students.nim`, `Nama Mahasiswa` -> `students.full_name`, `BRIVA` -> `bills.briva`, `Jumlah` -> `bills.amount`.
   - Sheet `Data Belum Lengkap`: dicatat ke tabel `import_issues` untuk data yang tidak lengkap tanpa menghalangi baris valid.

2. **Format Terbaru** (contoh `customer_20260808.xlsx` / file tagihan terkini):
   - Kolom wajib: `NIM`, `Nama`, `No Rek` (sebagai BRIVA), dan `Jumlah`.
   - Kolom profil opsional: `Program Studi` -> `students.program_study`, `Registrasi Awal` -> `students.initial_registration`, `No Hp` -> `students.phone_number`, `Batas Pembayaran` -> `bills.due_date`.

Nama file workbook tidak menjadi syarat bisnis; file `.xlsx` dengan nama apa pun diterima selama struktur sheet dan header sesuai salah satu template di atas. Satu `students.nim` dapat memiliki lebih dari satu baris `bills`, termasuk ketika beberapa tagihan memakai BRIVA yang sama. Idempotensi import dijaga dengan `source_file` dan `source_row_number`.

## Prinsip Desain

- Public lookup hanya melalui API server-side.
- SQLite disimpan di luar webroot dan diakses hanya oleh proses backend.
- UUID disimpan sebagai `text`.
- Timestamp disimpan sebagai ISO-8601 `text`.
- Nominal uang disimpan sebagai `integer` rupiah.
- Query memakai prepared statement.
- Lookup log menyimpan hash NIM, bukan nilai NIM mentah.

## Tabel `students`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID internal yang dibuat aplikasi. |
| `nim` | text | unique, not null | NIM mahasiswa. |
| `full_name` | text | not null | Nama lengkap dari Excel (diformat Capital Each Word / Title Case). |
| `name_norm` | text | not null | Nama ternormalisasi lowercase untuk match case-insensitive. |
| `no_ktp` | text | nullable | Nomor KTP / NIK mahasiswa (16 digit) jika tersedia. |
| `tempat_lahir` | text | nullable | Tempat lahir mahasiswa jika tersedia. |
| `tanggal_lahir` | text | nullable | Tanggal lahir mahasiswa jika tersedia. |
| `nama_ibu_kandung` | text | nullable | Nama ibu kandung mahasiswa jika tersedia. |
| `program_study` | text | nullable | Nama program studi teks (kompatibilitas Excel). |
| `study_program_id` | text | FK `study_programs.id` | Referensi relasional ke master program studi jika terpetakan. |
| `academic_status` | text | not null default 'aktif' | Status akademik mahasiswa: `aktif`, `cuti`, `non_aktif`, `lulus`, `keluar`. |
| `entry_year` | integer | nullable | Tahun angkatan/masuk mahasiswa diekstrak dari registrasi awal (contoh: `2023`). |
| `entry_semester` | text | nullable | Semester masuk: `ganjil` (dari `.1`) atau `genap` (dari `.2`). |
| `entry_period` | text | nullable | Kode periode masuk untuk sorting kronologis (contoh: `2023.1`, `2023.2`). |
| `email` | text | nullable | Alamat email mahasiswa dari Excel (`e-Mail`) atau manual. |
| `address` | text | nullable | Alamat domisili mahasiswa (internal admin). |
| `initial_registration` | text | nullable | Teks registrasi awal dari workbook (contoh: `UNIVERSITAS TERBUKA 2023.1`). |
| `phone_number` | text | nullable | Nomor kontak/HP dari Excel (`No Kontak`), tidak tampil publik. |
| `deleted_at` | text | nullable | Waktu soft delete. Data dengan nilai ini tidak tampil di lookup/list aktif. |
| `deleted_by` | text | nullable | Admin yang melakukan soft delete. |
| `delete_reason` | text | nullable | Alasan soft delete yang wajib diisi lewat API admin. |
| `created_at` | text | not null | Waktu dibuat. |
| `updated_at` | text | not null | Waktu diperbarui. |

## Tabel `study_programs` (Master Data)

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID program studi. |
| `code` | text | unique, not null | Kode prodi seragam 4 karakter alfanumerik huruf kapital unik (misal: `HKUM`, `MANJ`, `AKUN`, `SIFO`, `PGSD`, `PGAI`). |
| `name` | text | not null | Nama resmi program studi (misal: `S1 Ilmu Hukum`). |
| `degree` | text | not null default 'S1' | Jenjang pendidikan (`D3`, `D4`, `S1`, `S2`). |
| `faculty` | text | nullable | Fakultas induk prodi (misal: `FHISIP`). |
| `is_active` | integer | not null default 1 | Status aktif prodi (1=aktif, 0=non-aktif). |
| `created_at` | text | not null | Waktu dibuat. |
| `updated_at` | text | not null | Waktu diperbarui. |

## Tabel `academic_periods` (Master Data)

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID periode akademik. |
| `code` | text | unique, not null | Kode semester standar (misal: `20251` untuk 2025 Ganjil). |
| `name` | text | not null | Nama periode (misal: `2025/2026 Ganjil`). |
| `semester_type` | text | not null | Tipe semester: `ganjil`, `genap`, atau `pendek`. |
| `is_active` | integer | not null default 0 | Status semester aktif saat ini (1=aktif berjalan). |
| `default_due_date` | text | nullable | Tanggal batas akhir pembayaran default (YYYY-MM-DD). |
| `created_at` | text | not null | Waktu dibuat. |
| `updated_at` | text | not null | Waktu diperbarui. |

## Tabel `bill_types` (Master Data)

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID jenis tagihan. |
| `code` | text | unique, not null | Kode komponen biaya (misal: `UKT`, `REG`, `WIS`). |
| `name` | text | not null | Nama jenis tagihan (misal: `UKT SPP Pokok`). |
| `default_amount` | integer | not null default 0 | Nominal standar acuan (dalam rupiah). |
| `is_active` | integer | not null default 1 | Status aktif (1=aktif, 0=non-aktif). |
| `created_at` | text | not null | Waktu dibuat. |

## Tabel `bills`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID tagihan. |
| `student_id` | text | FK `students.id` | Pemilik tagihan. |
| `briva` | text | not null | Nomor BRIVA. Nilai yang sama boleh muncul pada beberapa tagihan untuk NIM yang sama. |
| `amount` | integer | not null | Nominal total tagihan dalam rupiah. |
| `paid_amount` | integer | not null default 0 | Nominal yang telah dibayarkan (untuk status `paid` bernilai sama dengan `amount`, untuk `partial` bernilai antara 1 s.d. `amount - 1`, untuk `unpaid` bernilai 0). |
| `period` | text | not null | Periode data, default `UKT 2023.1 s/d 2025.2` atau kode periode akademik standar. |
| `bill_type` | text | not null | Jenis tagihan, default `UKT BRIVA`. |
| `status` | text | not null | Status tagihan: `unpaid`, `partial` (bayar sebagian/cicilan), atau `paid`; default `unpaid`. |
| `payment_method` | text | not null | Metode pembayaran, default `BRIVA`. |
| `instructions` | text | not null | Instruksi pembayaran yang tampil ke mahasiswa. |
| `due_date` | text | nullable | Batas aktif pembayaran. |
| `source_file` | text | not null | Nama file Excel sumber untuk grouping halaman admin. |
| `source_row_number` | integer | nullable | Nomor baris Excel sumber untuk mencegah re-upload file yang sama menggandakan tagihan. |
| `deleted_at` | text | nullable | Waktu soft delete. Data dengan nilai ini tidak tampil di lookup/list aktif. |
| `deleted_by` | text | nullable | Admin yang melakukan soft delete. |
| `delete_reason` | text | nullable | Alasan soft delete yang wajib diisi lewat API admin. |
| `created_at` | text | not null | Waktu dibuat. |
| `updated_at` | text | not null | Waktu diperbarui. |

## Tabel `lookup_logs`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID log. |
| `nim_hash` | text | not null | Hash NIM. |
| `name_hash` | text | not null | Hash nama ternormalisasi. |
| `result_type` | text | not null | `found`, `not_found`, `invalid`, atau `rate_limited`. |
| `created_at` | text | not null | Waktu lookup. |

## Tabel `import_issues`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID issue. |
| `sheet_name` | text | not null | Nama sheet sumber. |
| `row_number` | integer | not null | Nomor baris Excel. |
| `nim` | text | nullable | NIM bila tersedia. |
| `full_name` | text | nullable | Nama bila tersedia. |
| `briva` | text | nullable | Nomor BRIVA bila tersedia. |
| `amount` | text | nullable | Nilai nominal mentah bila tersedia. |
| `note` | text | not null | Keterangan masalah. |
| `source_file` | text | not null | Nama file Excel sumber. |
| `created_at` | text | not null | Waktu dicatat. |

## Tabel `import_previews`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `token` | text | PK | Token preview format `imp_[0-9a-f]{32}`. |
| `admin_id` | text | FK `admin_users.id` | Admin pembuat preview. Commit hanya boleh oleh admin ini atau `super_admin`. |
| `file_name` | text | not null | Nama file aman yang ditampilkan dan dipakai sebagai `source_file`. |
| `stored_path` | text | not null | Path file preview di folder import server-side. |
| `expires_at` | text | not null | Waktu kedaluwarsa preview. |
| `created_at` | text | not null | Waktu preview dibuat. |

## Index

| Tabel | Index |
|---|---|
| `students` | unique `nim`; index `nim`; index `name_norm`; index `no_ktp`; index `email`; index `phone_number`; index `entry_period`; index `academic_status`; index `study_program_id`. |
| `students` | index `deleted_at`. |
| `bills` | index `student_id`; index `source_file, source_row_number`; index `deleted_at`. |
| `payment_transactions` | index `bill_id`; index `student_id`; index `payment_date`; index `created_at`. |
| `lookup_logs` | index `created_at`. |
| `import_previews` | index `admin_id`; index `expires_at`. |

## SQL Utama

SQL source of truth berada di `Backend/schema.sql`. Ringkasan tabel utama:

```sql
create table if not exists students (
  id text primary key,
  nim text not null unique,
  full_name text not null,
  name_norm text not null,
  no_ktp text,
  tempat_lahir text,
  tanggal_lahir text,
  nama_ibu_kandung text,
  program_study text,
  study_program_id text references study_programs(id) on delete set null,
  academic_status text not null default 'aktif',
  entry_year integer,
  entry_semester text,
  entry_period text,
  email text,
  address text,
  initial_registration text,
  phone_number text,
  deleted_at text,
  deleted_by text,
  delete_reason text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists bills (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  briva text not null,
  amount integer not null,
  paid_amount integer not null default 0,
  period text not null,
  bill_type text not null,
  status text not null default 'unpaid',
  payment_method text not null default 'BRIVA',
  instructions text not null,
  due_date text,
  source_file text not null,
  source_row_number integer,
  deleted_at text,
  deleted_by text,
  delete_reason text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists import_previews (
  token text primary key,
  admin_id text not null references admin_users(id) on delete cascade,
  file_name text not null,
  stored_path text not null,
  expires_at text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists payment_transactions (
  id text primary key,
  bill_id text not null references bills(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  transaction_type text not null default 'payment',
  amount integer not null,
  running_paid_total integer not null,
  previous_status text not null,
  new_status text not null,
  payment_date text not null,
  payment_method text,
  reference_number text,
  notes text,
  recorded_by text references admin_users(id) on delete set null,
  source text not null default 'manual',
  created_at text not null default (datetime('now'))
);
```

## Tabel `admin_users`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID admin. |
| `email` | text | unique, not null | Email login admin. |
| `password_hash` | text | not null | Hash PBKDF2-SHA256. |
| `full_name` | text | nullable | Nama admin. |
| `role` | text | not null | Role admin, default `admin`. |
| `is_active` | integer | not null default 1 | Status aktif 0/1. |
| `created_at` | text | not null | Waktu dibuat. |
| `updated_at` | text | not null | Waktu diperbarui. |

## Tabel `admin_sessions`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID session. |
| `admin_id` | text | FK `admin_users.id` | Admin pemilik session. |
| `token_hash` | text | unique, not null | Hash token cookie, token mentah tidak disimpan. |
| `expires_at` | text | not null | Waktu kedaluwarsa session. |
| `created_at` | text | not null | Waktu dibuat. |

## Tabel `audit_logs`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID audit. |
| `actor_id` | text | FK `admin_users.id`, nullable | Admin pelaku. |
| `action` | text | not null | Contoh `admin.login`, `import.preview`, `import.commit`. |
| `entity_type` | text | not null | Jenis entity. |
| `entity_id` | text | nullable | ID entity atau token import. |
| `metadata` | text | nullable | JSON string ringkasan aman. |
| `created_at` | text | not null | Waktu audit. |

## Tabel `payment_transactions`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID transaksi. |
| `bill_id` | text | FK `bills.id`, not null | Tagihan terkait. |
| `student_id` | text | FK `students.id`, not null | Mahasiswa terkait (denormalisasi untuk query cepat). |
| `transaction_type` | text | not null default 'payment' | `payment` (pembayaran normal), `correction` (koreksi admin), `reversal` (pembatalan/reset). |
| `amount` | integer | not null | Nominal perubahan transaksi ini (positif = pembayaran masuk, negatif = reversal/koreksi). |
| `running_paid_total` | integer | not null | Total kumulatif `paid_amount` setelah transaksi ini diterapkan. |
| `previous_status` | text | not null | Status tagihan sebelum transaksi (`unpaid`, `partial`, `paid`). |
| `new_status` | text | not null | Status tagihan setelah transaksi. |
| `payment_date` | text | not null | Saat ini tanggal lokal server saat perubahan dicatat; input tanggal pembayaran aktual/backdate belum tersedia. |
| `payment_method` | text | nullable | Metode: `BRIVA`, `Transfer Manual`, `Tunai`, dll. |
| `reference_number` | text | nullable | Nomor referensi/bukti transfer. |
| `notes` | text | nullable | Catatan admin (alasan koreksi, keterangan cicilan, dll). |
| `recorded_by` | text | FK `admin_users.id`, nullable | Admin yang mencatat. |
| `source` | text | not null default 'manual' | `manual` (admin ubah status), `import` (dari import XLSX), `system`. |
| `created_at` | text | not null | Waktu pencatatan di sistem. |

## Planned Extension

CRUD manual mahasiswa dan tagihan memakai tabel aktif `students`, `bills`, dan `audit_logs`. Delete manual memakai soft delete melalui `deleted_at`, `deleted_by`, dan `delete_reason`; foreign key cascade hanya menjadi pelindung apabila data benar-benar dihapus pada operasi maintenance khusus.

`payment_transactions` bersifat append-only pada level service karena tidak ada endpoint update/delete. Constraint database belum melarang SQL update/delete dan foreign key masih memakai cascade pada hard delete. Existing payment sebelum fitur ini juga belum di-backfill. Jangan memperlakukan tabel tersebut sebagai ledger akuntansi lengkap sebelum policy tersebut diperkuat.

Schema aktif memiliki 12 tabel aplikasi. Tabel berikut belum diimplementasikan dan akan ditambahkan untuk konfigurasi lanjutan:

| Tabel | Tujuan |
|---|---|
| `system_settings` | Konfigurasi aplikasi. |
