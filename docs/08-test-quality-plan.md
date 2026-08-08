# Test dan Quality Plan

## Tujuan

Dokumen ini menetapkan strategi pengujian agar aplikasi memenuhi functional requirement, keamanan, privasi, dan quality attribute.

## Quality Model

Mengacu pada ISO/IEC 25010:2023, kualitas produk dipantau melalui kategori berikut:

| Kategori | Fokus Proyek |
|---|---|
| Functional suitability | Lookup, login admin, import XLSX, dan instruksi pembayaran benar. |
| Performance efficiency | Response lookup cepat dan import tidak timeout untuk ukuran wajar. |
| Compatibility | Berjalan di browser modern mobile dan desktop. |
| Interaction capability | UI jelas untuk mahasiswa dan admin. |
| Reliability | Error handling jelas dan tidak merusak data. |
| Security | Auth, role, rate limit, minimisasi response, dan secret handling. |
| Maintainability | Kode modular, test cukup, docs sinkron. |
| Flexibility | Mudah menambah metode pembayaran atau sumber data. |
| Safety | Mengurangi risiko salah informasi tagihan. |

## Test Level

| Level | Scope | Contoh |
|---|---|---|
| Unit test | Fungsi kecil | Validasi NIM, parsing nominal. |
| Integration test | API dan database | Lookup tagihan, login admin, import commit. |
| E2E test | Flow pengguna | Mahasiswa cek tagihan, admin import file. |
| Security test | Kontrol keamanan | Role check, rate limit, secret exposure, enumeration. |
| UAT | Validasi pengguna | Admin SALUT mencoba data nyata terbatas. |

## Test Case MVP

| ID | Requirement | Skenario | Expected Result |
|---|---|---|---|
| TC-001 | FR-001 | Buka halaman publik. | Halaman cek tagihan tampil. |
| TC-002 | FR-002 | Input NIM valid. | Form menerima input. |
| TC-003 | FR-002 | Input NIM berisi huruf. | Validasi menolak. |
| TC-004 | FR-003 | Submit tanpa NIM. | Request ditolak. |
| TC-005 | FR-004 | NIM cocok. | Tagihan tampil. |
| TC-006 | FR-005 | Hasil lookup valid. | Response dan UI publik memuat informasi mahasiswa dan tagihan pembayaran. |
| TC-007 | FR-006 | Ada metode pembayaran aktif. | Instruksi tampil. |
| TC-008 | FR-007 | NIM tidak ditemukan. | Pesan generik tampil. |
| TC-009 | FR-008 | Admin login valid. | Dashboard terbuka. |
| TC-010 | FR-008 | Admin login invalid. | Login gagal dan aman. |
| TC-011 | FR-009 | Upload workbook valid. | Preview 409 valid, 0 kritis, 11 warning, dan 2 baris multiple bill. |
| TC-012 | FR-010 | Upload workbook dengan baris wajib kosong. | Commit ditolak tanpa upsert. |
| TC-013 | FR-012 | Role `viewer` mencoba import. | Ditolak 403. |
| TC-014 | FR-009 | Commit preview workbook valid. | Data tersimpan dan audit tercatat. |
| TC-015 | SEC-007 | Upload file bukan XLSX atau melebihi 5 MB. | Preview ditolak. |
| TC-016 | SEC-004 | Viewer mencoba import. | Ditolak 403. |
| TC-017 | SEC-006 | Database error simulasi. | Response tidak bocor detail internal. |
| TC-018 | NFR-001 | Lookup 100 request sampel. | P95 kurang dari target. |
| TC-019 | FR-009 | Upload ulang workbook yang sudah tersimpan. | Preview menampilkan seluruh baris sebagai tidak berubah dan commit tidak memodifikasi tagihan. |
| TC-020 | FR-016 | Nominal berubah pada BRIVA yang sama. | Commit ditolak tanpa konfirmasi dan berhasil hanya setelah persetujuan admin. |
| TC-021 | FR-016 | BRIVA berubah untuk NIM/periode yang sama. | Preview menampilkan penggantian BRIVA; commit terkonfirmasi mempertahankan satu tagihan. |
| TC-022 | FR-010 | BRIVA yang sama dipakai untuk NIM berbeda dalam satu workbook. | Preview kritis dan commit ditolak. |
| TC-023 | FR-010 | Nominal tagihan `paid` berubah. | Preview kritis dan commit ditolak. |
| TC-024 | FR-004 | Satu NIM memiliki dua tagihan, termasuk BRIVA yang sama. | Lookup menampilkan nominal `Tagihan 1` dan `Tagihan 2`, lalu menjumlahkannya sebagai `Total Tagihan`. |
| TC-025 | FR-017 | Admin membuka dashboard setelah import. | Tabel tagihan tampil dikelompokkan berdasarkan nama file. |
| TC-026 | FR-018 | Admin mencentang status lunas. | Status tagihan berubah menjadi `paid`; melepas centang mengubah ke `unpaid`. |
| TC-027 | FR-014 | Admin menjalankan CRUD manual mahasiswa dan tagihan. | Create, list, update, dan delete mahasiswa/tagihan berhasil melalui API admin dan perubahan tercatat audit. |

## Security Test

| ID | Skenario | Expected Result |
|---|---|---|
| ST-001 | Akses file SQLite atau endpoint data tanpa izin. | File database tidak berada di webroot dan endpoint ditolak oleh RBAC/API policy. |
| ST-002 | Brute force lookup banyak NIM. | Kena rate limit. |
| ST-003 | Login gagal berulang. | Percobaan berikutnya menerima 429. |
| ST-004 | Viewer mengakses endpoint import. | Ditolak 403. |
| ST-005 | Response lookup valid mengandung informasi pembayaran yang dibutuhkan dan tidak mengandung alamat/email/HP. | Test lulus setelah NIM ditemukan. |
| ST-006 | `.env` masuk Git. | Test/review gagal. |
| ST-007 | File SQLite memiliki permission terlalu longgar. | Review/deploy gate gagal sampai permission dibatasi. |

## UAT Checklist

| Check | Pemilik |
|---|---|
| Data contoh mahasiswa valid tampil benar. | Admin SALUT |
| Tagihan workbook tampil dengan status dan cara bayar benar. | Admin SALUT |
| Data tidak ditemukan memiliki pesan yang mudah dipahami. | Admin SALUT |
| Import file operasional berhasil. | Admin SALUT |
| Error import mudah diperbaiki. | Admin SALUT |

## Acceptance Criteria Release MVP

| Area | Kriteria |
|---|---|
| Functional | Semua Must requirement lulus. |
| Security | Kontrol SEC-001 sampai SEC-007 lulus. |
| Performance | Lookup normal memenuhi target. |
| Documentation | README dan docs sesuai implementasi. |
| Deployment | Production deployment sukses dan rollback plan tersedia. |

## Tools Rekomendasi

| Kebutuhan | Tool |
|---|---|
| Unit test | `python -m unittest Backend.test_core`. |
| E2E test | Smoke test HTTP melalui browser atau `curl`. |
| Lint | `python -m py_compile Backend/*.py Backend/app/*.py`. |
| Dependency audit | Review dependency Python di `requirements.txt`. |
| Security review | OWASP ASVS checklist. |
