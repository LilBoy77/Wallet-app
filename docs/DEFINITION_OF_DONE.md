# DEFINITION_OF_DONE — Standar Penyelesaian Pekerjaan (DoD)

Dokumen ini memuat kriteria baku yang wajib dipenuhi sebelum suatu fitur, modul, atau fase dinyatakan selesai (`DONE`). Setiap AI agent atau pengembang dilarang mengklaim penyelesaian sebelum seluruh item di bawah ini terverifikasi secara nyata.

---

## 1. Kriteria Fungsional & Kebutuhan
- [ ] **Kesesuaian Spesifikasi**: Seluruh kriteria penerimaan pada [REQUIREMENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/REQUIREMENTS.md) untuk ID terkait telah terpenuhi secara fungsional.
- [ ] **Bebas Data Dummy**: Data yang ditampilkan berasal dari persistensi database PostgreSQL nyata melalui endpoint API riil, bukan hardcoded array/mock object di antarmuka produksi.
- [ ] **Penanganan Kasus Batas (Edge Cases)**: Input kosong, karakter khusus, nilai desimal tak sah, nilai negatif, dan duplikasi data telah ditangani secara eksplisit.

## 2. Arsitektur & Kualitas Kode
- [ ] **Kepatuhan Arsitektur**: Struktur kode mengikuti [ARCHITECTURE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ARCHITECTURE.md), [FRONTEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/FRONTEND_GUIDELINES.md), dan [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md).
- [ ] **TypeScript Strict**: Tidak ada kompilasi error TypeScript dan tidak ada penggunaan tipe `any` tanpa justifikasi tertulis.
- [ ] **Pembersihan Kode**: Tidak meninggalkan dead code, `console.log` sisa debugging sementara, atau komentar instruksi AI.
- [ ] **Tanpa Regresi**: Tidak ada fungsionalitas terdahulu yang rusak atau terhapus secara tidak sengaja (*no accidental regressions*).

## 3. Validasi & Keamanan (Security)
- [ ] **Validasi Ganda (Dual-Layer Validation)**: Validasi input dilakukan di sisi frontend (UX responsif) dan di sisi backend (skema Zod) untuk mencegah bypass API langsung.
- [ ] **Otorisasi Server-Side**: Kepemilikan data (*resource ownership*) diverifikasi di backend; user A tidak dapat membaca atau mengubah data milik user B (pencegahan IDOR).
- [ ] **Perlindungan Injeksi**: Query database menggunakan parameterized query / ORM yang aman dari SQL Injection.
- [ ] **Pencegahan XSS & CSRF**: Output data disanitasi; cookie autentikasi menggunakan flag `HttpOnly`, `SameSite=Lax/Strict`, dan `Secure` (di production).
- [ ] **Bebas Kredensial Nyata**: Tidak ada API key, token rahasia, atau password riil yang ter-commit ke dalam repositori.

## 4. Integritas Transaksi & Database
- [ ] **Atomisitas Database**: Setiap mutasi saldo ganda (transfer internal) atau mutasi transaksi dibungkus dalam unit transaksi database terisolasi (`BEGIN ... COMMIT / ROLLBACK`).
- [ ] **Integritas Relasi**: Foreign key, constraint non-negatif (`balance >= 0`), dan relasi terdefinisi jelas di skema migrasi.
- [ ] **Migrasi Dua Arah**: Skema database dapat di-migrate (`up`) dan di-rollback (`down`) tanpa kegagalan.

## 5. Pengujian & Bukti Verifikasi
- [ ] **Pengujian Berhasil**: Pengujian unit dan integrasi yang relevan dijalankan dan lulus 100% tanpa kegagalan tersembunyi.
- [ ] **Skenario Kritis Teruji**: Uji saldo tidak cukup, uji transfer ke akun sendiri (jika dilarang), dan uji transfer ganda telah diverifikasi.
- [ ] **Responsif Multi-Device**: Tampilan diuji pada resolusi mobile (375px), tablet, dan desktop tanpa layout overflow.

## 6. Dokumentasi & Pembaruan Status
- [ ] **Kontrak API Terbarui**: Jika ada endpoint baru atau perubahan skema request/response, file [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) telah diperbarui.
- [ ] **Keputusan Arsitektur Tercatat**: Setiap trade-off teknis atau penyesuaian dicatat di [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
- [ ] **Status Requirement Diperbarui**: Status requirement di [REQUIREMENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/REQUIREMENTS.md) diperbarui berdasarkan bukti nyata pengujian (misal dari `PLANNED` menjadi `IMPLEMENTED` atau `VERIFIED`).
