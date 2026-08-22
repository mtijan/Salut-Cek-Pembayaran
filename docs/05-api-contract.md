# API Contract

## Prinsip API

- Semua endpoint API mengembalikan JSON kecuali download template master-data yang mengembalikan file XLSX.
- Endpoint publik hanya menerima NIM sebagai input dan mengembalikan informasi pembayaran yang dibutuhkan mahasiswa.
- Endpoint import admin wajib autentikasi dan role check.
- Error response tidak boleh membocorkan detail database atau secret.
- Setiap response error menyertakan `request_id`.

## Format Response Umum

### Success

```json
{
  "success": true,
  "data": {}
}
```

`request_id` selalu ada pada error response. Success response umum tidak menyertakannya; success lookup publik adalah pengecualian karena handler membangun response dengan request ID.

## Inventaris Route Aktif 2026-08-21

OpenAPI lokal memuat 26 path dan 33 operation. Permission adalah argumen `require_admin()` aktual.

| Method | Path | Akses aktual |
|---|---|---|
| GET | `/api/health` | Public |
| POST | `/api/lookup` | Public + rate limit |
| POST | `/api/admin/login` | Public + failed-login rate limit |
| GET | `/api/admin/me` | Session aktif |
| POST | `/api/admin/logout` | Session opsional/idempotent |
| GET | `/api/admin/imported-bills` | `import` |
| DELETE | `/api/admin/imported-files` | `manage_data` |
| POST | `/api/admin/bills/status` | `import` |
| POST | `/api/admin/bills/due-date` | `import` |
| GET | `/api/admin/dashboard/stats` | `view_reports` |
| GET | `/api/admin/reports/financial-summary` | `view_reports` |
| GET | `/api/admin/study-programs` | `view_reports` |
| POST, PATCH, DELETE | `/api/admin/study-programs`, `/api/admin/study-programs/{program_id}` | `manage_master_data` |
| GET | `/api/admin/academic-periods` | `view_reports` |
| POST, PATCH | `/api/admin/academic-periods`, `/api/admin/academic-periods/{period_id}` | `manage_master_data` |
| GET | `/api/admin/template/master-data` | `manage_data` |
| GET, POST | `/api/admin/students` | `manage_data` |
| GET | `/api/admin/students/{student_id}/detail` | `manage_data` |
| PATCH, DELETE | `/api/admin/students/{student_id}` | `manage_data` |
| GET | `/api/admin/import-issues` | `manage_data` |
| GET, POST | `/api/admin/bills` | `manage_data` |
| PATCH, DELETE | `/api/admin/bills/{bill_id}` | `manage_data` |
| GET | `/api/admin/bills/{bill_id}/transactions` | Broken: meminta permission `viewer` |
| GET | `/api/admin/students/{student_id}/transactions` | Broken: meminta permission `viewer` |
| POST | `/api/admin/import/preview` | `import` + rate limit |
| POST | `/api/admin/import/commit` | `import` + rate limit |

Konfigurasi masih menyimpan role kompatibilitas `admin_akademik` dan `admin_keuangan` selain tiga role UI (`viewer`, `admin`, `super_admin`). Penyatuan role belum sepenuhnya selesai dan harus diuji sebagai bagian AUD-2026-007.

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang dimasukkan belum valid."
  },
  "request_id": "req_..."
}
```

## Public API

### `GET /api/health`

Health check publik untuk verifikasi service dan release.

Response 200:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.2.0",
    "release_id": "commit-or-release-id"
  }
}
```

Endpoint ini tidak mengembalikan jumlah mahasiswa, tagihan, import issue, atau data bisnis lain.

### `POST /api/lookup`

Mencari tagihan mahasiswa.

Request:

```json
{
  "nim": "050117077"
}
```

Response 200:

