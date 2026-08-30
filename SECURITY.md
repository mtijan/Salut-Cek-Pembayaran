# Security Policy

Repository ini bersifat publik. Dokumentasi operasional, konfigurasi deployment, data runtime, database, workbook pengguna, backup, log, environment file, dan credential tidak boleh dimasukkan ke Git.

## Melaporkan Kerentanan

Laporkan kerentanan melalui kanal privat kepada pemilik repository. Jangan membuat public issue yang memuat exploit siap pakai, credential, alamat internal, data mahasiswa, cookie, token, atau bukti dari production.

Sertakan hanya informasi minimum yang diperlukan:

- versi atau commit yang terdampak;
- area aplikasi yang terdampak;
- langkah reproduksi menggunakan data sintetis;
- dampak yang diperkirakan;
- saran mitigasi bila tersedia.

## Public Repository Boundary

Folder `docs/` dan `deploy/` merupakan artefak internal dan sengaja di-ignore. Distribusi operasional dilakukan sebagai bundle internal yang dipasangkan dengan target SHA aplikasi dan diverifikasi checksum-nya.

Sebelum commit atau pull request, jalankan:

```powershell
python scripts/security/check_public_repo_boundary.py
python -m unittest scripts.security.test_public_repo_boundary
```

Jika secret atau data pribadi pernah masuk Git, menghapus file pada commit baru tidak cukup. Lakukan containment, rotasi credential yang relevan, dan koordinasikan pembersihan history dengan seluruh pemilik clone/fork.
