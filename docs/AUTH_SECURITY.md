# AUTH_SECURITY — Kebijakan Autentikasi, Otorisasi & Keamanan Sistem

Dokumen ini mendefinisikan standar keamanan, arsitektur token, perlindungan data finansial, dan mitigasi kerentanan keamanan siber untuk **Wallet App**.

---

## 1. Hashing Password & Manajemen Kredensial `[DECIDED]`
- **Algoritma**: Menggunakan **Argon2id** (atau **bcrypt** dengan cost factor 12 salt rounds).
- **Kebijakan Sandi**:
  - Panjang minimal 8 karakter.
  - Wajib kombinasi huruf besar, huruf kecil, dan angka.
- **Penyimpanan**: Hanya hash password yang disimpan di kolom `users.password_hash`. Password dalam format plain-text DILARANG KERAS dicatat dalam log atau disimpan di variabel memori permanen.

---

## 2. Arsitektur Token & Siklus Sesi (JWT + Refresh Token) `[DECIDED]`
Sistem menerapkan strategi hybrid token untuk mengimbangi kenyamanan dan keamanan:

```
[ Klien / Browser ]                                      [ Server API ]
        │                                                      │
        │ ── 1. POST /auth/login (kredensial) ───────────────> │
        │ <── 2. Response Body: accessToken (15m) ──────────── │
        │ <──    Set-Cookie: refreshToken (7d, HttpOnly) ───── │
        │                                                      │
        │ ── 3. Request Bisnis + Header Bearer accessToken ──> │
        │ <── 4. Data Response (200 OK) ────────────────────── │
        │                                                      │
 (Setelah 15 menit, accessToken Expired)                       │
        │ ── 5. POST /auth/refresh + Cookie: refreshToken ───> │
        │ <── 6. accessToken baru + Rotated refreshToken ──── │
```

### Properti Keamanan Cookie Refresh Token:
- `HttpOnly = true`: Mencegah script berbahaya/XSS membaca nilai refresh token.
- `Secure = true`: Hanya dikirim melalui koneksi HTTPS (pada mode development dapat disesuaikan via env `NODE_ENV === 'production'`).
- `SameSite = 'Lax'` (atau `'Strict'`): Mencegah eksploitasi Cross-Site Request Forgery (CSRF).
- `Path = '/api/v1/auth'`: Membatasi pengiriman cookie hanya ke sub-rute autentikasi.

### Rotasi Token & Pencabutan Sesi (Token Revocation):
- Setiap kali refresh token digunakan pada endpoint `/auth/refresh`, server menerbitkan refresh token baru dan membatalkan (*revoke*) token lama pada tabel `refresh_tokens`.
- Jika refresh token yang sudah di-revoke terdeteksi digunakan kembali, sistem mendeteksi indikasi pencurian token (*token reuse detection*) dan mencabut seluruh sesi milik pengguna tersebut.
- Logout resmi menandai kolom `is_revoked = true` pada baris token di database dan menghapus cookie dari browser.

---

## 3. Otorisasi Berbasis Peran (RBAC) & Kepemilikan Data (IDOR Prevention) `[DECIDED]`
1. **Middleware Lapisan 1 (`requireAuth`)**: Memverifikasi validitas tandatangan JWT access token dan menyematkan payload user ke `req.user`.
2. **Middleware Lapisan 2 (`requireRole(['admin'])`)**: Menolak pengguna yang tidak memiliki peran yang diizinkan dengan status HTTP 403 Forbidden.
3. **Pemeriksaan Kepemilikan Resource (*Resource Ownership Guard*)**:
   - Otorisasi tidak boleh berhenti pada peran.
   - Pada endpoint seperti `GET /transactions/:id`, `PUT /budgets/:id`, atau `DELETE /attachments/:id`, lapisan Service/Repository WAJIB memvalidasi bahwa entitas yang diminta terhubung langsung dengan `req.user.id`:
     ```typescript
     // Pencegahan Insecure Direct Object Reference (IDOR)
     const transaction = await transactionRepo.findByIdAndWalletOwner(id, req.user.id);
     if (!transaction) {
       throw new AppError('Transaksi tidak ditemukan atau hak akses ditolak', 404);
     }
     ```