```json
{
  "success": true,
  "data": {
    "student": {
      "nim": "050117077",
      "full_name": "Syahla Taqiyyah",
      "program_study": "S1 Ilmu Hukum",
      "payment_period": "Semester Ganjil 2026",
      "due_date": "2026-08-25",
      "due_date_formatted": "25 Agustus 2026"
    },
    "bills": [
      {
        "period": "UKT 2023.1 s/d 2025.2",
        "bill_label": "UKT BRIVA",
        "bill_type": "UKT BRIVA",
        "status": "unpaid",
        "amount": 1850000,
        "amount_formatted": "Rp 1.850.000",
        "payment_method": "BRIVA",
        "briva": "178100023200040",
        "instructions": "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil.",
        "due_date": "2026-08-25",
        "due_date_formatted": "25 Agustus 2026"
      }
    ]
  },
  "request_id": "req_..."
}
```

Response 404:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Data tagihan tidak ditemukan. Pastikan NIM sesuai data SALUT."
  },
  "request_id": "req_..."
}
```

## Admin API

Semua endpoint admin memakai session internal auth.

### `POST /api/admin/login`

Login admin memakai email dan password.

Request:

```json
{
  "email": "admin@salut.example",
  "password": "password-admin"
}
```

Response 200 mengirim cookie `salut_admin_session` dengan flag `HttpOnly` dan `SameSite=Lax`; production juga memakai flag `Secure`.

### `GET /api/admin/me`

Mengambil profil admin dari session aktif.

### `POST /api/admin/logout`

Menghapus session admin aktif.

### `POST /api/admin/import/preview`

Upload file Excel `.xlsx` dengan nama file apa pun, mendukung format legacy (sheet `Data Sinkron` berisi `NIM`, `Nama Mahasiswa`, `BRIVA`, `Jumlah` dan sheet `Data Belum Lengkap`) serta format terbaru (sheet berisi kolom `NIM`, `Nama`, `No Rek`, `Jumlah` beserta metadata profil opsional), lalu mengembalikan ringkasan tanpa commit ke tabel tagihan.

Upload dibatasi maksimal 5 MB compressed. Parser juga membatasi ukuran hasil ekstraksi: maksimal 20 MB per entry ZIP, 30 MB total uncompressed workbook, dan 5.000 baris data per worksheet.

Form data:

| Field | Tipe | Keterangan |
|---|---|---|
| `file` | file | Workbook Excel tagihan. |

Response:

```json
{
  "success": true,
  "data": {
    "import_token": "imp_...",
    "file_name": "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx",
    "valid_rows": 409,
    "critical_rows": 0,
    "issue_rows": 11,
    "new_rows": 409,
    "unchanged_rows": 0,
    "update_rows": 0,
    "amount_change_rows": 0,
    "briva_change_rows": 0,
    "multiple_bill_rows": 2,
    "duplicate_briva_conflict_rows": 0,
    "requires_update_confirmation": false,
    "sample": [],
    "changes": [],
    "errors": []
  }
}
```

### `POST /api/admin/import/commit`

Commit file Excel yang sudah dipreview ke SQLite. `import_token` wajib mengikuti format `imp_[0-9a-f]{32}` dan harus terdaftar pada tabel `import_previews`. Commit hanya boleh dilakukan oleh admin yang membuat preview atau role `super_admin`. Commit ditolak bila `critical_rows` lebih dari 0. Bila preview mendeteksi perubahan nominal atau BRIVA, `confirm_updates` wajib bernilai `true`. Upload ulang data yang sama tidak memperbarui baris maupun status tagihan. Issue dari sheet `Data Belum Lengkap` dicatat sebagai warning dan tidak menghalangi baris valid. NIM yang muncul lebih dari satu kali disimpan sebagai beberapa tagihan, termasuk ketika BRIVA sama; BRIVA yang sama untuk NIM berbeda tetap menjadi konflik kritis.

Request:

```json
{
  "import_token": "imp_...",
  "confirm_updates": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "imported": 409,
    "created": 409,
    "updated": 0,
    "unchanged": 0,
    "issues": 9
  }
}
```

### `GET /api/admin/imported-bills`

Mengambil tagihan yang sudah tersimpan, dikelompokkan berdasarkan nama file import. Setiap grup juga memuat ringkasan versi import: `student_count`, `total_amount`, `imported_at`, dan hitungan status (`paid`, `partial`, `unpaid`).

Response:

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "file_name": "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx",
        "total": 409,
        "student_count": 408,
        "total_amount": 756650000,
        "imported_at": "2026-08-12 09:15:00",
        "paid": 12,
        "partial": 0,
        "unpaid": 396,
        "bills": []
      }
    ]
  }
}
```

