# Project Management Plan

## Tujuan

Dokumen ini mengatur cara proyek direncanakan, diprioritaskan, dieksekusi, dan dikendalikan.

## Milestone

| Milestone | Output | Kriteria Selesai |
|---|---|---|
| M0 Documentation Baseline | Dokumen desain awal. | Semua dokumen inti tersedia. |
| M1 Foundation | Backend Python, SQLite access layer, Frontend statis. | App berjalan lokal dan staging VPS. |
| M2 Public Lookup | Form lookup dan API publik. | Lookup valid/invalid lulus test. |
| M3 Admin Core | Login, dashboard, CRUD mahasiswa/tagihan/metode bayar. | Admin flow utama lulus. |
| M4 Import | Preview dan commit workbook XLSX. | Import valid/kritis lulus. |
| M5 Hardening | Security, performance, docs update. | Production readiness gate lulus. |
| M6 Launch | Production deployment. | Smoke test dan UAT selesai. |

## Work Breakdown Structure

| Kode | Work Package |
|---|---|
| WBS-001 | Dokumentasi dan requirement. |
| WBS-002 | Setup struktur `Backend/` dan `Frontend/`. |
| WBS-003 | Setup SQLite schema dan migration. |
| WBS-004 | Public lookup UI. |
| WBS-005 | Public lookup API. |
| WBS-006 | Admin auth dan RBAC. |
| WBS-007 | Admin CRUD mahasiswa. |
| WBS-008 | Admin CRUD tagihan. |
| WBS-009 | Admin metode pembayaran. |
| WBS-010 | Import workbook XLSX. |
| WBS-011 | Audit log dan lookup log. |
| WBS-012 | Testing dan hardening. |
| WBS-013 | Deployment dan release. |
| WBS-014 | Setup VPS, reverse proxy, process manager, backup, dan hardening dasar. |

## Prioritas

| Prioritas | Definisi |
|---|---|
| Must | Wajib untuk MVP. |
| Should | Penting tetapi bisa menyusul bila waktu ketat. |
| Could | Nice to have. |
| Won't now | Tidak dikerjakan pada MVP. |

## RACI

| Aktivitas | Pengelola SALUT | Admin SALUT | Developer/Ops |
|---|---|---|---|
| Menyetujui scope | A | C | R |
| Menyiapkan data contoh | C | R | C |
| Mendesain database | C | C | R/A |
| Implementasi aplikasi | I | C | R/A |
| UAT | A | R | C |
| Production release | A | C | R |
| Operasi harian | C | R | C |
| Incident response | A | R | R |

Keterangan: R = Responsible, A = Accountable, C = Consulted, I = Informed.

## Change Control

| Jenis Perubahan | Proses |
|---|---|
| Requirement baru | Tambahkan ID requirement, nilai prioritas, update traceability. |
| Perubahan database | Wajib migration, review, dan rollback note. |
| Perubahan API | Update API contract dan test. |
| Perubahan security | Update security design dan risk register. |
| Perubahan UI kecil | Update docs bila mengubah flow utama. |

## Communication Plan

| Topik | Frekuensi | Media |
|---|---|---|
| Progress pengembangan | Per milestone | Chat/project notes. |
| Risiko dan blocker | Saat muncul | Chat/project notes. |
| UAT feedback | Selama UAT | Checklist dan catatan issue. |
| Release | Setiap deployment production | Release notes. |

## Issue Template Ringkas

```markdown
## Deskripsi

## Dampak

## Langkah Reproduksi

## Expected Result

## Actual Result

## Screenshot/Log

## Prioritas
Must/Should/Could
```

## Decision Log Template

```markdown
## ADR-XXX: Judul Keputusan

Tanggal:
Status: Proposed/Accepted/Superseded

### Context

### Decision

### Consequences
```
