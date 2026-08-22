# Admin dan Operasional

## Tujuan

Dokumen ini menjelaskan workflow admin, SOP operasional, dan tata cara menjaga data tagihan tetap akurat.

## Role Operasional

| Role | Tanggung Jawab |
|---|---|
| Viewer / Helpdesk | Saat ini hanya dashboard, rekap keuangan, dan read master prodi/periode. Akses mahasiswa, tagihan, profil 360, dan riwayat pembayaran masih gagal 403 dan menjadi backlog RBAC. |
| Admin (SIAKAD & Keuangan) | Mengelola data mahasiswa (biodata, status akademik: aktif/cuti/lulus, angkatan), master data prodi & periode, tagihan (buat/edit/hapus), import Excel, konfirmasi status pembayaran, batas aktif, dan laporan rekapitulasi keuangan. |
| Super Admin | Memiliki seluruh hak akses operasional. Pengelolaan akun/role dan pembacaan audit trail belum memiliki API/UI pada checkout ini. |
| Developer / Ops | Menangani deployment VPS, perbaikan bug, migrasi database, dan pemantauan infrastruktur. |

## SOP Import Tagihan

1. Admin menyiapkan workbook XLSX dengan nama file apa pun dengan struktur:
   - **Format Legacy**: sheet `Data Sinkron` (`NIM`, `Nama Mahasiswa`, `BRIVA`, `Jumlah`) dan sheet `Data Belum Lengkap`.
   - **Format Terbaru**: kolom wajib `NIM`, `Nama`, `No Rek`, `Jumlah`, serta kolom profil opsional (`Program Studi`, `Registrasi Awal`, `No Hp`, `Batas Pembayaran`).
2. Admin login ke dashboard.
3. Admin membuka menu `Upload File`.
4. Admin memilih file `.xlsx` (maksimal 5 MB) dan menekan tombol `Periksa File`.
5. Sistem menampilkan preview: jumlah baris valid, tagihan baru, tidak berubah, akan diperbarui, perubahan nominal/BRIVA, baris kritis, dan issue.
6. Admin memperbaiki file bila preview menunjukkan baris kritis (seperti BRIVA sama untuk NIM berbeda atau upaya mengubah tagihan lunas).
7. Jika nominal atau BRIVA berubah, admin mencocokkan daftar perubahan dengan sumber resmi lalu mencentang persetujuan pembaruan.
8. Admin menekan tombol `Simpan Data` setelah `critical_rows` bernilai 0 dan persetujuan tersedia bila diperlukan.
9. Sistem membuat tagihan baru atau memperbarui tagihan belum lunas yang telah dikonfirmasi, mencatat `import_issues`, serta menulis audit log.
10. Upload ulang file yang sama tidak mengubah nominal, status, atau waktu pembaruan tagihan.
11. Admin membuka `Data Mahasiswa per File` untuk memeriksa kartu setiap versi import, termasuk waktu import, jumlah mahasiswa, jumlah tagihan, total nominal, dan ringkasan status.
12. Admin memilih status `Belum lunas`, `Bayar sebagian`, atau `Lunas` pada rincian tagihan file terkait.
13. Admin dapat mengubah `Batas Aktif` satu tagihan atau menyimpan batas aktif massal untuk seluruh tagihan pada file import.
14. Admin membuka `Data Perlu Diperbaiki` untuk menindaklanjuti baris import yang tidak lengkap tanpa menghambat baris valid.

## Template Kolom Import

### 1. Format Legacy

| Kolom | Wajib | Contoh | Catatan |
|---|---|---|---|
| `NIM` | Ya | `050117077` | Unique key mahasiswa. |
| `Nama Mahasiswa` | Ya | `Syahla Taqiyyah` | Digunakan untuk nama mahasiswa dan rekening BRIVA. |
| `BRIVA` | Ya | `178100023200040` | Nomor BRIVA pembayaran. |
| `Jumlah` | Ya | `1850000` | Nominal tagihan. |

### 2. Format Terbaru