### `DELETE /api/admin/imported-files`

Menghapus seluruh tagihan yang berasal dari file import tertentu secara soft delete dan membersihkan issue terkait dari tabel `import_issues`. Wajib menyertakan alasan penghapusan.

Request:

```json
{
  "file_name": "customer_20260808.xlsx",
  "reason": "File duplikat atau salah periode"
}
```

Response 200:

```json
{
  "success": true,
  "data": {
    "file_name": "customer_20260808.xlsx",
    "deleted_bills": 105
  }
}
```

### `POST /api/admin/bills/status`

Mengubah status satu tagihan melalui pilihan status admin dan menulis audit log.

Request:

```json
{
  "bill_id": "uuid",
  "status": "partial",
  "paid_amount": 1000000,
  "payment_date": "2026-08-20",
  "reference_number": "BRI-REF-001",
  "notes": "Cicilan pertama"
}
```

`status` menerima `unpaid` (belum lunas), `partial` (bayar sebagian/cicilan), atau `paid` (lunas). Client wajib mengirim `paid_amount` ketika memilih `partial`; backend menolak request tanpa nominal dengan `400 VALIDATION_ERROR` dan tidak pernah mengisi nilai perkiraan. `payment_date` opsional, tetapi bila diisi harus tanggal kalender `YYYY-MM-DD`; jika kosong sistem memakai tanggal WIB (UTC+07:00). `reference_number` maksimal 100 karakter dan `notes` maksimal 1000 karakter.

### `POST /api/admin/bills/due-date`

Mengubah batas aktif satu atau beberapa tagihan dan menulis audit log per tagihan yang diperbarui. `due_date` kosong akan menghapus batas aktif.

Request satu tagihan:

```json
{
  "bill_id": "uuid",
  "due_date": "2026-08-25"
}
```

Request massal:

## Dashboard & Statistik Admin

### `GET /api/admin/dashboard/stats`

Mengambil metrik ringkasan untuk dashboard utama admin.

Response 200:

```json
{
  "success": true,
  "data": {
    "total_students": 408,
    "active_students": 395,
    "total_bills": 409,
    "paid_bills": 12,
    "partial_bills": 0,
    "unpaid_bills": 397,
    "total_billed_amount": 756650000,
    "total_paid_amount": 22200000,
    "total_outstanding_amount": 734450000,
    "payment_rate_percentage": 2.93
  }
}
```

## Master Data Akademik (SIAKAD Readiness)

### `GET /api/admin/study-programs`

Mengambil daftar master program studi.

Response 200:

```json
{
  "success": true,
  "data": {
    "study_programs": [
      {
        "id": "uuid-prodi",
        "code": "HKM",
        "name": "S1 Ilmu Hukum",
        "degree": "S1",
        "faculty": "FHISIP",
        "is_active": 1,
        "student_count": 85
      }
    ]
  }
}
```

### `POST /api/admin/study-programs`

Request:

```json
{
  "code": "MANJ",
  "name": "S1 Manajemen",
  "degree": "S1",
  "faculty": "FEB",
  "is_active": 1
}
```

`PATCH /api/admin/study-programs/{program_id}` memperbarui field master. `DELETE /api/admin/study-programs/{program_id}` melakukan hard delete; default seeded program dapat muncul kembali pada `init_db()` berikutnya dan sedang dicatat sebagai AUD-2026-009. Untuk operasi normal lebih aman memakai `is_active: 0` sampai defect tersebut diperbaiki.

