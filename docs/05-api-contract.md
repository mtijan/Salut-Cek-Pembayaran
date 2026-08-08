# API Contract

## Prinsip API

- Semua endpoint mengembalikan JSON.
- Endpoint publik hanya menerima NIM sebagai input dan mengembalikan informasi pembayaran yang dibutuhkan mahasiswa.
- Endpoint import admin wajib autentikasi dan role check.
- Error response tidak boleh membocorkan detail database atau secret.
- Setiap response error menyertakan `request_id`.

## Format Response Umum

### Success

```json
{
  "success": true,
  "data": {},
  "request_id": "req_..."
}
```

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
      "payment_period": "Semester Ganjil 2026"
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
        "instructions": "Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil."
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

Upload file Excel `.xlsx` dengan nama file apa pun, membaca sheet `Data Sinkron` dan `Data Belum Lengkap`, lalu mengembalikan ringkasan tanpa commit ke tabel tagihan. Struktur header wajib mengikuti workbook resmi: `Data Sinkron` memuat `NIM`, `Nama Mahasiswa`, `BRIVA`, dan `Jumlah`; `Data Belum Lengkap` juga memuat `Keterangan`.

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

Mengambil tagihan yang sudah tersimpan, dikelompokkan berdasarkan nama file import.

Response:

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "file_name": "Data_Sinkron_BRIVA_UKT_2023_1_sd_2025_2.xlsx",
        "total": 409,
        "paid": 12,
        "unpaid": 396,
        "bills": []
      }
    ]
  }
}
```

### `POST /api/admin/bills/status`

Mengubah status satu tagihan melalui checkbox admin.

Request:

```json
{
  "bill_id": "uuid",
  "status": "paid"
}
```

`status` hanya menerima `paid` atau `unpaid`.

### `POST /api/admin/bills/due-date`

Mengubah batas aktif satu atau beberapa tagihan.

Request satu tagihan:

```json
{
  "bill_id": "uuid",
  "due_date": "2026-08-25"
}
```

Request massal:

```json
{
  "bill_ids": ["uuid-1", "uuid-2"],
  "due_date": "2026-08-25"
}
```

## CRUD Manual Admin

Semua endpoint CRUD manual memakai session admin dan permission `manage_data`.

### `GET /api/admin/students`

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `query` | string | Cari NIM atau nama. |
| `limit` | number | Default 2000, maksimal 5000. Nilai non-angka ditolak `400 VALIDATION_ERROR`. |

### `POST /api/admin/students`

Request:

```json
{
  "nim": "123456789",
  "full_name": "Muhammad Adam"
}
```

### `PATCH /api/admin/students/{id}`

Request:

```json
{
  "nim": "123456789",
  "full_name": "Muhammad Adam"
}
```

### `DELETE /api/admin/students/{id}`

Soft delete mahasiswa dan seluruh tagihan aktif miliknya. Request wajib menyertakan alasan melalui query `reason` atau body JSON `{ "reason": "..." }`. Aksi dicatat di audit log dan data soft-deleted tidak tampil pada lookup publik maupun list admin aktif.

### `GET /api/admin/bills`

Query:

| Parameter | Tipe | Keterangan |
|---|---|---|
| `query` | string | Cari NIM, nama, BRIVA, periode, atau jenis tagihan. |
| `limit` | number | Default 2000, maksimal 5000. Nilai non-angka ditolak `400 VALIDATION_ERROR`. |

### `POST /api/admin/bills`

Request:

```json
{
  "nim": "123456789",
  "full_name": "Muhammad Adam",
  "briva": "178100023200040",
  "amount": 1250000,
  "period": "Semester Ganjil 2026",
  "bill_type": "UKT BRIVA",
  "status": "unpaid",
  "due_date": "2026-08-31"
}
```

### `PATCH /api/admin/bills/{id}`

Request:

```json
{
  "nim": "123456789",
  "full_name": "Muhammad Adam",
  "briva": "178100023200040",
  "amount": 1250000,
  "period": "Semester Ganjil 2026",
  "bill_type": "UKT BRIVA",
  "status": "paid",
  "due_date": "2026-08-31"
}
```

### `DELETE /api/admin/bills/{id}`

Soft delete satu tagihan. Request wajib menyertakan alasan melalui query `reason` atau body JSON `{ "reason": "..." }`. Aksi dicatat di audit log dan tagihan soft-deleted tidak tampil pada lookup publik maupun list admin aktif.

## API Rilis Lanjutan (Belum Diimplementasikan)

Endpoint berikut adalah rancangan fase berikutnya dan tidak boleh dipanggil oleh frontend rilis ini.

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
| `status` | Untuk endpoint status MVP hanya `paid` atau `unpaid`. |
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
