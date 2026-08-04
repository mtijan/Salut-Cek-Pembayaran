# Standar dan Metodologi

## Tujuan Dokumen

Dokumen ini menetapkan standar rujukan, prinsip engineering, dan tata cara pengembangan untuk aplikasi Salut Cek Pembayaran. Dokumen ini bersifat ISO-aligned, bukan pernyataan bahwa proyek sudah tersertifikasi ISO.

## Rujukan Standar

| Area | Rujukan | Penerapan di Proyek |
|---|---|---|
| Software life cycle | ISO/IEC/IEEE 12207:2026 | Mengatur proses conception, development, operation, maintenance, support, dan retirement. |
| Requirements engineering | ISO/IEC/IEEE 29148:2018 | Menjadi acuan struktur requirement, acceptance criteria, traceability, dan validasi requirement. |
| Product quality | ISO/IEC 25010:2023 | Menjadi acuan non-functional requirement dan quality attribute. |
| Information security | ISO/IEC 27001:2022 | Menjadi acuan risk-based security control, access management, logging, dan protection of information assets. |
| Privacy risk | NIST Privacy Framework 1.0 | Menjadi acuan identifikasi dan pengelolaan risiko privasi data mahasiswa. |
| Web security | OWASP ASVS 5.0 | Menjadi acuan kontrol keamanan aplikasi web dan API. |

## Pendekatan Pengembangan

Metode pengembangan menggunakan iterative incremental delivery:

| Fase | Output Utama | Gate Kelulusan |
|---|---|---|
| Inception | Scope, stakeholder, risiko awal | MVP disetujui dan batasan data jelas. |
| Elaboration | Requirement, ERD, API contract, security design | Traceability requirement ke test tersedia. |
| Construction | Implementasi frontend, API, database, admin | Test utama lulus dan review security selesai. |
| Transition | Deployment, UAT, runbook, release notes | UAT diterima dan rollback plan tersedia. |
| Operation | Monitoring, backup, incident handling | Operasi berjalan dan audit log dicek berkala. |

## Prinsip Engineering

- Privacy by design: data mahasiswa ditampilkan seminimal mungkin.
- Secure by default: akses database melalui API server-side dan kontrol akses server-side.
- Auditability: perubahan data penting harus tercatat.
- Traceability: setiap fitur utama memiliki requirement, API, test, dan acceptance criteria.
- Operability: admin non-teknis harus dapat menjalankan import dan koreksi data.
- Maintainability: dokumentasi diperbarui setiap perubahan skema, API, atau flow.

## Definition of Ready

Sebuah pekerjaan siap diimplementasikan jika:

| Kriteria | Status yang Diharapkan |
|---|---|
| Requirement | Punya ID, deskripsi, prioritas, dan acceptance criteria. |
| Data impact | Tabel/kolom yang berubah sudah diketahui. |
| Security impact | Risiko akses dan privasi sudah dinilai. |
| Test impact | Test case minimal sudah didefinisikan. |
| UI impact | User flow dan state layar sudah jelas. |

## Definition of Done

Sebuah pekerjaan dianggap selesai jika:

| Kriteria | Status yang Diharapkan |
|---|---|
| Implementasi | Sesuai requirement dan tidak membawa perubahan tidak terkait. |
| Test | Unit, integration, dan regression relevan lulus. |
| Security | Tidak mengekspos secret, data sensitif, atau endpoint admin. |
| Dokumentasi | README, API, DB, dan runbook diperbarui bila terdampak. |
| Release | Changelog dan rollback note tersedia untuk perubahan produksi. |

## Artefak Wajib

| Artefak | File |
|---|---|
| Product requirements | `docs/01-product-requirements.md` |
| System design | `docs/02-system-design.md` |
| Diagram | `docs/03-diagrams.md` |
| Database design | `docs/04-database-design.md` |
| API contract | `docs/05-api-contract.md` |
| Security and privacy | `docs/06-security-privacy-design.md` |
| Admin operations | `docs/07-admin-operations.md` |
| Test and quality | `docs/08-test-quality-plan.md` |
| Deployment | `docs/09-deployment-plan.md` |
| Project management | `docs/10-project-management.md` |
| Risk register | `docs/11-risk-register.md` |
| Traceability matrix | `docs/12-traceability-matrix.md` |
| Change and release | `docs/13-change-release-plan.md` |

## Sumber Rujukan

- ISO/IEC/IEEE 12207:2026: https://www.iso.org/standard/90219.html
- ISO/IEC/IEEE 29148:2018: https://www.iso.org/standard/72089.html
- ISO/IEC 25010:2023: https://www.iso.org/standard/78176.html
- ISO/IEC 27001:2022: https://www.iso.org/standard/27001
- NIST Privacy Framework: https://www.nist.gov/privacy-framework
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