### `GET /api/admin/academic-periods`

Mengambil daftar master periode akademik (semester).

Response 200:

```json
{
  "success": true,
  "data": {
    "academic_periods": [
      {
        "id": "uuid-period",
        "code": "20251",
        "name": "2025/2026 Ganjil",
        "semester_type": "ganjil",
        "is_active": 1,
        "default_due_date": "2026-08-25"
      }
    ]
  }
}
```

`PATCH /api/admin/academic-periods/{period_id}` memperbarui periode dan dapat menetapkan satu periode aktif. Tidak ada route DELETE periode pada implementasi saat ini.

### `POST /api/admin/academic-periods`

Request:

```json
{
  "code": "20252",
  "name": "2025/2026 Genap",
  "semester_type": "genap",
  "is_active": 0,
  "default_due_date": "2027-02-28"
}
```

## CRUD Manual Admin & Student Profile 360

Semua endpoint CRUD manual memakai session admin dan permission `manage_data`.

### `GET /api/admin/template/master-data`

Mengunduh file template resmi Excel Master Data 13 kolom (`Template_Master_Data_Mahasiswa.xlsx`) dengan header standar (`NIM`, `Nama`, `NO KTP`, `Tempat Lahir`, `Tanggal Lahir`, `Nama Ibu Kandung`, `e-Mail`, `No Kontak`, `Registrasi Awal`, `Program Studi`, `No Rek`, `Jumlah`, `Batas Pembayaran`) dan baris contoh petunjuk pengisian.

Response 200: File `.xlsx` binary (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).

### `GET /api/admin/students`

Mengambil daftar mahasiswa aktif beserta ringkasan jumlah tagihan dan total nominal. Mendukung filter `query`, `study_program_id`, `academic_status`, `entry_year`, `entry_period`, dan `sort_by`.

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `query` | string | Cari NIM, nama mahasiswa, No KTP, email, nomor kontak, atau prodi. |
| `study_program_id` | string | Filter berdasarkan ID/kode program studi. |
| `academic_status` | string | Filter status (`aktif`, `cuti`, `lulus`, `non_aktif`). |
| `entry_year` | number | Filter tahun angkatan (contoh `2023`, `2024`, `2025`, `2026`). |
| `entry_period` | string | Filter periode masuk (contoh `2023.1`, `2023.2`, `2024.1`, dst.). |
| `sort_by` | string | Pengurutan data: `entry_period_asc`, `entry_period_desc`, `nim_asc`, `name_asc`. |
| `limit` | number | Default 2000, maksimal 5000. Nilai non-angka ditolak `400 VALIDATION_ERROR`. |

### `GET /api/admin/students/{id}/detail`

Mengambil profil terpusat Mahasiswa 360 (biodata lengkap, data kependudukan, kontak, program studi, status akademik, periode masuk, dan riwayat seluruh tagihan lintas periode).

Response 200:

```json
{
  "success": true,
  "data": {
    "student": {
      "id": "uuid-student",
      "nim": "049530265",
      "full_name": "Muhamad Romli",
      "no_ktp": "3603100510860014",
      "tempat_lahir": "Tangerang",
      "tanggal_lahir": "14 September 2000",
      "nama_ibu_kandung": "Siti Aminah",
      "program_study": "FEB - Akuntansi",
      "study_program_id": "sp_akt",
      "academic_status": "aktif",
      "entry_year": 2023,
      "entry_semester": "ganjil",
      "entry_period": "2023.1",
      "entry_period_formatted": "2023.1 (Ganjil)",
      "email": "rhomly0496@gmail.com",
      "address": "Jl. Raya Tangerang",
      "phone_number": "082310867195",
      "initial_registration": "UNIVERSITAS TERBUKA 2023.1"
    },
    "bills": [
      {
        "id": "uuid-bill",
        "period": "UKT 2023.1 s/d 2025.2",
        "bill_type": "UKT BRIVA",
        "status": "unpaid",
        "amount": 1850000,
        "amount_formatted": "Rp 1.850.000",
        "briva": "178100023200085",
        "due_date": "22 Januari 2027 Pukul 11.59 WIB"
      }
    ],
    "summary": {
      "total_bills": 1,
      "total_amount": 1850000,
      "total_paid": 0,
      "total_outstanding": 1850000,
      "overall_status": "unpaid"
    }
  }
}
```

