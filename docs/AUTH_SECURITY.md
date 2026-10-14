# AUTH_SECURITY — Kebijakan Autentikasi, Otorisasi & Keamanan Sistem

Dokumen ini mendefinisikan standar keamanan, arsitektur token, manajemen sesi, mitigasi serangan siber, dan kebijakan otorisasi data finansial untuk **Wallet App**.

---

## 1. Hashing Password & Manajemen Kredensial `[DECIDED]`
- **Algoritma Utama**: **Argon2id** (via library native `argon2`) dengan parameter aman OWASP:
  - Memory cost: 65,536 KB (64 MB)
  - Time cost (iterations): 3
  - Parallelism: 4 threads
- **Migrasi Bertahap Kredensial Warisan (Bcrypt Auto-Rehash)**:
  - Database seeder atau sistem awal mungkin memuat hash `$2a$` / `$2b$` (bcrypt).
  - Pada setiap proses login yang berhasil, sistem mendeteksi apakah format hash adalah bcrypt. Jika terdeteksi, password diverifikasi menggunakan `bcryptjs`, lalu secara otomatis di-hash ulang menggunakan Argon2id dan disimpan ke database secara transparan tanpa mengganggu pengguna.
- **Mitigasi Serangan Enumerasi Akun & Timing Attacks**:
  - Pada endpoint `POST /auth/login`, jika identifier/email tidak terdaftar dalam database, server mengeksekusi *dummy hash verification* menggunakan hash Argon2id standar untuk menjaga durasi kalkulasi CPU identik antara email valid dan email tidak valid.
  - Respon kegagalan login selalu bernilai generik: `"Email atau kata sandi tidak valid"` (HTTP 401 `UNAUTHORIZED`).
  - Pada endpoint `POST /auth/forgot-password`, respon server selalu bernilai konstan: `"Jika email terdaftar pada sistem kami, tautan pemulihan kata sandi telah dikirimkan"` (HTTP 200 OK) baik email terdaftar maupun tidak.
- **Kebijakan Kompleksitas Kata Sandi**:
  - Panjang minimal 8 karakter, maksimal 72 karakter.
  - Wajib kombinasi huruf besar (`A-Z`), huruf kecil (`a-z`), dan angka (`0-9`).
- **Penyimpanan**: Hanya hash password yang disimpan di kolom `users.password_hash`. Password dalam format plain-text DILARANG KERAS dicatat dalam log, dikirim ke klien, atau disimpan di variabel memori permanen.

---

## 2. Arsitektur Token & Siklus Sesi (JWT + Opaque Refresh Token) `[DECIDED]`
Sistem menerapkan strategi hybrid token dengan pemisahan peran yang ketat:

```
[ Klien / Browser ]                                               [ Server API / DB ]
        │                                                                  │
        │ ── 1. POST /api/v1/auth/login (email, password) ───────────────> │
        │ <── 2. Response: { accessToken, user } (Expires in 15m) ──────── │
        │ <──    Set-Cookie: refreshToken (7d, HttpOnly, Path=/api/v1/auth)│ (Simpan SHA-256 di DB)
        │                                                                  │
        │ ── 3. Request Bisnis + Header "Authorization: Bearer <token>" ─> │
        │ <── 4. Data Response (200 OK) ────────────────────────────────── │
        │                                                                  │
 (15 Menit Kemudian - Access Token Expired)                                │
        │ ── 5. POST /api/v1/auth/refresh + Cookie: refreshToken ────────> │ (Atomic Rotation with
        │ <── 6. Response: Access Token baru + Set-Cookie rotated token ── │  SELECT ... FOR UPDATE)
```

### A. Access Token (JWT):
- **Masa Berlaku**: Singkat (15 menit / 900 detik).
- **Format**: JSON Web Token (JWT) ditandatangani secara kriptografis menggunakan algoritma `HS256`.
- **Validasi Ketat**: Verifikasi wajib mencakup `algorithms: ['HS256']`, `issuer: env.JWT_ISSUER`, dan `audience: env.JWT_AUDIENCE`.
- **Payload Minim**: Memuat klaim standar `sub` (user ID), `role` (`admin` | `user`), `email`, dan `jti` (UUID unik).
- **Penyimpanan di Klien**: Disimpan secara aman di memori aplikasi JavaScript klien (misal React State / TanStack Query cache). Tidak disimpan di `localStorage` atau `sessionStorage` untuk mencegah pencurian token melalui serangan XSS.

