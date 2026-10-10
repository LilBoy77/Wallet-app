# PROJECT_BRIEF — Ringkasan & Visi Produk Wallet App

## 1. Latar Belakang & Masalah
Pengelolaan keuangan pribadi seringkali menghadapi hambatan berupa pencatatan manual yang terfragmentasi, ketiadaan visibilitas real-time terhadap anggaran bulanan, serta minimnya sistem simulasi transaksi internal yang aman dan terstruktur. Pengguna membutuhkan sebuah platform terpadu yang tidak hanya mencatat arus kas (pemasukan dan pengeluaran) dengan kategori terperinci, melainkan juga menyediakan dompet saldo internal (*closed-loop wallet*) yang memungkinkan transfer instan dan aman antar-pengguna dalam ekosistem aplikasi.

## 2. Visi Produk
Membangun platform manajemen keuangan pribadi dan dompet saldo internal berbasis web full-stack yang modern, responsif, aman, dan mematuhi prinsip rekayasa perangkat lunak enterprise: integritas data finansial tinggi, arsitektur monorepo modular, kontrol akses berbasis peran (RBAC), serta dokumentasi API dan pengujian komprehensif.

## 3. Persona Pengguna & Peran (Role) `[DECIDED]`
Sistem mendefinisikan dua peran utama dengan batasan hak akses yang tegas:
1. **Regular User (`user`)**:
   - Memiliki dompet pribadi (*wallet*) default setelah pendaftaran akun.
   - Melakukan top-up simulasi saldo internal dompet pribadi.
   - Mencatat transaksi pemasukan (*income*) dan pengeluaran (*expense*) pribadi.
   - Mengelola kategori kustom dan target anggaran (*budgeting*).
   - Mengunggah bukti kuitansi/struk transaksi.
   - Melakukan transfer saldo internal ke sesama pengguna menggunakan nomor dompet atau username/email tujuan.
   - Melihat ringkasan analitik, arus kas, dan riwayat aktivitas diri sendiri.
2. **System Administrator (`admin`)**:
   - Memiliki seluruh kemampuan regular user untuk pengujian akun.
   - Melihat dashboard pemantauan metrik agregat sistem (total volume transaksi, pengguna aktif, perputaran saldo).
   - Mengelola status pengguna (aktif, nonaktif/suspend).
   - Melihat log aktivitas audit sistem (*audit logs*) untuk keperluan deteksi anomali.
   - Mengelola kategori sistem default (kategori global yang dapat digunakan seluruh pengguna).

## 4. Kasus Penggunaan Utama (Core Use Cases)
- **UC-01 Autentikasi & Registrasi**: Pendaftaran akun baru, verifikasi kredensial, penerbitan JWT access token & refresh token rotatif dalam HttpOnly cookie.
- **UC-02 Manajemen Saldo & Mutasi**: Menampilkan saldo terkini, mencatat riwayat mutasi masuk/keluar secara konsisten via entri buku besar (*ledger entries*).
- **UC-03 Catatan Arus Kas**: Menambah, mengubah, menghapus (soft delete), dan memfilter transaksi pemasukan serta pengeluaran dengan kategori dan tanggal.
- **UC-04 Transfer Saldo Internal**: Memvalidasi kecukupan saldo pengirim, memvalidasi eksistensi penerima, mengunci akun dalam transaksi database atomik untuk memindahkan saldo tanpa risiko *race condition* atau saldo negatif.
- **UC-05 Perencanaan Anggaran**: Menentukan batas belanja per kategori dalam periode tertentu, menghitung sisa pagu anggaran dan menampilkan persentase realisasi.
- **UC-06 Analisis & Pelaporan**: Menghasilkan grafik ringkasan keuangan bulanan, komparasi pendapatan vs belanja, dan proporsi kategori via diagram visual interaktif.
- **UC-07 Audit & Pemantauan Admin**: Admin menginspeksi log aktivitas dan daftar pengguna untuk tata kelola aplikasi.

## 5. Batasan Cakupan (Scope Definition)

