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
   - Dikonfigurasi secara eksplisit hanya mengizinkan origin frontend resmi dari env `CORS_ORIGIN` (dapat memuat koma untuk multi-origin, misal `http://localhost:5173`).
   - Dilarang keras menggunakan wildcard origin `*` saat `credentials: true`.
   - Origin tidak dikenal ditolak dengan status HTTP 403 `ORIGIN_NOT_ALLOWED`.
   - Mengizinkan header: `Content-Type`, `Authorization`, `Idempotency-Key`, `X-Request-Id`.
   - Mengekspos header: `X-Request-Id`.
2. **Helmet Security Headers**:
   - Mematikan header `X-Powered-By`.
   - Mengaktifkan `X-Content-Type-Options: nosniff`.
   - Mengaktifkan `X-Frame-Options: SAMEORIGIN`.
   - Mengatur `Content-Security-Policy (CSP)`.
   - Konfigurasi `trust proxy` dibaca dari env `TRUST_PROXY`.

---

## 5. Pertahanan Terhadap Serangan Umum

### A. SQL Injection `[DECIDED]`
- Dilarang membuat raw SQL query dengan konkatenasi string bebas.
- Seluruh query database WAJIB menggunakan query berparameter (*parameterized queries* / `$1, $2`).
- Parameter pengurutan (`sort_by`) dan filter listing diperiksa secara ketat terhadap whitelist kolom per modul (`parseListingQuery`). Input non-whitelist ditolak dengan HTTP 400.

### B. Cross-Site Scripting (XSS) `[DECIDED]`
- Frontend React secara default melakukan *output encoding* pada rendering JSX. Dilarang menggunakan `dangerouslySetInnerHTML`.
- Backend melakukan sanitasi input dan validasi skema ketat (Zod) untuk menolak payload script berbahaya.

### C. Rate Limiting `[DECIDED]`
- Menggunakan middleware `express-rate-limit` dengan standard envelope `{ success: false, error: { code: 'TOO_MANY_REQUESTS', message, details: null, requestId } }` dan header `Retry-After`:
  - Global API: Default 100 request per 15 menit per IP (dikonfigurasi via `RATE_LIMIT_WINDOW_MS` & `RATE_LIMIT_MAX_REQUESTS`).
  - Factory `createRateLimiter`: Tersedia di `apps/api/src/middlewares/rate-limiter.middleware.ts` untuk diaplikasikan ke endpoint autentikasi (`/auth/login`, `/auth/register`) pada Phase 4.

### D. Keamanan File Upload `[DECIDED]`
- **Ukuran File**: Dibatasi maksimal 2MB per berkas.
- **Validasi MIME**: Hanya mengizinkan `image/jpeg`, `image/png`, dan `application/pdf`.
- **Validasi Magic Bytes**: Backend memeriksa signature file mentah (*magic bytes*), bukan hanya ekstensi berkas kiriman klien.
- **Penyimpanan Aman**: Nama berkas di-generate ulang menggunakan UUID acak (`<uuid>.<ext>`) untuk memitigasi *Path Traversal* dan eksekusi skrip ilegal di server.
- Berkas diunggah disimpan di direktori luar jangkauan eksekusi publik langsung dan dilayani lewat streaming terotentikasi.

---

## 6. Pengelolaan Secret & Sanitasi Log (Pino Redaction) `[DECIDED]`
- Secret JWT, kredensial database, dan konfigurasi sensitif hanya dibaca dari environment variable yang divalidasi fail-fast oleh Zod saat startup server (`apps/api/src/config/env.ts`).
- Menggunakan structured logger **Pino** dengan redaksi otomatis (*deep path redaction*):
  - Header: `authorization`, `cookie`, `set-cookie`.
  - Field objek: `password`, `token`, `refreshToken`, `accessToken`, `secret` (dan seluruh nested property turunannya) disensor menjadi `[REDACTED]`.
  - Body request **tidak pernah** dicatat ke log default.

---

## 7. Hal yang Masih Terbuka & Rekomendasi `[OPEN]`
- **OPEN-SEC-01**: Resolusi CSRF via Origin Whitelist & Idempotency-Key. (*Accepted pada ADR-023*).
- **OPEN-RATE-01**: *In-Memory Store Rate Limiting vs Distributed Store (Redis)*.  
  *Analisis*: Pada deployment multi-instance / horizontal scaling, `express-rate-limit` in-memory store hanya membatasi request per proses container dan tidak tersinkronisasi antar-instance.  
  *Rekomendasi*: Untuk lingkungan evaluasi dan single-instance development, in-memory store memadai dan minim dependensi. Jika dideploy ke cluster produksi multi-instance di masa depan, ganti store ke `rate-limit-redis`.
- **OPEN-ERR-01**: *Penyertaan `requestId` di Error Payload*.  
  *Analisis*: Menyertakan `requestId` dalam objek `error` (`{ success: false, error: { code, message, details, requestId } }`) mempermudah debugging dan pelaporan insiden oleh klien.  
  *Rekomendasi*: Disahkan sebagai standar payload error di Phase 3 dan diperbarui pada `API_CONTRACT.md`.
