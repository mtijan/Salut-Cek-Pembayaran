# Database Design

## Status Implementasi

Database MVP awal sudah memakai SQLite di `Backend/data/salut.sqlite`. File database ini dibuat dari workbook `Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx` melalui `Backend/import_excel.py`.

Data lookup mahasiswa memakai sheet `Data Sinkron` dengan kolom:

| Kolom Excel | Tabel | Keterangan |
|---|---|---|
| `NIM` | `students.nim` | Unique key mahasiswa. |
| `Nama Mahasiswa` | `students.full_name`, `students.name_norm` | Nama asli dan versi ternormalisasi untuk import serta administrasi internal. |
| `BRIVA` | `bills.briva` | Nomor BRIVA pembayaran. |
| `Jumlah` | `bills.amount` | Nominal tagihan dalam rupiah. |

Sheet `Data Belum Lengkap` tidak dipakai untuk lookup publik dan dicatat ke `import_issues`.

Nama file workbook tidak menjadi syarat bisnis; file `.xlsx` dengan nama apa pun diterima bila memiliki sheet `Data Sinkron` dan `Data Belum Lengkap` dengan header wajib yang sama seperti workbook resmi. Satu `students.nim` dapat memiliki lebih dari satu baris `bills`, termasuk ketika beberapa tagihan memakai BRIVA yang sama. Idempotensi import dijaga dengan `source_file` dan `source_row_number`.

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
| `full_name` | text | not null | Nama lengkap dari Excel. |
| `name_norm` | text | not null | Nama ternormalisasi untuk match case-insensitive. |
| `created_at` | text | not null | Waktu dibuat. |
| `updated_at` | text | not null | Waktu diperbarui. |

## Tabel `bills`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | text | PK | UUID tagihan. |
| `student_id` | text | FK `students.id` | Pemilik tagihan. |
| `briva` | text | not null | Nomor BRIVA. Nilai yang sama boleh muncul pada beberapa tagihan untuk NIM yang sama. |
| `amount` | integer | not null | Nominal tagihan dalam rupiah. |
| `period` | text | not null | Periode data, default `UKT 2023.1 s/d 2025.2`. |
| `bill_type` | text | not null | Jenis tagihan, default `UKT BRIVA`. |
| `status` | text | not null | Status tagihan, `unpaid` atau `paid`; default `unpaid`. |
| `payment_method` | text | not null | Metode pembayaran, default `BRIVA`. |
| `instructions` | text | not null | Instruksi pembayaran yang tampil ke mahasiswa. |
| `source_file` | text | not null | Nama file Excel sumber untuk grouping halaman admin. |
| `source_row_number` | integer | nullable | Nomor baris Excel sumber untuk mencegah re-upload file yang sama menggandakan tagihan. |
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

## Index

| Tabel | Index |
|---|---|
| `students` | unique `nim`; index `nim`; index `name_norm`. |
| `bills` | index `student_id`; index `source_file, source_row_number`. |
| `lookup_logs` | index `created_at`. |

## SQL Utama

SQL source of truth berada di `Backend/schema.sql`. Ringkasan tabel utama:

```sql
create table if not exists students (
  id text primary key,
  nim text not null unique,
  full_name text not null,
  name_norm text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists bills (
  id text primary key,
  student_id text not null references students(id) on delete cascade,
  briva text not null,
  amount integer not null,
  period text not null,
  bill_type text not null,
  status text not null default 'unpaid',
  payment_method text not null default 'BRIVA',
  instructions text not null,
  source_file text not null,
  source_row_number integer,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
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

## Planned Extension

CRUD manual mahasiswa dan tagihan memakai tabel aktif `students`, `bills`, dan `audit_logs`. Tabel berikut belum diimplementasikan dan akan ditambahkan untuk konfigurasi lanjutan:

| Tabel | Tujuan |
|---|---|
| `system_settings` | Konfigurasi aplikasi. |
