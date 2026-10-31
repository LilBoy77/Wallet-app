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
- **Payload Minim & Session Binding**: Memuat klaim standar `sub` (user ID), `role` (`admin` | `user`), `email`, `jti` (UUID unik), serta `sid` (`family_id` dari sesi refresh token aktif).
- **Penyimpanan di Klien**: Disimpan secara aman di memori aplikasi JavaScript klien (misal React State / TanStack Query cache). Tidak disimpan di `localStorage` atau `sessionStorage` untuk mencegah pencurian token melalui serangan XSS.
- **Pengikatan Sesi & Pencabutan Seketika (Session Binding & Immediate Revocation)**:
  - Access token JWT terikat langsung pada sesi keluarga refresh token via klaim `sid` (`family_id`).
  - Middleware `authenticate` memverifikasi keberadaan refresh token aktif (`is_revoked = false AND expires_at > NOW()`) dalam keluarga sesi tersebut bersamaan dengan verifikasi status akun pengguna dalam **satu round-trip query** terindeks (`idx_refresh_tokens_family_user_active`).
  - Efek pencabutan instan: saat pengguna melakukan `POST /auth/logout`, `POST /auth/logout-all`, `PUT /auth/change-password`, `POST /auth/reset-password`, atau saat reuse detection terpicu, access token **ditolak seketika** (HTTP 401 UNAUTHORIZED) tanpa menunggu sisa masa berlaku 15 menit habis.
  - Sesi perangkat lain milik pengguna yang sama tetap terlindungi dan valid saat logout biasa pada satu perangkat.


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

---

## 8. Keamanan Unggah Berkas, Perlindungan Bukti Transaksi & Jejak Audit (Phase 6) `[DECIDED]`

Sistem menerapkan prinsip *Defense in Depth* komprehensif pada penanganan berkas unggahan bukti transaksi dan audit trail sistem:

### A. Validasi Tipe MIME Berbasis Magic Bytes (Anti-Spoofing)
- **Kelemahan Validasi Standar**: Ekstensi nama file dan header HTTP `Content-Type` yang dikirim peramban dapat dipalsukan secara sepele (misal berkas executable `.exe` diganti nama menjadi `struk.jpg`).
- **Verifikasi Byte Pembuka (Magic Bytes)**:
  - Backend memindai byte pembuka buffer berkas di memori menggunakan validator terdedikasi (`magic-bytes.validator.ts`).
  - Whitelist tipe MIME yang diizinkan terbatas pada:
    - **JPEG**: `ffd8ffe0`, `ffd8ffe1`, `ffd8ffe2`, `ffd8ffdb`, `ffd8ffee`
    - **PNG**: `89504e47`
    - **WebP**: `52494646` (RIFF) + `57454250` (WEBP)
    - **PDF**: `25504446` (`%PDF`)
  - Seluruh berkas di luar whitelist atau dengan magic bytes tidak cocok langsung ditolak seketika dengan HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.

### B. Isolasi Berkas Fisik & Direktori Non-Executable
- Berkas fisik disimpan di direktori terisolasi di luar root web publik (`apps/api/uploads/attachments/`).
- **Dilarang Keras Static Serving**: Server backend TIDAK PERNAH menyajikan direktori unggahan menggunakan `express.static()`. Hal ini mencegah eksekusi skrip berbahaya secara langsung melalui URL statis peramban.