### In-Scope (Versi Awal) `[DECIDED]`
- Sistem akun mandiri dengan RBAC (`user`, `admin`).
- Sistem dompet tertutup (*closed-loop internal wallet*) dengan mata uang tunggal IDR (Rupiah).
- Transaksi pemasukan, pengeluaran, dan transfer saldo internal antar-pengguna terdaftar.
- Kategori transaksi (kategori global sistem + kategori kustom per pengguna) serta anggaran bulanan.
- Unggah file bukti transaksi (gambar/PDF) dengan validasi tipe dan ukuran.
- Fitur pencarian, filter, pengurutan (*sorting*), dan pagination pada tabel transaksi dan riwayat aktivitas.
- Notifikasi internal aplikasi (berbasis database) untuk status transfer dan peringatan anggaran.
- Dokumentasi API Swagger/OpenAPI dan Postman collection.
- Database PostgreSQL dengan $\ge 6$ tabel utama, 4 tipe relasi (1:1, 1:N, N:1, N:N), soft delete pada $\ge 2$ tabel, dan seeder $\ge 20$ record per tabel.

### Out-of-Scope (Bukan Prioritas Versi Awal) `[DECIDED]`
- Integrasi Payment Gateway pihak ketiga (Midtrans, Xendit, Stripe, dll.).
- Integrasi Open Banking API / penarikan uang nyata ke rekening bank.
- Multi-currency (konversi kurs mata uang asing dinamis).
- Notifikasi push eksternal (SMS gateway, WhatsApp API, Push notification mobile native).
- Penerbitan kartu debit fisik atau virtual kartu kredit.

## 6. Asumsi `[ASSUMPTION]`
- **ASMP-01**: Seluruh nilai transaksi disimpan dalam satuan mata uang Rupiah integer (IDR tidak memiliki desimal sen operasional praktis dalam kasus ini) atau nilai minor unit baku.
- **ASMP-02**: Lingkungan pengujian dan demo dijalankan pada satu zona waktu standar (`Asia/Jakarta`, UTC+7).
- **ASMP-03**: Saldo pengguna tidak boleh pernah bernilai negatif dalam kondisi transaksi apa pun.
- **ASMP-04**: Penyimpanan file bukti transaksi untuk fase awal menggunakan penyimpanan lokal terisolasi (*local disk storage*) dengan abstraksi antarmuka *storage service* yang dapat dialihkan ke S3/Cloud Storage di masa depan.

## 7. Glosarium Istilah
- **Closed-Loop Wallet**: Dompet digital yang saldonya hanya beredar di dalam ekosistem aplikasi ini dan tidak terhubung ke bank eksternal.
- **Ledger Entry / Wallet Entry**: Catatan mutasi debit/kredit atomik yang merekam perubahan saldo dompet.
- **Soft Delete**: Mekanisme penandaan data sebagai terhapus melalui kolom `deleted_at` tanpa menghapus baris fisik dari database untuk kepentingan audit.
- **Idempotency Key**: Kunci unik yang disertakan klien pada transaksi untuk mencegah eksekusi ganda jika terjadi kegagalan jaringan atau klik tombol berulang.
- **RBAC**: Role-Based Access Control, pembatasan hak akses berdasarkan peran (`admin` dan `user`).

## 8. Daftar Keputusan Terbuka `[OPEN]`
- **OPEN-PB-01**: Apakah registrasi pengguna memerlukan verifikasi email OTP/token aktif sebelum dapat menggunakan wallet, atau cukup verifikasi langsung aktif untuk mempermudah penilaian tugas?  
  *Rekomendasi*: Akun langsung aktif saat registrasi pada fase awal, dengan skema kolom `is_verified` dan opsi aktivasi OTP jika waktu pengembangan memungkinkan.
- **OPEN-PB-02**: Batas maksimum ukuran file unggahan lampiran bukti transaksi.  
  *Rekomendasi*: Dibatasi maksimal 2MB per file dengan format yang diizinkan JPEG, PNG, dan PDF.