| Kolom | Wajib | Contoh | Catatan |
|---|---|---|---|
| `NIM` | Ya | `050117077` | Unique key mahasiswa. |
| `Nama` | Ya | `Syahla Taqiyyah` | Nama mahasiswa. |
| `No Rek` | Ya | `178100023200040` | Nomor rekening BRIVA. |
| `Jumlah` | Ya | `1850000` | Nominal tagihan. |
| `Program Studi` | Tidak | `S1 Ilmu Hukum` | Metadata prodi mahasiswa. |
| `Registrasi Awal` | Tidak | `UT Serang/2025-Ganjil` | Periode registrasi awal. |
| `No Hp` | Tidak | `081234567890` | Nomor HP internal (tidak tampil publik). |
| `Batas Pembayaran` | Tidak | `2026-08-25` | Batas aktif tagihan. |

## Validasi Import

| Validasi | Tipe |
|---|---|
| NIM kosong | Error kritis |
| Nama kosong | Error kritis |
| Nominal bukan angka | Error kritis |
| BRIVA / No Rek kosong | Error kritis |
| BRIVA yang sama dipakai untuk NIM berbeda | Error kritis; commit ditolak. |
| NIM muncul lebih dari satu kali | Warning; disimpan sebagai beberapa tagihan, walaupun BRIVA sama; lookup publik menampilkan nominal `Tagihan 1`, `Tagihan 2`, dan seterusnya lalu menjumlahkannya sebagai `Total Tagihan`. |
| File sama di-upload ulang | Ditampilkan sebagai `Tidak Berubah`; tidak ada pembaruan database. |
| Nominal pada BRIVA yang sama berubah | Ditampilkan dalam daftar perubahan; commit memerlukan persetujuan eksplisit admin. |
| BRIVA berubah pada NIM dan periode yang sama | Ditampilkan sebagai penggantian BRIVA; commit memerlukan persetujuan eksplisit admin. |
| Tagihan berstatus `paid` atau `partial` akan diubah | Error kritis; lakukan koreksi melalui prosedur manual berotorisasi. |
| Lebih dari satu tagihan tersimpan untuk NIM/periode yang sama | Diizinkan; admin mengelola status masing-masing tagihan dari tabel per file. |

## SOP Kelola Data Mahasiswa dan Tagihan

1. Admin login ke dashboard.
2. Admin membuka menu `Data Mahasiswa` atau `Tagihan Mahasiswa`.
3. Admin dapat mencari data berdasarkan NIM, nama, BRIVA, atau periode melalui kolom pencarian.
4. Admin dapat memfilter data berdasarkan status (`Belum lunas`, `Bayar sebagian`, `Lunas`) dan sumber (`File import`, `Manual admin`).
5. Tabel menampilkan data per halaman dengan navigasi paginasi.
6. Untuk menambah tagihan baru, admin menekan tombol `Buat Tagihan`, memilih mahasiswa dari daftar, menentukan periode & jenis tagihan, mengisi nominal & BRIVA, lalu menyimpannya.
7. Untuk mengubah tagihan:
   - Admin menekan tombol `Edit Tagihan` pada baris terkait.
   - Modal edit menampilkan identitas mahasiswa (NIM, Nama, Prodi) secara statis (read-only) untuk mencegah kesalahan pemindahan tagihan antar mahasiswa.
   - Admin dapat memilih **Jenis Tagihan** melalui dropdown (`UKT`, `WISUDA`, `Custom`). Jika `Custom` dipilih, admin memasukkan nama jenis tagihan.
   - Admin dapat memilih **Periode Tagihan** melalui dropdown Master Periode atau memilih `Custom` (periode baru otomatis didaftarkan ke master global).
   - Jika status diubah menjadi **Bayar sebagian** (`partial`), admin memasukkan nominal yang telah dibayarkan (`paid_amount`). Sistem secara otomatis menghitung dan menampilkan sisa tagihan (`remaining_amount = amount - paid_amount`).
   - Admin menekan tombol `Simpan Tagihan`.
8. Untuk menghapus data, admin menekan tombol `Hapus` pada baris tagihan atau mahasiswa; sistem meminta alasan penghapusan melalui modal konfirmasi dan melakukan soft delete.
9. Setiap create, update, dan delete dicatat ke `audit_logs`.
10. Tombol riwayat pembayaran pada working tree belum operasional karena bug permission endpoint AUD-2026-001; jangan gunakan sebagai bukti transaksi sebelum diperbaiki.

