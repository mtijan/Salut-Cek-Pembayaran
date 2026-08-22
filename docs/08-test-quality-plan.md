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
| TC-015 | SEC-007 | Upload file bukan XLSX, melebihi 5 MB compressed, XML rusak, hasil ekstraksi terlalu besar, atau worksheet terlalu banyak baris. | Preview ditolak dengan pesan aman. |
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
| TC-026 | FR-018 | Admin memilih status tagihan. | Status berubah menjadi `unpaid`, `partial`, atau `paid` sesuai pilihan admin. |
| TC-027 | FR-014 | Admin menjalankan CRUD manual mahasiswa dan tagihan. | Create, list, update, dan delete mahasiswa/tagihan berhasil melalui API admin dan perubahan tercatat audit. |
| TC-028 | SEC-004 | Request anonymous mengakses endpoint admin. | Ditolak `401 UNAUTHORIZED`. |
| TC-029 | SEC-007 | Admin commit `import_token` invalid atau preview milik admin lain. | Token invalid ditolak `400`; preview milik admin lain tidak ditemukan untuk admin tersebut. |
| TC-030 | FR-014 | Admin delete tanpa alasan. | Ditolak `400 VALIDATION_ERROR`; soft delete hanya berjalan bila alasan tersedia. |
| TC-031 | FR-013 | Request lookup berulang dengan spoofed `X-Forwarded-For`. | Tetap kena rate limit karena app memakai IP reverse proxy tepercaya. |
| TC-032 | SEC-006 | Public health check. | Response hanya memuat `status`, `version`, dan `release_id`, tanpa jumlah data bisnis. |
| TC-033 | FR-019 | Admin mengubah batas aktif pembayaran. | `due_date` tersimpan, diformat dalam Bahasa Indonesia, tampil pada dashboard admin dan lookup publik, serta update tercatat audit. |
| TC-034 | FR-021 | Paginasi tagihan admin dan filter status/sumber. | API `/api/admin/bills` membatasi 100 data per halaman, mengembalikan metadata pagination (`total`, `limit`, `offset`, `page`, `total_pages`), serta memfilter data berdasar `status` dan `source`. |
| TC-035 | FR-020 | Admin menghapus file import. | API `DELETE /api/admin/imported-files` menghapus seluruh tagihan terkait secara soft delete dengan alasan wajib dan membersihkan `import_issues`. |
| TC-036 | FR-009 | Import workbook format terbaru. | Parser membaca kolom `NIM`, `Nama`, `No Rek`, `Jumlah` serta memetakan profil `Program Studi`, `Registrasi Awal`, `No Hp`, dan `Batas Pembayaran`. |
| TC-037 | FR-009 | Pembersihan marker Excel pada import. | Marker seperti backtick/petik pada teks Excel dibersihkan tanpa merusak isi data atau format tanggal. |
| TC-038 | FR-022 | CRUD Master Program Studi. | Create, list, update, dan non-aktifkan prodi tersimpan dengan integritas relasional. |
| TC-039 | FR-023 | CRUD Master Periode Akademik. | Periode akademik baru dibuat dan semester aktif dapat ditentukan. |
| TC-040 | FR-024 | CRUD Master Jenis Tagihan. | Komponen biaya baru terdaftar dan memiliki nominal acuan. |
| TC-041 | FR-025 | Endpoint Student Profile 360. | Mengembalikan profil biodata, status akademik, dan riwayat seluruh tagihan mahasiswa. |
| TC-042 | FR-026 | Endpoint Dashboard Stats. | Mengembalikan kalkulasi ringkasan metrik secara akurat. |
| TC-043 | FR-027 | Endpoint Financial Summary & Export. | Agregasi piutang & realisasi terhitung tepat per prodi dan per semester. |
| TC-044 | FR-028 | Unified RBAC (super_admin, admin, viewer). | User dengan role yang tidak memiliki wewenang ditolak `403 FORBIDDEN` sesuai kebijakan. |
| TC-045 | FR-029 | Navigasi dan integrasi Panel Admin React + Vite (SPA). | Seluruh modul SPA termuat dan interaksi dashboard, mahasiswa, tagihan, rekapitulasi, import, dan master data berjalan lancar. |
| TC-046 | FR-034 | Edit tagihan partial. | Identitas mahasiswa tetap, `paid_amount` tervalidasi, dan sisa tagihan benar. |
| TC-047 | FR-035 | Perubahan unpaid -> partial -> paid. | Delta dan running total tersimpan berurutan pada `payment_transactions`. |
| TC-048 | FR-036 | Admin/viewer membuka history bill/student. | `viewer`, `admin`, dan `super_admin` mendapat 200 melalui permission `view_reports`; anonymous 401; target tidak ada 404; query pagination tidak valid 400. Lulus lokal 2026-08-22. |

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
| ST-008 | Header proxy dipalsukan untuk bypass lookup rate limit. | Tetap terkena `429` setelah batas request. |
| ST-009 | Admin mencoba commit preview import milik admin lain. | Ditolak tanpa memproses file preview. |

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
| Unit/integration test | `.\.venv\Scripts\python.exe -m unittest Backend.test_core`; validasi terakhir 45 test lulus pada 2026-08-21 lokal. |
| E2E test | Smoke test HTTP melalui browser atau `curl`. |
| Syntax/build | Enumerasi file Python untuk `py_compile`; `npm run build` untuk SPA. |
| Dependency audit | `npm.cmd audit` lulus 0 vulnerability; audit Python terisolasi juga lulus `pip check` dan `pip-audit 2.10.1` dengan 0 known vulnerability pada 2026-08-21. |
| Security review | OWASP ASVS checklist. |

## Audit Dependency Python Terisolasi

Jangan gunakan `python -m pip check` dari instalasi Python global sebagai bukti proyek. Gunakan skrip dari root repository:

```powershell
.\scripts\audit_python_dependencies.ps1
```

Skrip menggunakan `.venv-audit`, memasang `requirements-audit.txt`, menjalankan `pip check`, kemudian mengaudit dependency runtime dari `requirements.txt`. Exit code non-zero pada instalasi, integrity check, atau CVE audit harus menggagalkan release. Hasil 0 vulnerability adalah snapshot dan wajib diperbarui ketika dependency/advisory berubah.

## Coverage Nyata Audit 2026-08-21

50 test backend mencakup import, lookup, CRUD, soft delete, rate limit, master data, partial payment, dashboard/report, history payment, RBAC route, dan validasi konfigurasi produksi. Coverage tersebut belum membuktikan:

- endpoint payment history beserta matrix role (bug 403 belum memiliki regression test);
- interaksi browser nyata tombol pagination React ketika total lebih dari 100; kontrak source terhadap `data.pagination.total` sudah dijaga regression test;
- browser E2E/visual, CSP, responsive layout, dan frontend legacy fallback;
- validasi NIM/status/tanggal invalid, recreate NIM soft-deleted, serta CSV injection;
- concurrency/migration lock, retention/pruning, restore backup, dan Docker proxy trust;
- performance P95 maupun production smoke test terbaru.

Tidak ada konfigurasi lint/type-check/frontend test/CI pada repository saat audit. Build yang lulus tidak boleh disamakan dengan UAT atau E2E.
