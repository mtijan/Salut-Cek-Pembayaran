# Requirements Traceability Matrix

## Tujuan

Traceability matrix menghubungkan requirement dengan desain, API, tabel database, test, dan status implementasi. Ini mengikuti praktik requirements engineering agar setiap fitur dapat diverifikasi.

## Matrix

| Req ID | Deskripsi | Design Ref | DB Ref | API Ref | Test Ref | Status |
|---|---|---|---|---|---|---|
| FR-001 | Halaman publik tanpa login. | `docs/02-system-design.md` | N/A | `/` | TC-001 | Implemented |
| FR-002 | Input NIM. | `docs/02-system-design.md` | `students.nim` | `/api/lookup` | TC-002, TC-003 | Implemented |
| FR-003 | Lookup berdasarkan NIM. | `docs/06-security-privacy-design.md` | `students.nim` | `/api/lookup` | TC-004 | Implemented |
| FR-004 | Tampilkan tagihan ditemukan. | `docs/03-diagrams.md` | `bills` | `/api/lookup` | TC-005 | Implemented |
| FR-005 | Nama mahasiswa tampil penuh setelah NIM ditemukan. | `docs/06-security-privacy-design.md` | `students.full_name` | `/api/lookup` | TC-006, ST-005 | Implemented |
| FR-006 | Tampilkan instruksi pembayaran. | `docs/02-system-design.md` | `bills.briva`, `bills.instructions` | `/api/lookup` | TC-007 | Implemented |
| FR-007 | Pesan aman untuk data tidak ditemukan. | `docs/06-security-privacy-design.md` | `lookup_logs` | `/api/lookup` | TC-008 | Implemented |
| FR-008 | Admin login. | `docs/02-system-design.md` | `admin_users`, `admin_sessions` | `/api/admin/login`, `/api/admin/me`, `/api/admin/logout` | TC-009, TC-010 | Implemented |
| FR-009 | Import workbook XLSX. | `docs/07-admin-operations.md` | `bills`, `students`, `import_issues`, `audit_logs` | `/api/admin/import/preview`, `/api/admin/import/commit` | TC-014, TC-019 | Implemented |
| FR-010 | Tolak import dengan baris kritis. | `docs/07-admin-operations.md` | `import_issues` | `/api/admin/import/commit` | TC-012, TC-022, TC-023 | Implemented |
| FR-016 | Konfirmasi perubahan nominal/BRIVA. | `docs/07-admin-operations.md` | `bills`, `audit_logs` | `/api/admin/import/preview`, `/api/admin/import/commit` | TC-020, TC-021 | Implemented |
| FR-011 | Lookup logging. | `docs/06-security-privacy-design.md` | `lookup_logs` | `/api/lookup` | ST-002 | Implemented |
| FR-012 | Role import admin. | `docs/06-security-privacy-design.md` | `admin_users` | Import Admin API | SEC-004 | Implemented |
| FR-013 | Rate limit endpoint. | `docs/06-security-privacy-design.md` | `lookup_logs` | Lookup dan Import API | ST-002, ST-003 | Implemented |
| FR-014 | CRUD manual dan export laporan. | `docs/07-admin-operations.md` | Future schema | Future Admin API | TBD | Deferred |
| SEC-001 | Secret tidak masuk repo. | `docs/06-security-privacy-design.md` | N/A | N/A | ST-006 | Implemented secara konfigurasi; verifikasi release wajib |
| SEC-002 | Lookup memakai NIM. | `docs/06-security-privacy-design.md` | `students` | `/api/lookup` | TC-004 | Implemented |
| SEC-003 | Response publik menampilkan nama penuh untuk NIM valid. | `docs/06-security-privacy-design.md` | `students` | `/api/lookup` | ST-005 | Implemented |
| SEC-004 | Admin API role check. | `docs/06-security-privacy-design.md` | `admin_users` | Import Admin API | TC-016 | Implemented |
| SEC-005 | Audit log perubahan penting. | `docs/06-security-privacy-design.md` | `audit_logs` | Admin API | TC-011, TC-012 | Implemented untuk login dan import |
| SEC-006 | Error aman. | `docs/06-security-privacy-design.md` | N/A | All API | TC-017 | Implemented untuk error API |
| SEC-007 | Import file tervalidasi. | `docs/07-admin-operations.md` | `import_issues` | `/api/admin/import/*` | TC-015 | Implemented |
| NFR-001 | Lookup P95 kurang dari 3 detik. | `docs/02-system-design.md` | Index `students`, `bills` | `/api/lookup` | TC-018 | Planned |

## Status Definition

| Status | Makna |
|---|---|
| Planned | Sudah direncanakan, belum diimplementasikan. |
| In Progress | Sedang dikerjakan. |
| Implemented | Kode selesai, test belum lengkap. |
| Verified | Kode dan test lulus. |
| Deferred | Ditunda secara sadar. |
| Removed | Tidak lagi menjadi bagian scope. |
