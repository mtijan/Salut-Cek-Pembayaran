# Admin dan Operasional

## Tujuan

Dokumen ini menjelaskan workflow admin, SOP operasional, dan tata cara menjaga data tagihan tetap akurat.

## Role Operasional

| Role | Tanggung Jawab |
|---|---|
| Viewer | Melihat data untuk kebutuhan layanan. |
| Admin | Mengelola mahasiswa, tagihan, metode pembayaran, dan import. |
| Super Admin | Mengelola admin, konfigurasi, dan akses sensitif. |
| Developer/Ops | Menangani deployment, backup, incident, dan migrasi. |

## SOP Import Tagihan

1. Admin menyiapkan workbook XLSX dengan sheet `Data Sinkron` dan `Data Belum Lengkap` dari sumber resmi.
2. Admin login ke dashboard.
3. Admin membuka menu Import Tagihan.
4. Admin upload file.
5. Sistem menampilkan preview: tagihan baru, tidak berubah, akan diperbarui, perubahan nominal/BRIVA, dan error.
6. Admin memperbaiki file bila preview menunjukkan baris kritis pada `Data Sinkron`.
7. Jika nominal atau BRIVA berubah, admin mencocokkan daftar perubahan dengan sumber resmi lalu mencentang persetujuan pembaruan.
8. Admin menekan commit setelah `critical_rows` bernilai 0 dan persetujuan tersedia bila diperlukan.
9. Sistem membuat tagihan baru atau memperbarui tagihan belum lunas yang telah dikonfirmasi, mencatat `import_issues`, serta menulis audit log.
10. Upload ulang file yang sama tidak mengubah nominal, status, atau waktu pembaruan tagihan.
11. Admin memeriksa ringkasan hasil import.

## Template Kolom Import

| Kolom | Wajib | Contoh | Catatan |
|---|---|---|---|
| `nim` | Ya | `123456789` | Unique key mahasiswa. |
| `full_name` | Ya | `Muhammad Adam` | Digunakan untuk identifikasi admin dan masking publik. |
| `briva` | Ya | `178100023200040` | Nomor VA pembayaran. |
| `amount` | Ya | `1850000` | Nominal tagihan. |

## Validasi Import

| Validasi | Tipe |
|---|---|
| NIM kosong | Error kritis |
| Nama kosong | Error kritis |
| Nominal bukan angka | Error kritis |
| BRIVA kosong | Error kritis |
| Duplikasi BRIVA atau NIM dalam file | Error kritis; commit ditolak. |
| File sama di-upload ulang | Ditampilkan sebagai `Tidak Berubah`; tidak ada pembaruan database. |
| Nominal pada BRIVA yang sama berubah | Ditampilkan dalam daftar perubahan; commit memerlukan persetujuan eksplisit admin. |
| BRIVA berubah pada NIM dan periode yang sama | Ditampilkan sebagai penggantian BRIVA; commit memerlukan persetujuan eksplisit admin. |
| Tagihan berstatus `paid` akan diubah | Error kritis; lakukan koreksi melalui prosedur manual berotorisasi. |
| Lebih dari satu tagihan tersimpan untuk NIM/periode yang sama | Error kritis; lakukan koreksi manual sebelum import ulang. |

## SOP Koreksi Tagihan Manual (Rilis Lanjutan)

1. Admin cari mahasiswa atau tagihan.
2. Admin buka detail tagihan.
3. Admin mengubah field yang diperlukan.
4. Admin wajib mengisi alasan perubahan.
5. Sistem menyimpan perubahan dan audit log.
6. Admin memeriksa status akhir.

## SOP Kelola Metode Pembayaran

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

## Runbook Error Umum

| Masalah | Langkah Awal |
|---|---|
| Web tidak dapat diakses | Cek status deployment VPS dan DNS. |
| Lookup selalu gagal | Cek `DATABASE_URL`, permission file SQLite, dan data `students`/`bills`. |
| Admin tidak bisa login | Cek user, password hash, session secret, dan role di `admin_users`. |
| Import lambat | Cek ukuran file, memory VPS, dan batch processing. |
| Data salah tampil | Cek batch import terakhir dan audit log entity terkait. |