### `POST /api/admin/students`

Request:

```json
{
  "nim": "049530265",
  "full_name": "Muhamad Romli",
  "no_ktp": "3603100510860014",
  "tempat_lahir": "Tangerang",
  "tanggal_lahir": "14 September 2000",
  "nama_ibu_kandung": "Siti Aminah",
  "program_study": "FEB - Akuntansi",
  "academic_status": "aktif",
  "entry_year": 2023,
  "entry_semester": "ganjil",
  "entry_period": "2023.1",
  "phone_number": "082310867195",
  "email": "rhomly0496@gmail.com",
  "address": "Jl. Raya Tangerang"
}
```

### `PATCH /api/admin/students/{id}`

Request:

```json
{
  "full_name": "Muhamad Romli",
  "no_ktp": "3603100510860014",
  "tempat_lahir": "Tangerang",
  "tanggal_lahir": "14 September 2000",
  "nama_ibu_kandung": "Siti Aminah",
  "program_study": "FEB - Akuntansi",
  "academic_status": "cuti",
  "phone_number": "082310867195",
  "email": "rhomly0496@gmail.com"
}
```

### `DELETE /api/admin/students/{id}`

Soft delete mahasiswa dan seluruh tagihan aktif miliknya. Request wajib menyertakan alasan melalui query `reason` atau body JSON `{ "reason": "..." }`. Aksi dicatat di audit log dan data soft-deleted tidak tampil pada lookup publik maupun list admin aktif.

### `GET /api/admin/reports/financial-summary`

Mengambil rekapitulasi data keuangan (penerimaan vs tunggakan) teragregasi per program studi. Filter/agregasi per periode belum diimplementasikan.

Response 200:

```json
{
  "success": true,
  "data": {
    "by_study_program": [
      {
        "program_study": "S1 Ilmu Hukum",
        "total_students": 85,
        "total_bills": 90,
        "billed_amount": 166500000,
        "paid_amount": 18500000,
        "outstanding_amount": 148000000,
        "percentage_paid": 11.11
      }
    ],
    "totals": {
      "billed_amount": 756650000,
      "paid_amount": 22200000,
      "outstanding_amount": 734450000
    }
  }
}
```

### `GET /api/admin/bills`

Mengambil daftar tagihan terpaginasi dengan dukungan filter status dan filter sumber.

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `query` | string | Cari NIM, nama, BRIVA, periode, atau jenis tagihan. |
| `status` | string | Filter status: `paid`, `partial`, atau `unpaid` (kosong = semua status). |
| `source` | string | Filter sumber: `import` atau `manual` (kosong = semua sumber). |
| `limit` | number | Ukuran per halaman (default 100, maksimal 100). |
| `offset` | number | Offset pagination (default 0). |

Response 200:

```json
{
  "success": true,
  "data": {
    "bills": [
      {
        "id": "uuid-bill",
        "student_id": "uuid-student",
        "nim": "050117077",
        "full_name": "Syahla Taqiyyah",
        "student_nim": "050117077",
        "student_name": "Syahla Taqiyyah",
        "period": "20251",
        "bill_type": "UKT",
        "status": "partial",
        "amount": 1850000,
        "amount_formatted": "Rp 1.850.000",
        "paid_amount": 1000000,
        "paid_amount_formatted": "Rp 1.000.000",
        "remaining_amount": 850000,
        "remaining_amount_formatted": "Rp 850.000",
        "payment_method": "BRIVA",
        "briva": "178100023200040",
        "due_date": "2026-08-25",
        "due_date_formatted": "25 Agustus 2026",
        "source_file": "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx",
        "source_row_number": 2
      }
    ],
    "pagination": {
      "total": 409,
      "limit": 100,
      "offset": 0,
      "page": 1,
      "total_pages": 5
    }
  }
}
```