## Keterbatasan Operasional Saat Ini

- Paginasi API tagihan bekerja, tetapi SPA React membaca total dari field yang salah sehingga halaman setelah 100 belum dapat dinavigasi.
- Fallback admin legacy dapat membuat nominal partial 50% ketika admin hanya memilih status; gunakan modal React dengan nominal eksplisit dan perbaiki backend sebelum rilis.
- Jenis tagihan pada form adalah pilihan terstruktur/string, bukan CRUD master `bill_types`.
- Rekap CSV hanya teragregasi per program studi, belum per periode, dan perlu hardening formula injection.
- Default program studi sebaiknya dinonaktifkan, bukan dihapus, sampai seed/migration dipisahkan dari read path.

## SOP Hapus File Import

1. Admin membuka menu `Data Mahasiswa per File`.
2. Admin memilih kartu file yang akan dihapus lalu menekan tombol `Hapus File`.
3. Admin memasukkan alasan penghapusan pada modal konfirmasi.
4. Sistem melakukan soft delete pada seluruh tagihan yang terkait dengan nama file tersebut, membersihkan data di `import_issues`, dan mencatat aksi ke `audit_logs`.
5. Kartu file import akan otomatis hilang dari tampilan grup aktif.

## SOP Kelola Metode Pembayaran

CRUD metode pembayaran belum tersedia pada rilis ini. Instruksi pembayaran yang tampil ke mahasiswa berasal dari data tagihan dan default aplikasi.

| Langkah | Detail |
|---|---|
| Tambah | Masukkan jenis, provider, nomor tujuan, nama penerima, instruksi. |
| Ubah | Perbarui instruksi atau nomor tujuan dengan alasan. |
| Nonaktifkan | Gunakan `is_active = false`; jangan hapus permanen. |
| Urutkan | Gunakan `sort_order` agar metode utama tampil paling atas. |

## SOP Data Tidak Ditemukan

| Kondisi | Tindakan Admin |
|---|---|
| Mahasiswa valid tetapi tidak ada tagihan | Cek sumber data dan import periode. |
| NIM salah ketik | Minta mahasiswa cek NIM. |
| nama salah | Verifikasi identitas melalui kanal resmi SALUT. |
| Data belum masuk | Tambahkan data manual atau tunggu import berikutnya. |

## Backup dan Restore

| Area | Rencana MVP |
|---|---|
| Database | Backup file SQLite otomatis harian, simpan salinan terenkripsi di lokasi terpisah bila memungkinkan. |
| File import | Simpan file mentah di Filesystem VPS bila diperlukan; batasi permission dan retensi. |
| Export manual | Belum tersedia pada rilis ini. |
| Restore | Restore database dilakukan oleh Developer/Ops dengan approval pengelola. |

## Monitoring Operasional

| Sinyal | Tindakan |
|---|---|
| Banyak lookup gagal | Cek apakah data belum terimport atau ada enumeration. |
| Banyak rate limit | Evaluasi abuse atau limit terlalu ketat; restart service akan mereset limiter in-memory. |
| Import gagal | Cek format file dan error rows. |
| Error 500 meningkat | Cek log aplikasi VPS, journal systemd, dan request ID terkait. |
| Admin login gagal berulang | Investigasi kemungkinan brute force. |
| Banyak data pada `Data Perlu Diperbaiki` | Koreksi workbook sumber atau tambahkan data manual setelah verifikasi resmi. |

## Runbook Error Umum

| Masalah | Langkah Awal |
|---|---|
| Web tidak dapat diakses | Cek status deployment VPS dan DNS. |
| Lookup selalu gagal | Cek `DATABASE_URL`, permission file SQLite, dan data `students`/`bills`. |
| Admin tidak bisa login | Cek user, password hash, session secret, dan role di `admin_users`. |
| Import lambat | Cek ukuran file, memory VPS, dan batch processing. |
| Data salah tampil | Cek batch import terakhir dan audit log entity terkait. |
