# Sumber Tugas Asli (Assignment Source)

> **Catatan Status**: Dokumen ini memuat teks tugas asli apa adanya sesuai instruksi Phase 0. Jika ada pembaruan teks dari pengajar/instruktur, ganti teks di bawah ini dan catat perubahannya.

---

[TEMPEL TEKS TUGAS ASLI DI SINI]

---

## Ringkasan Ketentuan Minimum Tugas (Kompilasi Awal)
Berdasarkan pengarahan tugas full-stack project, aplikasi wajib memenuhi kriteria dasar teknis berikut:
1. **Entitas & CRUD**: Minimal $\ge 6$ entitas CRUD fungsional.
2. **Skema Database Relasional**: Minimal $\ge 6$ tabel utama dengan integritas referensial.
3. **Kardinalitas Relasi Lengkap**: Memiliki 4 tipe kardinalitas relasi nyata:
   - **1:1 (One-to-One)**
   - **1:N (One-to-Many)**
   - **N:1 (Many-to-One)**
   - **N:N (Many-to-Many)**
4. **Soft Delete**: Diterapkan pada minimal $\ge 2$ tabel dengan justifikasi audit/keuangan.
5. **Database Seeder**: Minimal $\ge 20$ data seed per tabel utama yang diwajibkan untuk keperluan testing dan demo.
6. **Keamanan & Autentikasi**: Autentikasi berbasis token/sesi aman, enkripsi/hashing password, RBAC (Role-Based Access Control: minimal User dan Admin), validasi sisi server, pencegahan CSRF/XSS/SQL Injection.
7. **Dokumentasi & Testing**: Dokumentasi API (Swagger/OpenAPI + Postman Collection) serta pengujian (Unit Test, Integration/API Test).
8. **Transfer Saldo**: Menggunakan saldo internal (closed-loop wallet balance), tanpa integrasi payment gateway pihak ketiga.

> **Aturan Preseden**: Jika teks tugas asli yang ditempel di atas bertentangan dengan ringkasan ini, maka teks tugas asli yang diutamakan dan perbedaannya dicatat di [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
