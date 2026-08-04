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