### C. Sanitasi Nama Berkas (Anti-Path Traversal)
- Nama berkas asli pengguna disanitasi secara ketat (`filename.sanitizer.ts`) untuk membuang traversal characters (`../`, `..\`), karakter kontrol, dan null bytes (`\0`).
- Penyimpanan fisik di filesystem selalu menggunakan nama acak unik UUIDv4 (`${randomUUID()}.${ext}`) untuk mencegah tabrakan nama dan *file overwriting*.

### D. Header Keamanan Unduhan Berkas (Authenticated Streaming Download)
- Berkas hanya dapat diakses melalui endpoint terproteksi (`GET /api/v1/attachments/:id/download`) setelah melalui verifikasi token (`authenticate`) dan verifikasi kepemilikan transaksi (`assertOwnerOrAdmin`).
- Respon streaming berkas dilengkapi dengan response headers keamanan ketat:
  - `X-Content-Type-Options: nosniff` (mencegah browser melakukan MIME-type sniffing).
  - `Content-Disposition: attachment; filename="<sanitized_original_name>"` (memaksa download alih-alih rendering script).
  - `Cache-Control: private, no-store, max-age=0` (mencegah penyimpanan di shared cache publik).

### E. Penegakan Kuota Konkuren Maksimal 5 Lampiran per Transaksi
- Setiap transaksi dibatasi maksimal 5 berkas lampiran aktif.
- Untuk mengeliminasi race-condition konkurensi antar-permintaan upload paralel, pengecekan kuota dieksekusi di dalam database transaction dengan exclusive row lock pada baris transaksi (`SELECT id, wallet_id FROM transactions WHERE id = $1 FOR UPDATE`).
- Jika kuota sudah mencapai 5, upload berikutnya ditolak dengan HTTP 400 `ATTACHMENT_LIMIT_EXCEEDED`.

### F. Rollback Berkas Fisik Atomik
- Jika transaksi database mengalami kegagalan pasca penyimpanan berkas fisik ke disk, blok `catch` pada service layer secara otomatis mengeksekusi penghapusan berkas (`fs.unlink`) untuk menjamin tidak ada berkas yatim (*orphan files*) yang tertinggal di filesystem.

### G. Jejak Audit Abadi (Tamper-Proof Audit Trail), Katalog Terpadu & Privasi Login Gagal
- Seluruh 25 mutasi/kejadian keamanan kritis lintas domain disatukan dalam katalog `ACTIVITY_ACTIONS` (`activity-log.helper.ts`) dengan union type ketat `ActivityAction` pada `recordActivity` dan `authRepository.recordActivityLog` sehingga string literal di luar katalog tertolak saat kompilasi.
- Immutabilitas dijamin di tingkat database via PostgreSQL trigger `trg_activity_logs_immutable` yang memblokir `UPDATE` dan `DELETE`.
- Helper `recordActivity` / `sanitizeLogMetadata` melakukan redaksi otomatis pada metadata audit untuk memastikan password, token, secret internal, `file_path`, maupun `email` mentah tidak pernah tersimpan.
- **Perlindungan Tabel Append-Only & Privasi PII pada Login Gagal**:
  - Percobaan login dengan email yang tidak terdaftar hanya dicatat ke structured logger Pino (`logger.warn`) dengan hash SHA-256 dari email ternormalisasi (`email_hash`) dan alamat IP — **tidak** menulis baris ke tabel `activity_logs` agar tabel *append-only* tidak dapat dibanjiri tanpa batas dari jalur tanpa autentikasi.
  - Percobaan login gagal pada akun terdaftar mencatat `USER_LOGIN_FAILED` ke `activity_logs` dengan `user_id`, alamat IP, dan `reason: 'INVALID_CREDENTIALS'` (kata sandi salah) atau `reason: 'ACCOUNT_INACTIVE'` (akun nonaktif / soft-deleted), tanpa pernah menyimpan email mentah.

---

## 9. Catatan Batasan & Daftar Keputusan Terbuka `[OPEN]` untuk Phase 12


Berikut adalah daftar isu arsitektural dan operasional yang dicatat sebagai `[OPEN]` untuk diputuskan pada Phase 12 (Hardening, Audit & Production Prep):

1. **[OPEN-SEC-02] Kebijakan SameSite Cookie vs Frontend Lintas Situs**:
   - *Kondisi Saat Ini*: Cookie refresh token menggunakan `SameSite='Lax'`. Konfigurasi ini aman dan ideal jika frontend dan backend berada pada origin yang sama atau satu root domain (misal via dev proxy Vite lokal, atau di produksi `app.wallet.com` & `api.wallet.com`).
   - *Isu*: Jika di produksi frontend dan backend di-hosting pada domain pihak ketiga yang berbeda secara utuh (misal `wallet.vercel.app` dan `wallet-api.railway.app`), browser akan memblokir pengiriman cookie `SameSite=Lax` pada request fetch/XHR lintas situs.
   - *Opsi Solusi*: Mengubah ke `SameSite='None'` + `Secure=true` (dengan mengandalkan CSRF custom header defense) ATAU mewajibkan arsitektur domain tunggal (custom domain / reverse proxy).

2. **[OPEN-SEC-03] Tuning Parameter Argon2id dan Dampak Memori Server**:
   - *Kondisi Saat Ini*: Menggunakan konfigurasi standar rekomendasi OWASP: Memory cost 64 MB (65,536 KB), Time cost 3 iterations, Parallelism 4 threads.
   - *Isu*: Pada infrastruktur bersumber daya kecil (VPS 512 MB - 1 GB RAM atau serverless instance), 10 percobaan login/registrasi simultan membutuhkan $\ge 640\text{ MB}$ RAM yang dapat memicu Out-of-Memory (OOM killer).
   - *Opsi Solusi*: Melakukan *benchmark* dan penyesuaian parameter memori Argon2id (misal 32 MB atau 19 MB per batas minimum OWASP) jika target hosting memiliki RAM terbatas, atau mengisolasi proses autentikasi.

3. **[OPEN-SEC-04] Mekanisme Penjadwalan Pembersihan Token (`db:cleanup-tokens`)**:
   - *Kondisi Saat Ini*: Skrip pembersihan `pnpm db:cleanup-tokens` (`apps/api/src/database/scripts/cleanup-tokens.ts`) sudah siap dan tervalidasi secara manual/CLI.
   - *Isu*: Eksekusi otomatis berkala belum terhubung ke scheduler sistem produksi.
   - *Opsi Solusi*: Menggunakan OS crontab di tingkat virtual machine, Kubernetes CronJob, atau task scheduler internal (e.g., node-cron / BullMQ worker).

4. **[OPEN-SEC-05] Mitigasi Timing Attack pada Login (Klaim Best-Effort)**:
   - *Kondisi Saat Ini*: Diterapkan verifikasi *dummy Argon2id hash* untuk email yang tidak ditemukan agar menyamakan waktu kalkulasi CPU dengan email yang ada.
   - *Isu*: Pada runtime managed seperti Node.js dengan V8 garbage collection, JIT compiler, dan event-loop async concurrency, pencegahan timing attack tidak dapat dijamin 100% konstan secara matematis pada presisi nanodetik.
   - *Pencatatan*: Mitigasi ini ditegaskan sebagai pertahanan *best-effort* praktis, bukan jaminan mutlak tingkat sirkuit/hardware.

5. **[OPEN-SEC-06] Kebijakan Retensi & Arsip Partisi Tabel Append-Only (`activity_logs`)**:
   - *Kondisi Saat Ini*: Tabel `activity_logs` dilindungi trigger `trg_activity_logs_immutable` yang menolak seluruh `UPDATE` dan `DELETE`, serta dilindungi dari banjir request tanpa autentikasi dengan mengalihkan percobaan email tak terdaftar ke Pino logger.
   - *Batasan*: Belum ada kebijakan retensi waktu (*log retention policy*) atau pemisahan partisi bulanan (`PARTITION BY RANGE (created_at)`) untuk mengarsipkan dan melepas (*detach*) log berusia sangat tua di produksi tanpa melanggar jaminan immutabilitas baris aktif.
   - *Opsi Solusi*: Menerapkan *declarative table partitioning* PostgreSQL per bulan/kuartal dengan prosedur `DETACH PARTITION` ke cold storage yang hanya diizinkan bagi peran DBA migrasi terjadwal.