### B. Refresh Token (Opaque Token & Session Family):
- **Format Token**: Token acak kriptografis 256-bit berentropi tinggi (`crypto.randomBytes(32).toString('hex')`).
- **Penyimpanan di Database**: Server **TIDAK PERNAH** menyimpan refresh token mentah. Yang disimpan pada tabel `refresh_tokens` HANYA hash kriptografis **SHA-256** (tepat 64 karakter heksadesimal).
- **Pengiriman ke Klien**: Disimpan di browser pengguna menggunakan HTTP Cookie dengan atribut keamanan maksimal:
  - `HttpOnly = true`: Tidak dapat diakses oleh skrip sisi klien / JavaScript (kebal eksploitasi pencurian XSS).
  - `Secure = true`: Wajib aktif di lingkungan produksi (`NODE_ENV === 'production'`) untuk membatasi transmisi hanya melalui koneksi HTTPS.
  - `SameSite = 'Lax'`: Mencegah pengiriman cookie pada request lintas situs berbahaya (CSRF).
  - `Path = '/api/v1/auth'`: Membatasi cakupan pengiriman cookie hanya ke sub-rute autentikasi (`/refresh`, `/logout`). Cookie tidak dikirim pada request API bisnis umum lainnya.
  - `Max-Age = 7 hari` (604,800 detik).
- **Rotasi Atomik (Atomic Token Rotation)**:
  - Setiap pemanggilan endpoint `POST /api/v1/auth/refresh`, refresh token yang digunakan langsung dibatalkan (`is_revoked = true`) dan diterbitkan refresh token baru.
  - Rotasi dieksekusi di dalam database transaction dengan row-level lock (`SELECT ... FOR UPDATE`) untuk mencegah race condition konkurensi request.
- **Deteksi Penggunaan Ulang Token (Token Reuse Detection)**:
  - Setiap sesi login memiliki `family_id` (UUID). Seluruh refresh token yang dihasilkan dari rantai rotasi sesi tersebut terhubung ke `family_id` yang sama.
  - Jika token yang sudah dibatalkan (`is_revoked = true`) terdeteksi dikirim kembali ke endpoint `/refresh`, sistem mengidentifikasi terjadinya kompromi token (pencurian sesi).
  - Tindakan Mitigasi: Sistem langsung membatalkan **SELURUH** refresh token dalam `family_id` tersebut (`UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1`), mencatat audit log ancaman keamanan, dan mengembalikan HTTP 401 `UNAUTHORIZED`.
- **Pencabutan Sesi (Revocation)**:
  - `POST /api/v1/auth/logout`: Membatalkan refresh token aktif saat ini dan menghapus cookie dari browser.
  - `POST /api/v1/auth/logout-all`: Membatalkan seluruh refresh token milik pengguna di semua perangkat (`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`).

---

## 3. Otorisasi Berbasis Peran (RBAC) & Keamanan Rute `[DECIDED]`

### A. Lapisan Middleware Autentikasi (`authenticate`)
- Mengekstrak Bearer token dari header `Authorization`.
- Memverifikasi integritas dan masa berlaku JWT.
- **Verifikasi Real-time Status Pengguna di Database**:
  - Walaupun JWT masih berlaku (belum expired), middleware selalu memeriksa status pengguna di database.
  - Jika pengguna dinonaktifkan (`is_active = false`) atau telah dihapus secara soft-delete (`deleted_at IS NOT NULL`), request langsung ditolak dengan HTTP 401 `UNAUTHORIZED`. Hak akses dicabut seketika tanpa menunggu masa berlaku token 15 menit habis.
- Menyematkan profil pengguna ke `req.user` (`id`, `role`, `email`, `username`).

### B. Lapisan Otorisasi Peran (`requireRole`)
- Menegakkan kontrol akses berbasis peran (`admin` vs `user`).
- Jika pengguna terotentikasi tidak memiliki peran yang dipersyaratkan, request ditolak dengan HTTP 403 `FORBIDDEN` dan kode error `FORBIDDEN`.

### C. Pencegahan IDOR (*Insecure Direct Object Reference*) via `assertOwnerOrAdmin`
- Menjamin isolasi data antar-pengguna pada rute resource berparameter (`/users/:id`, `/wallets/:id`, dll.).
- Pengguna hanya diizinkan mengakses resource miliknya sendiri, kecuali jika memiliki peran `admin`. Akses tidak sah ditolak dengan HTTP 403 `FORBIDDEN`.