### `POST /api/admin/bills`

Request:

```json
{
  "student_id": "uuid-student",
  "briva": "178100023200040",
  "amount": 1850000,
  "paid_amount": 1000000,
  "period": "20251",
  "bill_type": "UKT",
  "status": "partial",
  "due_date": "2026-08-31",
  "instructions": "Bayar melalui BRIVA BRI."
}
```

### `PATCH /api/admin/bills/{id}`

Request:

```json
{
  "briva": "178100023200040",
  "amount": 1850000,
  "paid_amount": 1000000,
  "period": "20251",
  "bill_type": "UKT",
  "status": "partial",
  "due_date": "2026-08-31",
  "instructions": "Bayar melalui BRIVA BRI."
}
```

Catatan: Update tagihan tidak memerlukan pengiriman `nim` atau `full_name` karena identitas mahasiswa pemilik tagihan terikat permanen pada `bills.student_id`. Status `partial` mewajibkan `0 < paid_amount < amount`.

### `DELETE /api/admin/bills/{id}`

Soft delete satu tagihan. Request wajib menyertakan alasan melalui query `reason` atau body JSON `{ "reason": "..." }`. Aksi dicatat di audit log dan tagihan soft-deleted tidak tampil pada lookup publik maupun list admin aktif.

### `GET /api/admin/import-issues`

Mengambil baris import yang perlu diperbaiki admin. Endpoint ini dipakai dashboard `Data Perlu Diperbaiki`; baris valid dari workbook tetap dapat masuk, sedangkan issue disimpan untuk koreksi manual.

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `limit` | number | Default 500, maksimal 2000. Nilai non-angka ditolak `400 VALIDATION_ERROR`. |

## Payment Transaction History

Status working tree 2026-08-21: response/service di bawah sudah diimplementasikan, tetapi kedua route salah memanggil `require_admin("viewer")`. Karena `viewer` adalah nama role, bukan permission, semua role saat ini menerima `403`. Kontrak ini belum operasional sampai AUD-2026-001 diperbaiki dan test API/RBAC lulus.

### `GET /api/admin/bills/{bill_id}/transactions`

Mengambil riwayat transaksi pembayaran untuk satu tagihan, diurutkan dari terbaru.

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `limit` | number | Default 50, maksimal 200. |
| `offset` | number | Default 0. |