---

## 4. Keamanan Jaringan & Headers HTTP `[DECIDED]`
1. **CORS (Cross-Origin Resource Sharing)**:
   - Dikonfigurasi secara eksplisit hanya mengizinkan origin frontend resmi (`process.env.CLIENT_ORIGIN`, misal `http://localhost:5173`).
   - Dilarang keras menggunakan wildcard origin `*` saat `credentials: true`.
   - Mengizinkan header: `Content-Type`, `Authorization`, `Idempotency-Key`.
2. **Helmet Security Headers**:
   - Mematikan header `X-Powered-By`.
   - Mengaktifkan `X-Content-Type-Options: nosniff`.
   - Mengaktifkan `X-Frame-Options: DENY` (anti-clickjacking).
   - Mengatur `Content-Security-Policy (CSP)`.

---

## 5. Pertahanan Terhadap Serangan Umum

### A. SQL Injection `[DECIDED]`
- Dilarang membuat raw SQL query dengan konkatenasi string bebas.
- Seluruh query database WAJIB menggunakan query berparameter (*parameterized queries* / `$1, $2`) atau melalui Query Builder / ORM terpercaya.

### B. Cross-Site Scripting (XSS) `[DECIDED]`
- Frontend React secara default melakukan *output encoding* pada rendering JSX. Dilarang menggunakan `dangerouslySetInnerHTML`.
- Backend melakukan sanitasi input dan validasi skema ketat (Zod) untuk menolak payload script berbahaya.

### C. Rate Limiting `[DECIDED]`
- Menggunakan middleware `express-rate-limit` pada seluruh endpoint API:
  - Global API: Maksimal 100 request per 15 menit per IP.
  - Rute Autentikasi (`/auth/login`, `/auth/register`): Maksimal 5 percobaan per 15 menit per IP untuk mencegah *brute-force attack*.
  - Rute Transfer (`/transfers`): Maksimal 10 transaksi per menit untuk mencegah spam mutasi.

### D. Keamanan File Upload `[DECIDED]`
- **Ukuran File**: Dibatasi maksimal 2MB per berkas.
- **Validasi MIME**: Hanya mengizinkan `image/jpeg`, `image/png`, dan `application/pdf`.
- **Validasi Magic Bytes**: Backend memeriksa signature file mentah (*magic bytes*), bukan hanya ekstensi berkas kiriman klien.
- **Penyimpanan Aman**: Nama berkas di-generate ulang menggunakan UUID acak (`<uuid>.<ext>`) untuk memitigasi *Path Traversal* dan eksekusi skrip ilegal di server.
- Berkas diunggah disimpan di direktori luar jangkauan eksekusi publik langsung dan dilayani lewat streaming terotentikasi.

---

## 6. Pengelolaan Secret & Sanitasi Log `[DECIDED]`
- Secret JWT, kredensial database, dan konfigurasi sensitif hanya dibaca dari environment variable yang divalidasi saat inisialisasi server.
- Sistem logging terstruktur (Morgan / Winston) DILARANG merekam body payload yang memuat sandi (`password`, `current_password`, `new_password`), token autentikasi (`Bearer ...`), atau data cookie sensitif.

---

## 7. Hal yang Masih Terbuka & Rekomendasi `[OPEN]`
- **OPEN-SEC-01**: Implementasi CSRF Double Submit Cookie Token.  
  *Analisis*: Karena access token disimpan di memori React (bukan cookie) dan refresh token berada di HttpOnly cookie dengan `SameSite=Lax`, risiko CSRF pada request API umum sudah tereduksi secara signifikan. Namun untuk endpoint mutasi kritis seperti `/transfers`, penambahan custom header seperti `X-Requested-With` atau `Idempotency-Key` bertindak sebagai mitigasi CSRF tambahan yang efektif tanpa beban kompleksitas token ganda.  
  *Rekomendasi*: Gunakan validasi origin header dan keberadaan custom header `Idempotency-Key` sebagai perlindungan mutasi saldo.