### D. Structural Route Policy Guard (`routePolicyGuard`)
- Memastikan tidak ada endpoint API baru yang tertinggal atau tidak sengaja terekspos tanpa perlindungan otentikasi/otorisasi yang eksplisit.
- Seluruh rute di bawah `/api/v1` didaftarkan secara deklaratif pada `ROUTE_POLICY_REGISTRY` (`public`, `authenticated`, `admin_only`, `owner_or_admin`).
- Pengujian otomatis memindai seluruh router Express stack dan memastikan setiap rute terdaftar dalam registry.

---

## 4. Perlindungan Terhadap Serangan CSRF `[DECIDED]`
Meskipun cookie refresh token dilindungi oleh `SameSite=Lax`, sistem menerapkan pertahanan berlapis (*Defense in Depth*) pada endpoint mutasi sesi `POST /api/v1/auth/refresh` dan `POST /api/v1/auth/logout`:
1. **Validasi Origin & Referer**: Request lintas origin diverifikasi terhadap whitelist origin `CORS_ORIGIN`. Request dari origin asing ditolak dengan HTTP 403 `ORIGIN_NOT_ALLOWED`.
2. **Kewajiban Custom Header**: Request mutasi yang menggunakan cookie wajib menyertakan custom header (misal `X-Requested-With: XMLHttpRequest` atau `Authorization`). Permintaan lintas situs standar (seperti form submission browser) tidak dapat menyematkan custom header tanpa persetujuan preflight CORS.

---

## 5. Alur Pemulihan Kata Sandi (Password Reset Flow) `[DECIDED]`
1. Pengguna meminta tautan reset sandi via `POST /api/v1/auth/forgot-password` dengan mengirimkan email.
2. Server membuat token acak kriptografis 256-bit (`crypto.randomBytes(32).toString('hex')`).
3. Hash SHA-256 dari token disimpan pada tabel `password_resets` beserta masa berlaku (`PASSWORD_RESET_EXPIRES_MINUTES`, default 15 menit).
4. **Pencegahan Host Header Poisoning**: Tautan reset kata sandi (`${env.APP_BASE_URL}/reset-password?token=${token}`) dibangun strictly menggunakan konfigurasi server `APP_BASE_URL`. Server **DILARANG KERAS** menggunakan header `Host` atau `X-Forwarded-Host` dari klien untuk merangkai tautan email.
5. **Transpor Email Dev vs Prod**:
   - Pada mode development/test (`MAIL_TRANSPORT=outbox`), surat elektronik ditulis ke direktori lokal terisolasi `apps/api/.outbox/` dalam format JSON dan terdaftar di `.gitignore`.
   - Pada mode production, konfigurasi SMTP diverifikasi secara fail-fast saat startup server.
6. Pengguna mengeksekusi reset kata sandi via `POST /api/v1/auth/reset-password` dengan token dan `new_password`.
7. Server memvalidasi token (belum kedaluwarsa dan `is_used = false`), mengupdate hash password baru dengan Argon2id, menandai token sebagai digunakan (`is_used = true`), dan mencabut **SEMUA** sesi aktif pengguna tersebut (`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`) demi keamanan.

---

## 6. Pembersihan Token Berkala (Token Cleanup Maintenance) `[DECIDED]`
- Refresh token dan password reset record yang kedaluwarsa atau telah dibatalkan dibersihkan secara berkala untuk menjaga performa indeks database.
- Skrip pemeliharaan CLI tersedia melalui `pnpm db:cleanup-tokens` (`apps/api/src/database/scripts/cleanup-tokens.ts`) yang dapat dijalankan secara terjadwal (cron job).

---

## 7. Sanitasi Log & Pengelolaan Secret `[DECIDED]`
- Kredensial dan secret JWT divalidasi saat inisialisasi aplikasi via Zod schema (`apps/api/src/config/env.ts`). Jika secret menggunakan nilai default/placeholder di lingkungan produksi, server langsung crash saat startup (*fail-fast*).
- Structured logger **Pino** melakukan sensor otomatis (*deep redacting*) terhadap nilai sensitif:
  - Header: `authorization`, `cookie`, `set-cookie`.
  - Properti: `password`, `token`, `refreshToken`, `accessToken`, `secret`, `new_password`, `current_password`.
  - Body request tidak pernah dicatat dalam log produksi.
