# Risk Register

## Skala

| Skala | Probability | Impact |
|---|---|---|
| 1 | Sangat rendah | Minor |
| 2 | Rendah | Terbatas |
| 3 | Sedang | Mengganggu |
| 4 | Tinggi | Serius |
| 5 | Sangat tinggi | Kritis |

Risk score = Probability x Impact.

## Risiko

| ID | Risiko | Probability | Impact | Score | Mitigasi | Owner | Status |
|---|---|---:|---:|---:|---|---|---|
| RSK-001 | NIM ditebak untuk melihat tagihan orang lain. | 4 | 5 | 20 | Rate limit, pesan error generik, lookup log ter-hash, monitoring lookup gagal, dan evaluasi CAPTCHA bila abuse meningkat. | Developer/Ops | Open |
| RSK-002 | Data import salah format. | 4 | 4 | 16 | Preview, validasi baris, template file. | Admin SALUT | Open |
| RSK-003 | Admin salah mengubah tagihan. | 3 | 4 | 12 | Audit log, alasan perubahan, soft delete. | Admin SALUT | Open |
| RSK-004 | Secret aplikasi dan akses database bocor. | 2 | 5 | 10 | Env server-only, `.gitignore`, secret scan, rotasi secret. | Developer/Ops | Open |
| RSK-005 | Kontrol akses server-side salah konfigurasi. | 3 | 5 | 15 | Test akses negatif, middleware RBAC, dan review policy. | Developer/Ops | Open |
| RSK-006 | Import besar menghabiskan resource VPS. | 3 | 3 | 9 | Batasi ukuran file, proses batch, validasi ukuran, pantau memory. | Developer/Ops | Open |
| RSK-007 | VPS menjadi single point of failure. | 3 | 4 | 12 | Backup otomatis, monitoring uptime, dokumentasi restore, dan opsi migrasi jika trafik naik. | Developer/Ops | Open |
| RSK-008 | Data tidak sinkron dengan sumber UT. | 3 | 4 | 12 | Tampilkan timestamp update, SOP import berkala. | Admin SALUT | Open |
| RSK-009 | Mahasiswa salah transfer karena instruksi usang. | 2 | 5 | 10 | Audit metode pembayaran, approval perubahan. | Admin SALUT | Open |
| RSK-010 | Backup SQLite tidak memadai saat data rusak. | 3 | 5 | 15 | Backup file SQLite harian, salinan off-server, dan uji restore berkala. | Developer/Ops | Open |
| RSK-011 | Abuse endpoint lookup. | 4 | 3 | 12 | Rate limit, CAPTCHA, monitoring lookup gagal. | Developer/Ops | Open |
| RSK-012 | Dokumentasi tidak sinkron dengan kode. | 3 | 3 | 9 | Definition of Done mewajibkan update docs. | Developer/Ops | Open |
| RSK-013 | Endpoint histori pembayaran atau pagination gagal sehingga data operasional tidak dapat diakses lengkap. | 4 | 4 | 16 | AUD-2026-001/002 diremediasi lokal dengan test API/contract; tambahkan E2E browser sebelum release. | Developer | Mitigated locally - E2E pending |
| RSK-014 | Nilai cicilan fiktif tercatat karena status partial tanpa nominal. | 3 | 5 | 15 | `paid_amount` wajib untuk mutasi baru; audit data lama dan lakukan koreksi terkontrol. | Developer/Admin SALUT | Mitigated locally - historical review release blocker |
| RSK-015 | Read request memicu migration/seed dan lock SQLite. | 3 | 4 | 12 | Migration versioned sekali saat startup/deploy, busy timeout/WAL evaluation, concurrency test. | Developer/Ops | Open |
| RSK-016 | Topologi Docker/reverse proxy salah konfigurasi dapat membuka akses atau mengganggu rate limit. | 3 | 5 | 15 | Compose meminta external secret, bind loopback, reject placeholder; lakukan security smoke test topologi VPS. | Developer/Ops | Mitigated locally - VPS verification pending |
| RSK-017 | Audit log hilang walau mutasi bisnis sudah commit. | 3 | 4 | 12 | Satukan transaction boundary atau transactional outbox. | Developer | Open |
| RSK-018 | Backup/log/session tumbuh tanpa retensi dan memenuhi disk. | 3 | 4 | 12 | Retention policy, prune timer, disk alert, restore drill. | Ops | Open |
| RSK-019 | CSV report menjalankan formula spreadsheet dari data master. | 2 | 4 | 8 | Serializer/escape CSV dan neutralisasi prefix formula. | Developer | Open |

## Risk Treatment

| Score | Treatment |
|---:|---|
| 1-5 | Accept atau monitor. |
| 6-10 | Mitigate dengan kontrol ringan. |
| 11-15 | Mitigate sebelum production. |
| 16-25 | Wajib ditangani sebelum MVP launch. |

## Risiko Wajib Ditutup Sebelum Launch

| ID | Alasan |
|---|---|
| RSK-001 | Risiko privasi tertinggi pada public lookup. |
| RSK-002 | Data tagihan salah dapat berdampak operasional langsung. |
| RSK-005 | Kontrol akses server-side salah konfigurasi dapat membuka data sensitif. |
| RSK-010 | Restore backup SQLite belum terbukti dapat menyebabkan kehilangan data saat incident. |
| RSK-011 | Abuse lookup dapat menyebabkan kebocoran melalui enumeration. |
| RSK-013 | Browser E2E belum membuktikan pagination lebih dari 100 tagihan. |
| RSK-014 | Data partial historis perlu review sebelum release. |
| RSK-016 | Topologi Docker/reverse proxy VPS belum diverifikasi. |
