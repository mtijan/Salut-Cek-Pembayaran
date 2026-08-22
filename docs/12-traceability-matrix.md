# Requirements Traceability Matrix

## Tujuan

Traceability matrix menghubungkan requirement dengan desain, API, tabel database, test, dan status implementasi. Ini mengikuti praktik requirements engineering agar setiap fitur dapat diverifikasi.

## Matrix

| Req ID | Deskripsi | Design Ref | DB Ref | API Ref | Test Ref | Status |
|---|---|---|---|---|---|---|
| FR-001 | Halaman publik tanpa login. | `docs/02-system-design.md` | N/A | `/` | TC-001 | Verified |
| FR-002 | Input NIM. | `docs/02-system-design.md` | `students.nim` | `/api/lookup` | TC-002, TC-003 | In Progress: server menormalisasi huruf, belum strict reject/test |
| FR-003 | Lookup berdasarkan NIM. | `docs/06-security-privacy-design.md` | `students.nim` | `/api/lookup` | TC-004 | Verified |
| FR-004 | Tampilkan tagihan ditemukan. | `docs/03-diagrams.md` | `bills` | `/api/lookup` | TC-005, TC-024 | Verified |
| FR-005 | Lookup publik menampilkan informasi mahasiswa dan pembayaran. | `docs/06-security-privacy-design.md` | `students.nim`, `students.full_name` | `/api/lookup` | TC-006, ST-005 | Verified |
| FR-006 | Tampilkan instruksi pembayaran. | `docs/02-system-design.md` | `bills.briva`, `bills.instructions` | `/api/lookup` | TC-007 | Verified |
| FR-007 | Pesan aman untuk data tidak ditemukan. | `docs/06-security-privacy-design.md` | `lookup_logs` | `/api/lookup` | TC-008 | Verified |
| FR-008 | Admin login. | `docs/02-system-design.md` | `admin_users`, `admin_sessions` | `/api/admin/login`, `/api/admin/me`, `/api/admin/logout` | TC-009, TC-010 | Verified |
| FR-009 | Import workbook XLSX (legacy dan format terbaru). | `docs/07-admin-operations.md` | `bills`, `students`, `import_issues`, `audit_logs` | `/api/admin/import/preview`, `/api/admin/import/commit` | TC-014, TC-019, TC-036, TC-037 | Verified |
| FR-010 | Tolak import dengan baris kritis. | `docs/07-admin-operations.md` | `import_issues` | `/api/admin/import/commit` | TC-012, TC-022, TC-023 | Verified |
| FR-016 | Konfirmasi perubahan nominal/BRIVA. | `docs/07-admin-operations.md` | `bills`, `audit_logs` | `/api/admin/import/preview`, `/api/admin/import/commit` | TC-020, TC-021 | Verified |
| FR-011 | Lookup logging. | `docs/06-security-privacy-design.md` | `lookup_logs` | `/api/lookup` | ST-002 | Verified |
| FR-012 | Role import admin. | `docs/06-security-privacy-design.md` | `admin_users` | Import Admin API | SEC-004 | Verified |
| FR-013 | Rate limit endpoint. | `docs/06-security-privacy-design.md` | `lookup_logs` | Lookup dan Import API | ST-002, ST-003, ST-008 | Verified |
| FR-014 | CRUD manual mahasiswa dan tagihan. | `docs/07-admin-operations.md` | `students`, `bills`, `audit_logs` | `/api/admin/students`, `/api/admin/bills` | TC-027, TC-030 | Verified |
| FR-017 | Tampilkan tagihan admin per file import. | `docs/07-admin-operations.md` | `bills.source_file` | `/api/admin/imported-bills` | TC-025 | Verified |
| FR-018 | Update status pembayaran. | `docs/07-admin-operations.md` | `bills.status`, `audit_logs` | `/api/admin/bills/status` | TC-026 | Verified |
| FR-019 | Update batas aktif pembayaran. | `docs/07-admin-operations.md` | `bills.due_date`, `audit_logs` | `/api/admin/bills/due-date` | TC-033 | Verified |
| FR-020 | Hapus kumpulan tagihan per file import. | `docs/07-admin-operations.md` | `bills`, `import_issues`, `audit_logs` | `/api/admin/imported-files` | TC-035 | Verified |
| FR-021 | Paginasi tagihan admin dan filter status/sumber. | `docs/07-admin-operations.md` | `bills` | `/api/admin/bills` | TC-034 | In Progress: backend verified, SPA membaca total field salah |
| FR-022 | Master Program Studi. | `docs/02-system-design.md` | `study_programs` | `/api/admin/study-programs` | TC-038 | Verified |
| FR-023 | Master Periode Akademik. | `docs/02-system-design.md` | `academic_periods` | `/api/admin/academic-periods` | TC-039 | Verified |
| FR-024 | Master Jenis Tagihan. | `docs/02-system-design.md` | `bill_types` | Belum ada | TC-040 | Planned: tabel/seed saja, API/UI belum ada |
| FR-025 | Student Profile 360 & Single View. | `docs/07-admin-operations.md` | `students`, `bills` | `/api/admin/students/{id}/detail` | TC-041 | Verified |
| FR-026 | Dashboard Statistik & Metrik. | `docs/02-system-design.md` | N/A | `/api/admin/dashboard/stats` | TC-042 | Verified |
| FR-027 | Rekapitulasi Keuangan & Ekspor. | `docs/07-admin-operations.md` | `bills`, `study_programs` | `/api/admin/reports/financial-summary` | TC-043 | In Progress: per prodi ada, dimensi periode belum ada |
| FR-028 | Unified RBAC (`super_admin`, `admin`, `viewer`). | `docs/06-security-privacy-design.md` | `admin_users` | All Admin API | TC-044 | In Progress: history memakai `view_reports`, tetapi viewer lintas modul dan user management belum sesuai |
| FR-029 | Panel Admin React + Vite (SPA). | `docs/02-system-design.md` | N/A | `/admin` | TC-045 | Implemented: build lulus, E2E/visual belum ada |
| FR-034 | Form Edit Tagihan Terstruktur & Kalkulasi Bayar Sebagian. | `docs/02-system-design.md`, `docs/07-admin-operations.md` | `bills.paid_amount`, `academic_periods` | `PATCH /api/admin/bills/{id}` | TC-046 | Verified |
| FR-035 | Pencatatan histori transaksi pembayaran kronologis. | `docs/02-system-design.md` ADR-010~013 | `payment_transactions` | `POST /api/admin/bills/status`, `PATCH /api/admin/bills/{id}` | TC-047 | In Progress: service test ada, contract ledger/atomic audit belum lengkap |
| FR-036 | Riwayat pembayaran per tagihan dan per mahasiswa. | `docs/02-system-design.md` | `payment_transactions` | `GET /api/admin/bills/{id}/transactions`, `GET /api/admin/students/{id}/transactions` | TC-048 | Verified locally: `view_reports` roles 200, anonymous 401, missing target 404, invalid pagination 400 |
| SEC-001 | Secret tidak masuk repo. | `docs/06-security-privacy-design.md` | N/A | N/A | ST-006 | In Progress: Compose tidak menyimpan secret dan validation menolak placeholder; environment VPS tetap perlu diverifikasi |
| SEC-002 | Lookup memakai NIM. | `docs/06-security-privacy-design.md` | `students` | `/api/lookup` | TC-004 | Verified |
| SEC-003 | Response publik hanya mengirim identitas dan data pembayaran yang diperlukan. | `docs/06-security-privacy-design.md` | `students` | `/api/lookup` | ST-005 | Verified |
| SEC-004 | Admin API role check. | `docs/06-security-privacy-design.md` | `admin_users` | Import dan CRUD Admin API | TC-016, TC-027, TC-028, TC-048 | In Progress: history diperbaiki, viewer matrix lintas modul masih terbuka |
| SEC-005 | Audit log perubahan penting. | `docs/06-security-privacy-design.md` | `audit_logs` | Admin API | TC-011, TC-012, TC-027, TC-033, TC-035 | In Progress: audit belum atomik dan belum dapat dibaca |
| SEC-006 | Error dan health check aman. | `docs/06-security-privacy-design.md` | N/A | All API, `/api/health` | TC-017, TC-032 | Verified |
| SEC-007 | Import file tervalidasi. | `docs/07-admin-operations.md` | `import_issues` | `/api/admin/import/*` | TC-015, TC-029 | Verified |
| NFR-001 | Lookup P95 kurang dari 3 detik. | `docs/02-system-design.md` | Index `students`, `bills` | `/api/lookup` | TC-018 | Planned: belum ada performance evidence |

## Status Definition

| Status | Makna |
|---|---|
| Planned | Sudah direncanakan, belum diimplementasikan. |
| In Progress | Sedang dikerjakan. |
| Implemented | Kode selesai, test belum lengkap. |
| Verified | Kode dan test lulus. |
| Deferred | Ditunda secara sadar. |
| Removed | Tidak lagi menjadi bagian scope. |
