# Salut Cek Pembayaran

Aplikasi web untuk membantu mahasiswa Universitas Terbuka yang berafiliasi dengan SALUT Awwabin mengecek tagihan dan melihat instruksi pembayaran secara mandiri.

## Status

Tahap saat ini adalah perencanaan dan desain software. Implementasi aplikasi belum dimulai.

## Target MVP

- Mahasiswa dapat mencari tagihan menggunakan NIM dan faktor verifikasi tambahan.
- Sistem menampilkan tagihan, status pembayaran, jatuh tempo, dan cara pembayaran.
- Admin SALUT dapat mengelola data mahasiswa, tagihan, metode pembayaran, dan import data.
- Sistem mencatat audit penting seperti import data, login admin, dan pencarian tagihan.
- Deployment awal menggunakan Vercel dan Supabase.

## Dokumentasi

Dokumentasi awal disusun agar selaras dengan praktik ISO/IEC/IEEE dan pengembangan software modern:

- [Portal Dokumentasi HTML](docs/index.html)
- [Standar dan Metodologi](docs/00-standards-and-methodology.md)
- [Product Requirements](docs/01-product-requirements.md)
- [System Design](docs/02-system-design.md)
- [Diagram Sistem](docs/03-diagrams.md)
- [Database Design](docs/04-database-design.md)
- [API Contract](docs/05-api-contract.md)
- [Security dan Privacy Design](docs/06-security-privacy-design.md)
- [Admin dan Operasional](docs/07-admin-operations.md)
- [Test dan Quality Plan](docs/08-test-quality-plan.md)
- [Deployment Plan](docs/09-deployment-plan.md)
- [Project Management Plan](docs/10-project-management.md)
- [Risk Register](docs/11-risk-register.md)
- [Requirements Traceability Matrix](docs/12-traceability-matrix.md)
- [Change dan Release Plan](docs/13-change-release-plan.md)
- [Changelog](docs/CHANGELOG.md)
- [Security Policy](docs/SECURITY.md)
- [Runbook](docs/RUNBOOK.md)

Untuk membaca dokumentasi dalam tampilan yang lebih nyaman, buka file `docs/index.html` langsung dari browser.

## Rekomendasi Stack

- Frontend dan API: Next.js di Vercel.
- Database: Supabase Postgres.
- Auth admin: Supabase Auth.
- File import: Supabase Storage atau upload langsung melalui API route.
- Security: RLS, server-side API, rate limit, CAPTCHA, audit log.

## Catatan Keamanan

NIM bukan rahasia kuat. Untuk mengurangi risiko orang lain menebak NIM, MVP direkomendasikan memakai faktor verifikasi tambahan seperti tanggal lahir atau 4 digit nomor HP. Data yang tampil di halaman publik harus dibatasi dan dimasking.
