# Codebase Audit dan Mitigation Plan

Tanggal audit: 2026-08-08
Scope: seluruh codebase `Backend`, `Frontend`, `docs`, `deploy`, konfigurasi Git ignore, dan dependency dasar.

## Ringkasan Eksekutif

Audit awal menemukan bahwa fungsi utama aplikasi sudah berjalan dan test inti lulus, tetapi ada beberapa risiko produksi yang perlu diprioritaskan sebelum rilis berikutnya. Dokumen ini juga mencatat status mitigasi yang sudah diterapkan setelah audit.

Prioritas tertinggi pada audit awal adalah memperkuat rate limit ketika aplikasi berada di belakang reverse proxy, karena konfigurasi sebelum mitigasi dapat dipengaruhi header `X-Forwarded-For` dari client. Setelah itu, perbaikan difokuskan pada validasi input admin, keamanan token import, hardening parser XLSX, dan penyelarasan implementasi delete/audit dengan desain operasional.

## Bukti Validasi

| Pemeriksaan | Hasil |
|---|---|
| `python -m unittest Backend.test_core` | Lulus, 26 test setelah mitigasi. |
| `py_compile` semua file Python | Lulus. |
| Secret scan manual dengan `rg` | Tidak menemukan secret nyata; hanya placeholder dan dokumentasi. |
| Anonymous `GET /api/admin/students` | Ditolak `401 UNAUTHORIZED`. |
| `GET /api/admin/students?limit=abc` setelah login | Sebelum mitigasi menghasilkan 500; setelah mitigasi menjadi `400 VALIDATION_ERROR`. |
| Simulasi lookup rate limit IP sama | Request ke-11 menghasilkan `429`. |
| Simulasi lookup dengan spoofed `X-Forwarded-For` | Sebelum mitigasi tidak terkena `429`; setelah mitigasi request ke-11 tetap `429`. |

Catatan: `python -m pip check` gagal karena environment Python global berisi banyak paket di luar dependency proyek. Dependency proyek aktual hanya mengikuti `requirements.txt`.

## Temuan dan Mitigasi

### AUD-001 - Rate limit dapat dibypass melalui `X-Forwarded-For`

Severity: High

Status: Mitigated

File terkait:

- `Backend/app/main.py`
- `Backend/app/rate_limit.py`
- `deploy/nginx-salut-cek-pembayaran.conf`
- `Backend/.env.example`

Masalah awal:

Sebelum mitigasi, saat `TRUST_PROXY_HEADERS=true`, aplikasi mengambil IP pertama dari `X-Forwarded-For`. Template Nginx memakai `$proxy_add_x_forwarded_for`, sehingga header client dapat ikut diteruskan dan dipakai sebagai key rate limit. Akibatnya abuse lookup NIM dapat menghindari pembatasan dengan mengganti header.

Rencana mitigasi:

1. Ubah konfigurasi Nginx production agar memakai `proxy_set_header X-Forwarded-For $remote_addr;` atau header trusted khusus yang tidak menerima input client.
2. Di aplikasi, validasi bahwa trusted proxy hanya aktif pada deployment reverse proxy tepercaya.
3. Pertimbangkan memakai `X-Real-IP` dari Nginx sebagai sumber IP yang lebih sederhana.
4. Tambahkan test negatif: request berulang dengan spoofed `X-Forwarded-For` tetap terkena limit.
5. Tambahkan catatan operasional di deployment docs agar `TRUST_PROXY_HEADERS=true` tidak dipakai saat app diakses langsung.

Acceptance criteria:

- 11 request lookup dari client yang sama tetap menghasilkan `429` walaupun client mengirim header `X-Forwarded-For` berbeda.
- Nginx hanya meneruskan IP remote address yang tepercaya.
- Test rate limit proxy masuk ke `Backend/test_core.py`.

### AUD-002 - Query `limit` admin non-angka menghasilkan 500

Severity: Medium

Status: Mitigated

File terkait:

- `Backend/app/main.py`
- `Backend/app/responses.py`
- `docs/05-api-contract.md`

Masalah awal:

Endpoint admin melakukan `int(request.query_params.get("limit"))` tanpa handling `ValueError`. Input seperti `limit=abc` menghasilkan 500, bukan response validasi aman.

Rencana mitigasi:

1. Buat helper `parse_limit(request, default, maximum)` yang mengembalikan angka aman.
2. Jika input tidak numerik, balas `400 VALIDATION_ERROR`.
3. Samakan batas kode dengan dokumentasi: tentukan apakah maksimal 500, 2000, atau 5000.
4. Tambahkan test untuk `/api/admin/students`, `/api/admin/bills`, dan `/api/admin/import-issues` dengan `limit=abc`, `limit=0`, dan limit terlalu besar.

Acceptance criteria:

- `limit=abc` mengembalikan `400 VALIDATION_ERROR`.
- Limit valid tetap dipotong ke maksimum yang disepakati.
- Tidak ada endpoint list admin yang menghasilkan 500 karena query param.

### AUD-003 - Token commit import terlalu longgar

Severity: Medium

Status: Mitigated

File terkait:

- `Backend/app/main.py`
- `Frontend/admin.js`
- `Backend/app/services.py`

Masalah awal:

Commit import hanya mengecek `import_token.startswith("imp_")` lalu token dipakai dalam `glob`. Token dengan wildcard atau pola path tertentu dapat mencari file yang tidak semestinya. Endpoint ini admin-only, tetapi tetap berisiko pada kondisi multi-admin atau file preview paralel.

Rencana mitigasi:

1. Validasi token dengan regex ketat `^imp_[0-9a-f]{32}$`.
2. Tolak token selain pola tersebut dengan `400 VALIDATION_ERROR`.
3. Ganti pencarian glob dengan path deterministik atau registry import preview di database.
4. Simpan metadata preview: token, admin id, file name, path, expires_at.
5. Pastikan commit hanya boleh dilakukan oleh admin yang membuat preview, kecuali role super admin.

Acceptance criteria:

- Token dengan wildcard atau karakter selain hex ditolak.
- Commit tidak dapat memakai preview milik admin lain.
- Test commit token invalid dan cross-admin ditambahkan.

### AUD-004 - Parser XLSX belum membatasi ukuran hasil ekstraksi XML

Severity: Medium

Status: Mitigated

File terkait:

- `Backend/app/main.py`
- `Backend/excel_reader.py`
- `Backend/import_excel.py`

Masalah awal:

Upload dibatasi 5 MB compressed, tetapi isi XML workbook dibaca penuh dengan `zipfile.read()` dan `ElementTree.fromstring()`. File XLSX kecil dapat memiliki hasil ekstraksi besar sehingga berisiko menghabiskan memory/CPU saat preview.

Rencana mitigasi:

1. Sebelum membaca entry ZIP, cek total uncompressed size workbook XML, sharedStrings, rels, dan worksheet.
2. Tetapkan batas maksimal entry dan total ekstraksi, misalnya 20-30 MB untuk MVP.
3. Batasi jumlah row yang diproses per import sesuai kapasitas operasional.
4. Tangani `zipfile.BadZipFile`, XML parse error, dan workbook abnormal sebagai `IMPORT_PREVIEW_FAILED`.
5. Tambahkan test untuk XLSX rusak, ZIP dengan entry terlalu besar, dan workbook dengan row berlebih.

Acceptance criteria:

- File XLSX malformed/terlalu besar ditolak dengan pesan aman.
- Preview tidak membaca entry ZIP melebihi limit.
- Test DoS parser dasar tersedia.

### AUD-005 - Hard delete awal belum selaras dengan desain soft delete dan alasan koreksi

Severity: Medium

Status: Mitigated

File terkait:

- `Backend/app/services.py`
- `Backend/schema.sql`
- `Frontend/admin.js`
- `docs/02-system-design.md`
- `docs/11-risk-register.md`

Masalah awal:

Dokumentasi dan risk register menyebut soft delete serta alasan perubahan, tetapi implementasi sebelum mitigasi masih melakukan hard delete pada mahasiswa/tagihan. `delete_student` juga mengandalkan cascade delete untuk tagihan.

Rencana mitigasi:

1. Putuskan kontrak final: hard delete tetap diizinkan atau migrasi ke soft delete.
2. Jika soft delete dipilih, tambah kolom `deleted_at`, `deleted_by`, dan `delete_reason`.
3. Filter data aktif pada lookup publik dan dashboard admin.
4. Tambah modal/field alasan saat admin menghapus atau mengubah data sensitif.
5. Simpan before/after ringkas pada audit log untuk perubahan tagihan.

Acceptance criteria:

- Delete tidak menghilangkan histori tanpa jejak.
- Admin wajib mengisi alasan untuk delete/perubahan sensitif.
- Lookup publik tidak menampilkan data yang sudah soft-deleted.
- Dokumentasi database dan API sinkron dengan implementasi.

### AUD-006 - Health check publik membocorkan jumlah data

Severity: Low

Status: Mitigated

File terkait:

- `Backend/app/main.py`
- `docs/09-deployment-plan.md`
- `docs/RUNBOOK.md`

Masalah awal:

`/api/health` mengembalikan jumlah mahasiswa, tagihan, dan import issue. Informasi ini tidak kritis, tetapi sebaiknya tidak dibuka publik karena dapat membantu enumeration atau profiling sistem.

Rencana mitigasi:

1. Ubah public health menjadi hanya `status`, `version`, dan timestamp jika perlu.
2. Pindahkan jumlah data ke endpoint admin atau ops-only.
3. Sesuaikan smoke test deployment agar tidak bergantung pada count publik.

Acceptance criteria:

- `/api/health` publik tidak mengembalikan jumlah data bisnis.
- Endpoint metrik internal hanya dapat diakses admin/ops.

### AUD-007 - Pola auth dependency masih rapuh

Severity: Low

Status: Mitigated

File terkait:

- `Backend/app/main.py`

Masalah awal:

Saat ini endpoint admin sudah menolak anonymous request karena setiap handler memeriksa `if isinstance(admin, JSONResponse): return admin`. Namun pola ini mudah terlewat ketika endpoint baru dibuat.

Rencana mitigasi:

1. Ubah `require_admin()` agar melempar `HTTPException` atau custom exception.
2. Buat exception handler yang mengembalikan format JSON standar aplikasi.
3. Hapus guard manual dari setiap endpoint setelah dependency benar-benar menghentikan request.
4. Tambahkan test akses anonymous dan viewer role untuk semua endpoint admin.

Acceptance criteria:

- Endpoint baru otomatis aman melalui dependency.
- Tidak ada handler admin yang perlu guard manual `isinstance(admin, JSONResponse)`.
- Test negatif RBAC mencakup endpoint list, create, update, delete, import, status, dan due-date.

## Urutan Implementasi Rekomendasi

| Urutan | Item | Alasan |
|---:|---|---|
| 1 | AUD-001 | Risiko privasi tertinggi karena lookup publik NIM-only bergantung pada rate limit. |
| 2 | AUD-002 | Perbaikan kecil, mengurangi 500 dan menyelaraskan API contract. |
| 3 | AUD-003 | Mencegah commit import salah pada alur admin multi-user. |
| 4 | AUD-004 | Hardening upload agar aman terhadap file abnormal. |
| 5 | AUD-005 | Perubahan data model dan UI, perlu desain kecil sebelum implementasi. |
| 6 | AUD-006 | Perbaikan cepat untuk minimisasi informasi publik. |
| 7 | AUD-007 | Refactor keamanan agar endpoint admin berikutnya lebih aman secara default. |

## Backlog Test Tambahan

| Test | Tujuan |
|---|---|
| Spoofed proxy header tetap kena rate limit | Membuktikan mitigasi AUD-001. |
| `limit=abc` mengembalikan 400 | Membuktikan mitigasi AUD-002. |
| Token import wildcard ditolak | Membuktikan mitigasi AUD-003. |
| Commit preview milik admin lain ditolak | Membuktikan isolasi token import. |
| XLSX rusak ditolak aman | Membuktikan error parser tidak bocor detail internal. |
| XLSX oversize uncompressed ditolak | Membuktikan mitigasi DoS upload. |
| Soft delete tidak tampil di lookup publik | Membuktikan mitigasi AUD-005. |
| Semua endpoint admin anonymous ditolak | Membuktikan dependency auth tidak rapuh. |
| Viewer role tidak dapat mutate data | Membuktikan RBAC berjalan. |

## Catatan Deployment

- Jangan mengubah global Git `safe.directory` otomatis saat audit atau deployment.
- Gunakan command-local override bila perlu inspeksi Git pada VPS/workspace dengan ownership berbeda.
- Untuk perubahan static frontend saja, service Python tidak perlu restart.
- Untuk perubahan backend, lakukan backup SQLite sebelum release, restart systemd, lalu poll `/api/health` sampai listener siap.