Response 200:

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid-tx",
        "bill_id": "uuid-bill",
        "student_id": "uuid-student",
        "transaction_type": "payment",
        "amount": 500000,
        "running_paid_total": 500000,
        "previous_status": "unpaid",
        "new_status": "partial",
        "payment_date": "2026-08-21",
        "payment_method": "BRIVA",
        "reference_number": null,
        "notes": null,
        "recorded_by": "uuid-admin",
        "recorded_by_name": "Admin SALUT",
        "source": "manual",
        "created_at": "2026-08-21 15:30:00"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0
    }
  }
}
```

### `GET /api/admin/students/{student_id}/transactions`

Mengambil riwayat transaksi pembayaran untuk semua tagihan milik satu mahasiswa, diurutkan dari terbaru.

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `limit` | number | Default 50, maksimal 200. |
| `offset` | number | Default 0. |

Response 200: Sama seperti endpoint per tagihan, tetapi mencakup semua tagihan milik mahasiswa. Student Profile 360 memuat 50 transaksi pertama dan menyediakan tombol pagination melalui endpoint ini.

Catatan ledger: `payment_transactions` adalah ledger perubahan state internal. Entry dibuat untuk perubahan status/nominal dan tidak dapat diubah atau dihapus melalui trigger SQLite. Input tanggal, referensi, dan catatan tersedia pada API/UI; riwayat lama tidak di-backfill otomatis agar tidak menciptakan transaksi historis yang tidak terverifikasi.

## API Rilis Lanjutan (Belum Diimplementasikan)

Selain endpoint berikut, CRUD `/api/admin/bill-types`, pengelolaan akun/role admin, dan pembacaan audit log masih belum diimplementasikan pada route aktif. Endpoint rancangan tidak boleh dipanggil oleh frontend rilis ini.

### `GET /api/admin/payment-methods`

Mengambil daftar metode pembayaran.

### `POST /api/admin/payment-methods`

Request:

```json
{
  "method_type": "bank_transfer",
  "provider_name": "Bank Contoh",
  "account_number": "1234567890",
  "account_name": "SALUT Awwabin",
  "instructions": "Transfer sesuai nominal tagihan.",
  "sort_order": 1,
  "is_active": true
}
```

### `POST /api/admin/imports/preview`

Endpoint rencana untuk versi dashboard admin lebih lengkap. Implementasi rilis ini memakai `/api/admin/import/preview` dan hanya menerima XLSX.

Form data:

| Field | Tipe | Keterangan |
|---|---|---|
| `file` | file | Workbook XLSX. |

Response:

```json
{
  "success": true,
  "data": {
    "import_token": "imp_0123456789abcdef0123456789abcdef",
    "total_rows": 100,
    "valid_rows": 98,
    "invalid_rows": 2,
    "errors": [
      {
        "row_number": 15,
        "field": "amount",
        "message": "Nominal tidak valid."
      }
    ],
    "preview": []
  },
  "request_id": "req_..."
}
```

### `POST /api/admin/imports/commit`

Endpoint rencana untuk versi dashboard admin lebih lengkap. Implementasi MVP saat ini memakai `/api/admin/import/commit`.

```json
{
  "import_token": "imp_0123456789abcdef0123456789abcdef",
  "mode": "upsert",
  "reason": "Import tagihan periode 2026.1"
}
```

### `GET /api/admin/audit-logs`

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `actor_id` | uuid | Filter admin. |
| `entity_type` | string | Filter entity. |
| `date_from` | date | Awal waktu. |
| `date_to` | date | Akhir waktu. |

## Validasi Input

| Field | Aturan |
|---|---|
| `nim` | Angka, panjang sesuai konfigurasi, trim whitespace. |
| `name` | Tidak dipakai sebagai input lookup publik rilis ini; nama berasal dari data import. |
| `amount` | Angka >= 0, maksimal sesuai batas konfigurasi. |
| `status` | Nilai yang didukung: `unpaid`, `partial`, atau `paid`. |
| `period` | Format konsisten, contoh `2026.1`. |
| `file` | XLSX, maksimal 5 MB compressed; maksimal 20 MB per entry ZIP, 30 MB total uncompressed, dan 5.000 baris data per worksheet. |
| `limit` | Query list admin harus angka; input non-angka menghasilkan `400 VALIDATION_ERROR`. |
| `import_token` | Format `imp_[0-9a-f]{32}`, terdaftar pada preview aktif, dan dimiliki admin pembuat preview atau `super_admin`. |
| `reason` | Wajib untuk soft delete mahasiswa dan tagihan. |

## Error Codes

| Code | HTTP | Keterangan |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input tidak valid. |
| `UNAUTHORIZED` | 401 | Belum login. |
| `FORBIDDEN` | 403 | Role tidak cukup. |
| `NOT_FOUND` | 404 | Data tidak ditemukan atau verifikasi salah. |
| `CONFLICT` | 409 | Data duplikat atau konflik state. |
| `IMPORT_CONFIRMATION_REQUIRED` | 409 | Perubahan nominal atau BRIVA belum dikonfirmasi admin. |
| `RATE_LIMITED` | 429 | Terlalu banyak request. |
| `INTERNAL_ERROR` | 500 | Error internal. |
