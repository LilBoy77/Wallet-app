# DECISIONS_LOG — Log Rekaman Keputusan Arsitektur (ADR)

Dokumen ini mencatat seluruh keputusan arsitektur dan teknis penting (Architecture Decision Records) dalam proyek Wallet App. Setiap perubahan arah teknis wajib didokumentasikan di sini dengan format baku.

---

## Ringkasan Log Keputusan
| ID | Tanggal | Topik Keputusan | Status | Dokumen Terkait |
| :--- | :--- | :--- | :--- | :--- |
| **ADR-001** | 2026-10-11 | Pemilihan Arsitektur Monorepo (pnpm workspaces) | `accepted` | [ARCHITECTURE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ARCHITECTURE.md) |
| **ADR-002** | 2026-10-11 | Komposisi Tech Stack Frontend & Backend | `accepted` | [PROJECT_BRIEF.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/PROJECT_BRIEF.md) |
| **ADR-003** | 2026-10-11 | Representasi Uang & Model Integritas Saldo | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-004** | 2026-10-11 | Mekanisme Transfer Saldo Internal (Closed-Loop) | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-005** | 2026-10-11 | Strategi Autentikasi, Sesi Cookie & RBAC | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-006** | 2026-10-11 | Kebijakan Soft Delete pada Entitas Tertentu | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-007** | 2026-10-11 | Strategi Penyimpanan & Validasi Upload Lampiran | `accepted` | [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) |
| **ADR-008** | 2026-10-11 | Standar Format Kontrak REST API & Error Envelope | `accepted` | [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) |
| **ADR-009** | 2026-10-11 | Standarisasi Versi Runtime Node.js (v24 LTS) & pnpm (v10.15.1) | `accepted` | [.nvmrc](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/.nvmrc) |
| **ADR-010** | 2026-10-11 | Standardisasi Linting & Formatter (ESLint Flat Config + Prettier) | `accepted` | [eslint.config.mjs](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/eslint.config.mjs) |
| **ADR-011** | 2026-10-11 | Validasi Lingkungan Fail-Fast dengan Zod di Backend | `accepted` | [apps/api/src/config/env.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/config/env.ts) |
| **ADR-012** | 2026-10-11 | Dev Server Proxy Frontend ke Backend API (Vite Proxy) | `accepted` | [apps/web/vite.config.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/web/vite.config.ts) |
| **ADR-013** | 2026-10-11 | Pinning Versi Image PostgreSQL (postgres:16.8-alpine) | `accepted` | [infrastructure/docker-compose.yml](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/infrastructure/docker-compose.yml) |
| **ADR-014** | 2026-10-11 | Pemilihan Development Runner (tsx) dan Test Runner (Vitest) | `accepted` | [package.json](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/package.json) |
| **ADR-015** | 2026-10-11 | Pemilihan Tool Migration Database (Native SQL Migrator berbasis pg) | `accepted` | [apps/api/src/database/migrator.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/database/migrator.ts) |
| **ADR-016** | 2026-10-11 | Standarisasi Primary Key UUIDv4 (gen_random_uuid) | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-017** | 2026-10-11 | Mekanisme Otomatisasi updated_at via PostgreSQL Trigger Function | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-018** | 2026-10-11 | Penegakan Append-Only Immutability pada Buku Besar (wallet_entries) | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-019** | 2026-10-11 | Strategi Soft Delete & Partial Unique Indexes (Case-Insensitive) | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-020** | 2026-10-11 | Kebijakan Integritas Referensial Foreign Key (CASCADE vs RESTRICT) | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-021** | 2026-10-11 | Strategi Database Seeder Deterministik & Rekonsiliasi Saldo | `accepted` | [apps/api/src/database/seeder.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/database/seeder.ts) |
| **ADR-022** | 2026-10-11 | Isolasi Database Pengujian & Multi-Layer Safety Guard | `accepted` | [apps/api/tests/database/test-db-helper.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/tests/database/test-db-helper.ts) |
| **ADR-023** | 2026-10-11 | Resolusi Keputusan Terbuka [OPEN] (OPEN-PB-01, OPEN-PB-02, OPEN-SEC-01) | `accepted` | [PROJECT_BRIEF.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/PROJECT_BRIEF.md) |
| **ADR-024** | 2026-10-16 | Pemilihan Structured Logger (Pino) dan Strategi Redaksi Sensitif | `accepted` | [apps/api/src/shared/logging/logger.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/shared/logging/logger.ts) |
| **ADR-025** | 2026-10-16 | Strategi Penanganan Unknown Fields pada Validasi Zod (Strip vs Strict) | `accepted` | [apps/api/src/middlewares/validator.middleware.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/middlewares/validator.middleware.ts) |
| **ADR-026** | 2026-10-16 | Urutan Pipeline Middleware Express & Keamanan Standar | `accepted` | [apps/api/src/app.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/app.ts) |
| **ADR-027** | 2026-10-16 | Strategi Rate Limiting In-Memory dan Factory Rute Autentikasi | `accepted` | [apps/api/src/middlewares/rate-limiter.middleware.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/middlewares/rate-limiter.middleware.ts) |
| **ADR-028** | 2026-10-16 | Translasi Komprehensif Error Postgres ke Kode Error Terstandarisasi | `accepted` | [apps/api/src/middlewares/error-handler.middleware.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/middlewares/error-handler.middleware.ts) |
| **ADR-029** | 2026-10-16 | Implementasi Middleware Validasi Skema Berbasis Zod (Req Body/Query/Params) | `accepted` | [apps/api/src/middlewares/validator.middleware.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/middlewares/validator.middleware.ts) |
| **ADR-030** | 2026-10-16 | Hashing Kata Sandi Argon2id (OWASP Parameter) & Auto-Rehash Bcrypt | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-031** | 2026-10-16 | Short-Lived Access Token (JWT HS256) & In-Memory Client Storage | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-032** | 2026-10-16 | Opaque Refresh Token (256-bit Hex) Disimpan sebagai SHA-256 Hash di DB | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-033** | 2026-10-16 | Mekanisme Rotasi Token Atomik & Deteksi Pencurian Sesi (Family Invalidation) | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-034** | 2026-10-16 | Mitigasi Enumerasi Akun & Serangan Waktu (Constant-Time Dummy Hash) | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-035** | 2026-10-16 | Structural Route Policy Guard & Verifikasi Status Real-time Pengguna | `accepted` | [apps/api/src/middlewares/route-policy.guard.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/middlewares/route-policy.guard.ts) |
| **ADR-036** | 2026-10-16 | Alur Pemulihan Kata Sandi Aman & Proteksi Host Header Poisoning | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-037** | 2026-10-16 | Manajemen Outbox Email Lokal & Guard SMTP Produksi | `accepted` | [apps/api/src/shared/mail/mail.service.ts](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/apps/api/src/shared/mail/mail.service.ts) |
| **ADR-038** | 2026-10-16 | Batas yang Diketahui pada Stateless Access Token setelah Logout & Opsi Session Binding | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-039** | 2026-10-16 | Daftar Keputusan Terbuka Arsitektur Keamanan untuk Phase 12 (OPEN-SEC-02 s/d 05) | `proposed` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-041** | 2026-10-16 | Session Binding Access Token ke Refresh Session Family untuk Pencabutan Seketika | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-042** | 2026-10-24 | Pembuatan Dompet Default secara Atomik Saat Registrasi Pengguna (D1) | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-043** | 2026-10-24 | Pencegahan Deadlock Konkuren Menggunakan Deterministic Ascending UUID Locking (D2) | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-044** | 2026-10-24 | Strategi Idempotensi Terdedikasi dengan Hashing Payload Kanonikal SHA-256 (D3) | `accepted` | [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) |
| **ADR-045** | 2026-10-24 | Mekanisme Pembatalan Transaksi (Void) Melalui Kompensasi Ledger Berpasangan (D4) | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-046** | 2026-10-24 | Isolasi Mutasi Saldo Struktural Tunggal pada WalletsRepository (D5) | `accepted` | [ARCHITECTURE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ARCHITECTURE.md) |
| **ADR-047** | 2026-10-24 | Operasi Aritmatika Finansial Aman Berbasis BigInt Murni (D6) | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-048** | 2026-10-24 | Immutability Atribut Finansial Transaksi | `accepted` | [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) |
| **ADR-049** | 2026-10-24 | Scoped Idempotency Constraint pada Transaksi Transfer (Source Wallet Scoping) | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-050** | 2026-10-24 | Kebijakan Caching Idempotensi pada Request Gagal, Penegakan Atomisitas, & TTL 24 Jam | `accepted` | [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) |
| **ADR-051** | 2026-10-24 | Simulasi Masuknya Saldo Ekosistem Tertutup, Gating Environment Top-up, dan Pagu Transaksional | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-052** | 2026-10-26 | Model Kategori Transaksi, Proteksi Kategori Sistem & Mekanisme Soft-Delete Reactivation | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-053** | 2026-10-26 | Arsitektur Realisasi Anggaran Bebas Floating-Point Berbasis BigInt Basis Points, Zona Waktu Terkonfigurasi (`BUDGET_TIMEZONE`) & Interval Setengah Terbuka | `accepted` | [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md) |
| **ADR-054** | 2026-10-26 | Arsitektur Keamanan Unggah Berkas Bukti Transaksi: Validasi Magic Bytes, Sanitasi Nama & Non-Executable Storage | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-055** | 2026-10-26 | Penegakan Kuota Maksimal 5 Lampiran per Transaksi via Exclusive Row-Locking (FOR UPDATE) | `accepted` | [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md) |
| **ADR-056** | 2026-10-26 | Penjaminan Jejak Audit Permanen (Append-Only Audit Trail) via PostgreSQL Immutable Trigger pada activity_logs | `accepted` | [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md) |
| **ADR-057** | 2026-10-26 | Strategi Streaming Multer In-Memory Buffer Guard dan Rollback Otomatis Berkas Fisik | `accepted` | [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md) |


---

## Rincian Keputusan Arsitektur

### ADR-001: Pemilihan Arsitektur Monorepo (pnpm workspaces)
- **Konteks**: Proyek membutuhkan keterkaitan erat antara frontend web, backend API, dan kontrak tipe/skema validasi yang konsisten.
- **Opsi**:
  1. Multi-repo (repositori terpisah untuk web dan api).
  2. Monorepo dengan npm/yarn workspaces.
  3. Monorepo dengan pnpm workspaces.
- **Keputusan**: Menggunakan **pnpm workspaces** (`apps/web`, `apps/api`, `packages/shared`, `infrastructure`).
- **Alasan**: pnpm memiliki performa instalasi sangat cepat, hemat ruang disk melalui *content-addressable store*, dan menjamin isolasi dependensi ketat (*no phantom dependencies*). Paket `packages/shared` memudahkan *single-source-of-truth* skema Zod dan tipe TypeScript.
- **Dampak**: Memerlukan file `pnpm-workspace.yaml` di root dan workflow build yang terorkestrasi.
- **Status**: `accepted`

---

### ADR-002: Komposisi Tech Stack Frontend & Backend
- **Konteks**: Kebutuhan tugas mencakup aplikasi full-stack terintegrasi dengan performa tinggi, styling modern, visualisasi data, dan basis data relasional.
- **Opsi**:
  1. Next.js full-stack (SSR/App Router) + PostgreSQL.
  2. React SPA + Express.js terpisah + PostgreSQL.
- **Keputusan**: **React 18+ (Vite + Tailwind + TanStack Query + React Hook Form + Zod + Recharts + Lucide)** untuk frontend, dan **Node.js + Express.js + TypeScript** untuk backend, dengan database **PostgreSQL**.
- **Alasan**: Memenuhi ketentuan eksplisit tugas; memisahkan klien dan server dengan antarmuka REST API murni memudahkan pengujian independen, penyusunan OpenAPI/Swagger, serta pembagian peran arsitektural.
- **Dampak**: Frontend dan backend berjalan pada port berbeda saat pengembangan lokal (perlu penanganan CORS terstandarisasi).
- **Status**: `accepted`

---

### ADR-003: Representasi Uang & Model Integritas Saldo
- **Konteks**: Operasi floating-point pada komputasi finansial rentan menyebabkan kesalahan pembulatan (*rounding errors*). Saldo dompet juga harus tahan terhadap korupsi data.
- **Opsi**:
  1. Floating point (`FLOAT` / `DOUBLE`) di DB dan JS `Number`.
  2. String / desimal bebas.
  3. `BIGINT` integer minor unit (sen/rupiah utuh) dikombinasikan dengan tabel buku besar mutasi ganda (*ledger entries*) + saldo tercatat pada tabel `wallets`.
- **Keputusan**: Nilai uang disimpan sebagai **Integer non-negatif (`BIGINT` di DB / integer Rupiah)**. Saldo dompet menggunakan pendekatan **Hybrid (Snapshot Saldo di tabel `wallets` yang selalu divalidasi dan dicatat mutasi debet/kreditnya di `wallet_entries`)**.
- **Alasan**: Menghindari floating-point bug 100%. Snapshot saldo mempercepat query baca pada dashboard, sementara `wallet_entries` (immutable ledger) memberikan audit trail lengkap untuk rekonsiliasi.
- **Dampak**: Seluruh kalkulasi di backend menggunakan integer; frontend memformat angka ke tampilan Rupiah (`Intl.NumberFormat`) hanya pada lapisan presentasi.
- **Status**: `accepted`

---

### ADR-004: Mekanisme Transfer Saldo Internal (Closed-Loop)
- **Konteks**: Fitur transfer saldo internal antar-pengguna berpotensi mengalami *race condition*, saldo negatif, atau transaksi ganda jika terjadi *network retry*.
- **Opsi**:
  1. Update saldo berurutan tanpa database lock.
  2. Database Transaction dengan isolasi `READ COMMITTED` + baris lock `FOR UPDATE` yang diurutkan berdasarkan ID terkecil + Idempotency Key header.
- **Keputusan**: Menggunakan **PostgreSQL Database Transaction atomik dengan `SELECT ... FOR UPDATE` terurut (Locking by sorted wallet IDs) serta Idempotency Key**.
- **Alasan**: Pengurutan ID saat mengambil lock mencegah terjadinya database deadlock. Penggunaan Idempotency Key mencegah *double transfer* saat pengguna menekan tombol kirim berulang kali.
- **Dampak**: Service transfer wajib menangani rollback transaksi dan memvalidasi kecukupan saldo di dalam blok lock transaksi.
- **Status**: `accepted`

---

### ADR-005: Strategi Autentikasi, Sesi Cookie & RBAC
- **Konteks**: Sistem memerlukan autentikasi stateless yang aman dari serangan XSS dan CSRF serta otorisasi berbasis peran (`user`, `admin`).
- **Opsi**:
  1. Token disimpan seluruhnya di browser `localStorage`.
  2. Session berbasis server (Express Session + Redis).
  3. Hybrid JWT: Short-lived Access Token (15 menit) di memory klien + Refresh Token rotatif (7 hari) dalam HttpOnly Cookie + RBAC middleware.
- **Keputusan**: **Hybrid JWT dengan Refresh Token di HttpOnly & Secure Cookie**.
- **Alasan**: Menghindari pencurian refresh token via JavaScript XSS (karena HttpOnly), meminimalkan beban I/O sesi server, dan memungkinkan pencabutan sesi secara terpusat melalui tabel `refresh_tokens`.
- **Dampak**: Diperlukan mekanisme refresh token rotatif pada klien dan penanganan cookie lintas-origin (CORS `credentials: true`).
- **Status**: `accepted`

---

### ADR-006: Kebijakan Soft Delete pada Entitas Tertentu
- **Konteks**: Persyaratan tugas mewajibkan penerapan soft delete pada minimal $\ge 2$ tabel dengan justifikasi bisnis nyata.
- **Opsi**:
  1. Hard delete di seluruh tabel.
  2. Soft delete di seluruh tabel tanpa pandang bulu.
  3. Soft delete selektif pada tabel dengan nilai histori tinggi: `users`, `categories`, dan `transactions`.
- **Keputusan**: **Menerapkan Soft Delete (`deleted_at TIMESTAMP NULL`) pada tabel `users`, `categories`, dan `transactions`**.
- **Alasan**:
  - `transactions`: Penghapusan transaksi oleh user tidak boleh menghilangkan jejak riwayat audit finansial.
  - `categories`: Menghapus kategori tidak boleh memutus referensi foreign key transaksi masa lalu (*orphan transactions*).
  - `users`: Penonaktifan akun pengguna mempertahankan integritas historis transfer saldo internal.
  - Tabel `wallets`, `transfers`, dan `wallet_entries` tidak menggunakan soft delete karena merupakan rekaman buku besar (*immutable audit ledger*).
- **Dampak**: Query transaksi dan kategori di backend wajib menyertakan filter default `WHERE deleted_at IS NULL`.
- **Status**: `accepted`

---

### ADR-007: Strategi Penyimpanan & Validasi Upload Lampiran
- **Konteks**: Pengguna dapat melampirkan kuitansi/struk transaksi. Penyimpanan harus aman dan tidak membebani deployment lokal.
- **Opsi**:
  1. Penyimpanan langsung di database sebagai byte array (BLOB).
  2. Integrasi AWS S3 / Cloudinary langsung.
  3. Penyimpanan lokal disk (`uploads/attachments/`) dengan abstraksi antarmuka `StorageService`, validasi tipe MIME, dan batas ukuran 2MB.
- **Keputusan**: **Penyimpanan disk lokal terisolasi dengan antarmuka modular `StorageService`**.
- **Alasan**: Memudahkan penilaian tugas secara mandiri tanpa memerlukan akun cloud eksternal atau kredensial pihak ketiga berbayar. Antarmuka modular memungkinkan penggantian ke cloud storage di masa depan tanpa mengubah service transaksi.
- **Dampak**: Folder unggahan disajikan secara statis terproteksi melalui endpoint terotentikasi, nama file diacak dengan UUID.
- **Status**: `accepted`

---

### ADR-008: Standar Format Kontrak REST API & Error Envelope
- **Konteks**: Frontend dan dokumentasi API Swagger membutuhkan struktur data respons yang dapat diprediksi secara seragam.
- **Opsi**:
  1. Mengembalikan payload mentah tanpa pembungkus.
  2. Standar JSend / Envelope JSON seragam untuk sukses dan gagal.
- **Keputusan**: **Envelope format standar**:
  - Sukses: `{ "success": true, "data": ..., "meta": { "pagination": ... } }`
  - Gagal: `{ "success": false, "error": { "code": string, "message": string, "details": any } }`
- **Alasan**: Mempermudah pembuatan interceptor respon pada frontend, penyusunan skema Swagger, dan penanganan error terpusat.
- **Dampak**: Seluruh controller backend wajib mematuhi format envelope ini.
- **Status**: `accepted`

---

### ADR-009: Standarisasi Versi Runtime Node.js (v24 LTS) & pnpm (v10.15.1)
- **Konteks**: Diperlukan konsistensi versi runtime dan package manager di seluruh lingkungan pengembang dan CI.
- **Keputusan**: Menggunakan **Node.js v24.19.0** (didokumentasikan di `.nvmrc` dan `package.json` engines `>=20.0.0`) dan **pnpm 10.15.1** (`packageManager: "pnpm@10.15.1"`).
- **Alasan**: Sesuai dengan lingkungan aktual lokal terpasang; Node v24 memberikan performa V8 mutakhir dan native ESM yang stabil.
- **Status**: `accepted`

---

### ADR-010: Standardisasi Linting & Formatter (ESLint Flat Config + Prettier)
- **Konteks**: Memastikan konsistensi penulisan kode TypeScript di seluruh paket monorepo.
- **Keputusan**: Menggunakan **ESLint v9 Flat Config (`eslint.config.mjs`)** dipadukan dengan `@typescript-eslint` dan **Prettier v3**. Berkas dokumentasi Markdown dikecualikan dari Prettier melalui `.prettierignore` agar tata letak tabel spesifikasi tidak rusak.
- **Alasan**: Flat config adalah standar resmi ESLint modern; Prettier menjamin format whitespace dan semikolon otomatis.
- **Status**: `accepted`

---

### ADR-011: Validasi Lingkungan Fail-Fast dengan Zod di Backend
- **Konteks**: Server backend tidak boleh berjalan dengan konfigurasi environment yang hilang atau tidak valid untuk mencegah error runtime tersembunyi.
- **Keputusan**: Memvalidasi seluruh `process.env` menggunakan skema **Zod** saat proses booting di `apps/api/src/config/env.ts`.
- **Alasan**: Gagal-cepat (*fail-fast*) dengan pesan kesalahan terstruktur memudahkan debugging dan mencegah kebocoran koneksi salah.
- **Status**: `accepted`

---

### ADR-012: Dev Server Proxy Frontend ke Backend API (Vite Proxy)
- **Konteks**: Saat development lokal, frontend (port 5173) dan backend (port 5000) berjalan pada origin terpisah.
- **Keputusan**: Mengonfigurasi **dev proxy di `apps/web/vite.config.ts`** yang memetakan prefix `/api` ke target backend (`http://localhost:5000`).
- **Alasan**: Meniadakan kerumitan CORS pada permintaan API lokal dan menyelaraskan path rute antara lokal dan produksi.
- **Status**: `accepted`

---

### ADR-013: Pinning Versi Image PostgreSQL (postgres:16.8-alpine)
- **Konteks**: Database development lokal memerlukan image yang konsisten dan ringan.
- **Keputusan**: Mem-pin image Docker PostgreSQL ke versi spesifik **`postgres:16.8-alpine`** di `infrastructure/docker-compose.yml`.
- **Alasan**: Menghindari anomali *breaking changes* akibat update otomatis tag `latest` dan memanfaatkan footprint minimal dari distro Alpine.
- **Status**: `accepted`

---

### ADR-014: Pemilihan Development Runner (tsx) dan Test Runner (Vitest)
- **Konteks**: Diperlukan alat eksekusi live watch backend yang cepat dan test runner yang terintegrasi mulus dengan Vite/ESM.
- **Keputusan**: Menggunakan **`tsx watch`** untuk server dev backend dan **Vitest** untuk pengujian unit/integrasi di frontend dan backend.
- **Alasan**: `tsx` mendukung native TypeScript ESM tanpa perlu build terpisah; Vitest berbagi pipeline transformasi yang sama dengan Vite sehingga pengujian berjalan sangat cepat.
- **Status**: `accepted`

---

### ADR-015: Pemilihan Tool Migration Database (Native SQL Migrator berbasis pg)
- **Konteks**: Diperlukan migration engine yang memberikan kontrol penuh atas fitur lanjutan PostgreSQL (CHECK constraint, partial unique index, trigger function, table locks) tanpa menyembunyikan constraint di balik abstraksi ORM.
- **Opsi**:
  1. *Prisma / TypeORM / Drizzle*: Abstraksi ORM tingkat tinggi sering mengaburkan atau membatasi partial indexes `WHERE deleted_at IS NULL`, trigger append-only, dan enum kustom.
  2. *Knex*: Query builder dengan CLI migrasi, namun menambahkan ketergantungan abstraksi SQL tambahan.
  3. *Native SQL Migrator dengan `pg`*: Runner TypeScript mandiri yang mengeksekusi pasangan berkas `.up.sql` dan `.down.sql` mentah dalam transaksi atomik dengan PostgreSQL advisory locking (`pg_advisory_lock`).
- **Keputusan**: Mengadopsi **Native SQL Migrator berbasis `pg`** di `apps/api/src/database/migrator.ts`.
- **Alasan**: Memberikan kejelasan 100% atas SQL murni, mendukung isolasi transaksi per berkas migrasi, mencegah race condition konkuren via advisory locking, dan tidak membatasi kemampuan database.
- **Status**: `accepted`

---

### ADR-016: Standarisasi Primary Key UUIDv4 (gen_random_uuid)
- **Konteks**: Seluruh entitas tabel relasional memerlukan tipe identifier yang aman dari enumeration attack dan cocok untuk transaksi finansial terdistribusi.
- **Opsi**:
  1. Integer auto-increment (`SERIAL` / `BIGSERIAL`).
  2. UUID v4 via fungsi native PostgreSQL `gen_random_uuid()`.
- **Keputusan**: Menggunakan **`UUID PRIMARY KEY DEFAULT gen_random_uuid()`** pada seluruh 13 tabel aplikasi.
- **Alasan**: Mencegah kebocoran jumlah pengguna/transaksi ke pihak luar (IDOR / enumeration safety) dan mempermudah sinkronisasi data tanpa konflik collision sequence.
- **Status**: `accepted`

---

### ADR-017: Mekanisme Otomatisasi updated_at via PostgreSQL Trigger Function
- **Konteks**: Kolom audit `updated_at` harus selalu mencerminkan waktu modifikasi data aktual secara konsisten, bahkan jika update dilakukan lewat script maintenance, psql, atau query raw.
- **Opsi**:
  1. Dikelola manual oleh layer aplikasi backend (`updated_at = new Date()`).
  2. Ditegakkan di level database melalui trigger function `set_updated_at_timestamp()`.
- **Keputusan**: **Database Trigger Function `set_updated_at_timestamp()`** yang dipasang pada tabel `users`, `wallets`, `categories`, `budgets`, dan `transactions`.
- **Alasan**: Menjamin integritas timestamp tidak pernah terlewat atau dimanipulasi oleh kelalaian kode aplikasi.
- **Status**: `accepted`

---

### ADR-018: Penegakan Append-Only Immutability pada Buku Besar (wallet_entries)
- **Konteks**: Tabel `wallet_entries` bertindak sebagai audit ledger mutasi saldo. Setiap mutasi yang sudah tercatat dilarang diubah atau dihapus untuk mencegah manipulasi historis.
- **Keputusan**: Memasang **trigger penolak mutasi `prevent_wallet_entries_mutation()`** (`BEFORE UPDATE OR DELETE ON wallet_entries`) yang melempar exception fatal jika terjadi percobaan `UPDATE` atau `DELETE`.
- **Alasan**: Memberikan jaminan integritas tingkat basis data (*database-level tamper resistance*) yang dibuktikan melalui pengujian otomatis.
- **Status**: `accepted`

---

### ADR-019: Strategi Soft Delete & Partial Unique Indexes (Case-Insensitive)
- **Konteks**: Entitas ber-soft-delete (`users`, `categories`) memiliki batasan unique (email, username, category name) yang berpotensi memblokir pendaftaran ulang jika menggunakan standard unique constraint.
- **Keputusan**: Menggunakan **Partial Unique Indexes dengan normalisasi `LOWER()`**:
  - `idx_users_email_active UNIQUE (LOWER(email)) WHERE deleted_at IS NULL`
  - `idx_users_username_active UNIQUE (LOWER(username)) WHERE deleted_at IS NULL`
  - `idx_categories_user_name_type_active UNIQUE (user_id, LOWER(name), type) WHERE deleted_at IS NULL AND user_id IS NOT NULL`
  - `idx_categories_system_name_type_active UNIQUE (LOWER(name), type) WHERE deleted_at IS NULL AND user_id IS NULL`
- **Alasan**: Memastikan email/username/kategori bersifat case-insensitive, mencegah tabrakan data aktif, dan mengizinkan penggunaan ulang identifier setelah baris lama di-soft delete.
- **Status**: `accepted`

---

### ADR-020: Kebijakan Integritas Referensial Foreign Key (CASCADE vs RESTRICT)
- **Konteks**: Menentukan kebijakan penghapusan relasional secara sengaja untuk mencegah ketergantungan orphan dan melindungi riwayat finansial.
- **Keputusan**:
  - `ON DELETE CASCADE`: Digunakan untuk relasi kepemilikan ketat privat (`wallets.user_id`, `attachments.transaction_id`, `transaction_tags.*`, `refresh_tokens.user_id`, `notifications.user_id`).
  - `ON DELETE RESTRICT`: Digunakan untuk relasi finansial kritis (`transactions.category_id`, `budgets.category_id`, `transfers.source_wallet_id`, `transfers.target_wallet_id`) untuk mencegah penghapusan kategori/wallet yang memiliki riwayat audit aktif.
  - `ON DELETE SET NULL`: Digunakan pada `activity_logs.user_id` agar jejak audit sistem tetap ada meskipun entitas user terkait dihapus.
- **Status**: `accepted`

---

### ADR-021: Strategi Database Seeder Deterministik & Rekonsiliasi Saldo
- **Konteks**: Pengujian dan demonstrasi memerlukan data awal $\ge 20$ baris per tabel dengan relasi yang saling berkorelasi secara matematis.
- **Keputusan**: Menggunakan **seeder deterministik** (`apps/api/src/database/seeder.ts`) yang menjamin:
  1. Saldo dompet `wallets.balance` selalu sama persis dengan selisih `SUM(credit) - SUM(debit)` pada `wallet_entries`.
  2. Setiap transfer internal berstatus `completed` memiliki sepasang entri buku besar (debit di pengirim dan kredit di penerima) dengan nominal identik.
  3. Kredensial akun development di-hash menggunakan bcrypt cost factor 12 (Admin: `admin@walletapp.local` / `Admin123!`, Regular Users: `user01`..`user19` / `User123!`).
- **Status**: `accepted`

---

### ADR-022: Isolasi Database Pengujian & Multi-Layer Safety Guard
- **Konteks**: Eksekusi pengujian otomatis dan skrip destruktif (`db:reset`, seeder) tidak boleh mencemari atau menghapus database development atau database produksi.
- **Keputusan**:
  1. Skrip pengujian Vitest hanya berjalan terhadap `TEST_DATABASE_URL` (nama `wallet_test`) dan menolak berjalan jika database pengujian sama dengan database dev (`wallet_app_db`).
  2. Guard `assertEnvironmentSafety()` menolak eksekusi jika `NODE_ENV === 'production'` atau host bukan lokal (`localhost`, `127.0.0.1`, `postgres`).
- **Status**: `accepted`

---

### ADR-023: Resolusi Keputusan Terbuka [OPEN] (OPEN-PB-01, OPEN-PB-02, OPEN-SEC-01)
- **Konteks**: Dokumen Phase 0 memuat 3 item `[OPEN]` dengan rekomendasi yang perlu disahkan pada Phase 2.
- **Keputusan**:
  1. **OPEN-PB-01**: Status akun registrasi awal langsung aktif (`is_active = true`, `is_verified = true`) untuk mempermudah penilaian tugas, dengan kolom skema siap untuk ekspansi OTP. Status: `accepted`.
  2. **OPEN-PB-02**: Batas maksimum ukuran file lampiran bukti transaksi dibatasi 2MB (`file_size <= 2097152`) dengan whitelist MIME (`image/jpeg`, `image/png`, `application/pdf`). Status: `accepted`.
  3. **OPEN-SEC-01**: Mitigasi mutasi saldo kritis menggunakan validasi origin CORS dan keharusan header `Idempotency-Key` (tanpa beban CSRF double cookie ganda). Status: `accepted`.
- **Status**: `accepted`

---

### ADR-024: Pemilihan Structured Logger (Pino) dan Strategi Redaksi Sensitif
- **Konteks**: Aplikasi memerlukan sistem logging terstruktur yang cepat, hemat overhead, dan memiliki jaminan tidak membocorkan kredensial, token, atau rahasia.
- **Opsi**:
  1. Winston (fitur lengkap, overhead lebih tinggi, konfigurasi serializer manual).
  2. Pino (berperforma tinggi, native JSON output, built-in deep-path redaction).
- **Keputusan**: Menggunakan **Pino** (`pino` + dev `pino-pretty`).
- **Alasan**: Pino memiliki performa asinkron tercepat di ekosistem Node.js dan menyediakan fitur `redact.paths` yang secara otomatis menyensor properti sensitif (`authorization`, `cookie`, `set-cookie`, `password`, `token`, `refreshToken`, `accessToken`, `secret`) di seluruh level hierarki objek log.
- **Status**: `accepted`

---

### ADR-025: Strategi Penanganan Unknown Fields pada Validasi Zod (Strip vs Strict)
- **Konteks**: Request body yang dikirim oleh klien dapat memuat properti tambahan yang tidak terdaftar pada skema DTO.
- **Keputusan**: Menggunakan perilaku **`strip` secara default** pada middleware validasi (`apps/api/src/middlewares/validator.middleware.ts`), dengan keleluasaan skema individu menerapkan `.strict()` jika diperlukan.
- **Alasan**: Mencegah *breaking change* pada penambahan field forward-compatible dan secara aman membuang properti berlebih sebelum mencapai Service layer, mencegah *mass-assignment vulnerability*.
- **Status**: `accepted`

---

### ADR-026: Urutan Pipeline Middleware Express & Keamanan Standar
- **Konteks**: Request pipeline harus tersusun secara sengaja agar setiap lapisan keamanan dan observabilitas berjalan pada urutan optimal.
- **Keputusan**: Urutan sekuensial:
  1. `requestIdMiddleware` $\rightarrow$ 2. `helmet` + `trust proxy` $\rightarrow$ 3. `createCorsMiddleware` $\rightarrow$ 4. `globalRateLimiter` $\rightarrow$ 5. `express.json` + `urlencoded` $\rightarrow$ 6. `requestLoggingMiddleware` $\rightarrow$ 7. Health routes (`/health`, `/health/ready`) $\rightarrow$ 8. `/api/v1` router $\rightarrow$ 9. `notFoundHandler` $\rightarrow$ 10. `globalErrorHandler`.
- **Alasan**: Request ID diinisialisasi pertama agar tersedia di header Helmet, CORS, logging, dan error response. Health route diletakkan sebelum parser dan 404 agar liveness check secepat mungkin.
- **Status**: `accepted`

---

### ADR-027: Strategi Rate Limiting In-Memory dan Factory Rute Autentikasi
- **Konteks**: Mencegah serangan brute-force dan DoS pada seluruh endpoint dan menyiapkan proteksi khusus endpoint auth di Phase 4.
- **Keputusan**: Menggunakan **`express-rate-limit`** dengan:
  1. `globalRateLimiter`: 100 request per 15 menit per IP (default env).
  2. Factory `createRateLimiter(options)`: Factory fungsi yang dapat dikonfigurasi untuk dipasang pada rute auth (Phase 4).
  3. Response format: HTTP 429 berformat standar envelope dengan header `Retry-After`.
- **Status**: `accepted`

---

### ADR-028: Abstraksi dan Translasi Kode Error PostgreSQL (Zero Information Leakage)
- **Konteks**: Kesalahan basis data (pelanggaran unik, FK, check constraint) tidak boleh membocorkan nama tabel internal, nama constraint, atau query SQL mentah ke klien di lingkungan mana pun.
- **Keputusan**: Menerapkan pemetaan SQLSTATE di `mapPostgresError`:
  - `23505` (unique) $\rightarrow$ 409 `DUPLICATE_ENTRY`.
  - `23503` (foreign key) $\rightarrow$ 422 `FOREIGN_KEY_VIOLATION`.
  - `23514` (check constraint) $\rightarrow$ 422 `CHECK_CONSTRAINT_VIOLATION`.
  - `23502` (not null) $\rightarrow$ 400 `BAD_REQUEST`.
  - `22P02` (invalid representation) $\rightarrow$ 400 `INVALID_PARAMETER`.
  - `40001`/`40P01` (deadlock/serialization) $\rightarrow$ 409 `TRANSACTION_CONCURRENCY_ERROR`.
  - `57014` (query timeout) $\rightarrow$ 504 `QUERY_TIMEOUT`.
- **Alasan**: Menghilangkan risiko reconnaissance attack dan menjaga kepatuhan OWASP ASVS.
- **Status**: `accepted`

---

### ADR-029: Helper Transaksi Atomik Database (`withTransaction`) & Penolakan Base Repository CRUD
- **Konteks**: Operasi transfer saldo dan mutasi ledger memerlukan transaksi atomik dengan dukungan isolasi dan perlindungan terhadap nested transaction.
- **Keputusan**:
  1. Menggunakan helper fungsional **`withTransaction<T>(fn, options)`** dengan pengelolaan otomatis `BEGIN`, `COMMIT`, `ROLLBACK`, dan `release()`.
  2. Mendukung opsi `isolationLevel` (`READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`) dan bounded retry untuk `40001`/`40P01`.
  3. Menolak tegas nested transactions pada client yang sama dengan exception `NESTED_TRANSACTION_NOT_SUPPORTED`.
  4. **Dilarang membuat Base Repository CRUD generik**: Repositori setiap modul akan ditulis secara mandiri di fase mendatang untuk menjaga kejelasan locking (`FOR UPDATE`) dan batas transaksi finansial.
- **Status**: `accepted`

---

---

### ADR-031: Algoritma Hashing Kredensial (Argon2id) & Migrasi Transparan Otomatis (Bcrypt Auto-Rehash)
- **Konteks**: Diperlukan algoritma hashing kata sandi tahan serangan GPU/ASIC untuk seluruh pengguna baru dan mekanisme migrasi aman untuk seeder awal yang menggunakan bcrypt.
- **Keputusan**:
  1. Menggunakan **Argon2id** (native `argon2`) sebagai algoritma standar dengan parameter aman OWASP (memoryCost: 65,536 KB, timeCost: 3, parallelism: 4).
  2. Menerapkan verifikasi password adaptif: mendeteksi awalan hash (`$argon2id$` vs `$2a$` / `$2b$`). Jika terdeteksi hash bcrypt, server memverifikasi password dengan `bcryptjs`, lalu secara otomatis meng-hash ulang menggunakan Argon2id dan memperbarui database saat login sukses tanpa memerlukan tindakan manual dari pengguna.
- **Status**: `accepted`

---

### ADR-032: Arsitektur Sesi Hybrid (JWT Short-Lived + Opaque Refresh Token Berbasis SHA-256 Hash)
- **Konteks**: Keseimbangan antara skalabilitas otentikasi tanpa database query berat dan kemampuan pembatalan sesi instan (*session revocation*).
- **Keputusan**:
  1. **Access Token**: JWT berumur pendek (15 menit), ditandatangani algoritma `HS256`, disimpan di memori klien (React memory).
  2. **Refresh Token**: Opaque token acak berentropi tinggi 256-bit (`crypto.randomBytes(32)`), dikirimkan via HTTP-only Cookie (`SameSite=Lax`, `Path=/api/v1/auth`, `Secure` in production).
  3. **Penyimpanan Database**: Token mentah **TIDAK PERNAH** disimpan di basis data. Kolom `refresh_tokens.token_hash` hanya menyimpan nilai hash **SHA-256** (tepat 64 karakter heksadesimal).
- **Status**: `accepted`

---

### ADR-033: Mekanisme Rotasi Token Atomik & Deteksi Pencurian Sesi (Family Invalidation with Row-Level Locking)
- **Konteks**: Mencegah pencurian refresh token dan race condition pada request konkurensi tinggi.
- **Keputusan**:
  1. Rotasi token dieksekusi dalam database transaction dengan row-level lock (`SELECT ... FOR UPDATE`) pada `refresh_tokens`.
  2. Seluruh token dalam rantai rotasi sesi yang sama diikat oleh `family_id` (UUID).
  3. Jika refresh token yang telah dibatalkan (`is_revoked = true`) dikirim kembali (*token reuse*), transaksi secara atomik membatalkan **SELURUH** sesi dalam `family_id` tersebut (`UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1`), mencatat audit log, dan mengembalikan HTTP 401 `UNAUTHORIZED`.
- **Status**: `accepted`

---

### ADR-034: Mitigasi Enumerasi Akun & Serangan Waktu (Constant-Time Dummy Hash Verification)
- **Konteks**: Penyerang dapat mengetahui apakah suatu email terdaftar atau tidak dengan mengukur perbedaan waktu eksekusi CPU (*timing attack*) pada endpoint login.
- **Keputusan**:
  1. Pada endpoint `POST /api/v1/auth/login`, jika email tidak ditemukan di database, server mengeksekusi *dummy Argon2id hash verification* terhadap hash tiruan yang valid untuk menyamakan profil waktu CPU.
  2. Pesan kegagalan login selalu identik: `"Email atau kata sandi tidak valid"` (HTTP 401).
  3. Endpoint `POST /api/v1/auth/forgot-password` selalu mengembalikan respons konstan HTTP 200 OK dengan pesan netral terlepas dari apakah email terdaftar atau tidak.
- **Status**: `accepted`

---

### ADR-035: Structural Route Policy Guard & Verifikasi Status Real-time Pengguna di Database
- **Konteks**: Mencegah endpoint baru tertinggal tanpa perlindungan otentikasi serta mencegah pengguna yang telah diblokir/dihapus tetap bisa mengakses API selama sisa masa berlaku JWT (15 menit).
- **Keputusan**:
  1. Middleware `authenticate` selalu memvalidasi status pengguna di database (`is_active = true` dan `deleted_at IS NULL`) pada setiap request terotentikasi. Akun yang dinonaktifkan langsung diblokir seketika.
  2. Menerapkan `routePolicyGuard` dengan `ROUTE_POLICY_REGISTRY` deklaratif. Tes otomatis memindai seluruh router Express dan menggagalkan build jika terdapat rute yang tidak memiliki deklarasi kebijakan otentikasi eksplisit.
- **Status**: `accepted`

---

### ADR-036: Alur Pemulihan Kata Sandi Aman & Proteksi Terhadap Host Header Poisoning
- **Konteks**: Pembuatan tautan reset kata sandi rawan serangan *Host Header Poisoning* jika server mengambil domain dari header HTTP request klien.
- **Keputusan**:
  1. Tautan pemulihan kata sandi dibangun strictly menggunakan konfigurasi server `APP_BASE_URL` dari environment variable. Penggunaan header `Host` atau `X-Forwarded-Host` dari klien dilarang keras.
  2. Token reset berupa string acak kriptografis 256-bit berumur 15 menit, disimpan sebagai hash SHA-256 pada tabel `password_resets`, dan hanya dapat digunakan satu kali (`is_used = true`).
  3. Setelah reset berhasil, seluruh refresh token pengguna aktif dibatalkan seketika (`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`).
- **Status**: `accepted`

---

### ADR-037: Manajemen Outbox Email Lokal pada Lingkungan Non-Produksi & Guard SMTP Produksi
- **Konteks**: Mengirim email reset kata sandi di lingkungan pengujian/pengembangan tanpa dependensi akun SMTP eksternal.
- **Keputusan**:
  1. Pada lingkungan non-produksi (`NODE_ENV !== 'production'`), email ditulis ke berkas JSON di direktori lokal `apps/api/.outbox/` (terdaftar di `.gitignore`).
  2. Pada lingkungan produksi, konfigurasi `env.ts` menolak nilai `MAIL_TRANSPORT=outbox` saat startup (*fail-fast*) dan mewajibkan konfigurasi SMTP terenkripsi yang valid.
- **Status**: `accepted`

---

### ADR-038: Batas yang Diketahui pada Stateless Access Token setelah Logout & Opsi Session Binding
- **Konteks**: Access token JWT berumur 15 menit (900 detik) beroperasi secara stateless. Saat pengguna melakukan `POST /auth/logout` atau `POST /auth/logout-all`, refresh token di database dibatalkan, namun access token yang sudah diterbitkan tetap valid secara kriptografis dan lolos verifikasi `authenticate` sampai masa kedaluwarsa (`exp`) tercapai, selama akun pengguna berstatus aktif di database.
- **Keputusan**:
  1. Batasan ini dicatat secara sadar sebagai *known limitation* dari arsitektur short-lived stateless JWT untuk menjaga skalabilitas I/O backend.
  2. Middleware `authenticate` menjamin pencabutan segera (*instant revocation*) untuk kasus akun dinonaktifkan (`is_active = false`) atau dihapus (`deleted_at IS NOT NULL`).
  3. Mengusulkan 3 opsi arsitektural untuk mengikat token ke sesi di masa mendatang (Phase 12 / evaluasi production, tidak diimplementasikan saat ini):
     - *Opsi A (Session ID Binding)*: Menyematkan `session_id` pada payload JWT dan memverifikasi baris sesi di database pada setiap request.
     - *Opsi B (User Token Versioning)*: Menambahkan kolom `token_version` pada tabel `users` yang dinaikkan saat logout-all atau ubah password.
     - *Opsi C (Distributed Redis Blacklist)*: Menyimpan klaim `jti` token yang dicabut ke cache Redis dengan TTL sesuai sisa `exp`.
- **Status**: `accepted`

---

### ADR-039: Daftar Keputusan Terbuka Arsitektur Keamanan untuk Phase 12 (OPEN-SEC-02 s/d OPEN-SEC-05)
- **Konteks**: Menginventarisasi pertimbangan arsitektur keamanan, operasional, dan performa yang memerlukan keputusan final pada Phase 12 (Hardening & Audit).
- **Keputusan**: Mencatat 4 item keputusan terbuka:
  1. **OPEN-SEC-02**: Evaluasi atribut cookie `SameSite='Lax'` vs `SameSite='None'` + `Secure=true` apabila frontend web dan backend API di-deploy pada root domain yang berbeda lintas situs.
  2. **OPEN-SEC-03**: Penyesuaian/tuning parameter memori Argon2id (saat ini 64 MB OWASP) terhadap beban memori konkuren server hosting berspesifikasi terbatas.
  3. **OPEN-SEC-04**: Pemilihan mekanisme penjadwalan otomasi berkala untuk skrip CLI pembersihan token `pnpm db:cleanup-tokens` (OS Cron, Kubernetes CronJob, atau task worker).
  4. **OPEN-SEC-05**: Penegasan status mitigasi *timing attack* pada endpoint login (dummy hash verification) sebagai upaya pertahanan praktis *best-effort* dalam lingkungan managed Node.js/V8 runtime.
- **Status**: `proposed`

---

### ADR-040: Harmonisasi Metode HTTP Endpoint Penggantian Kata Sandi (PUT /auth/change-password)
- **Konteks**: Terdapat diskrepansi antara dokumentasi `API_CONTRACT.md` (yang sebelumnya mencantumkan `POST /auth/change-password` dan baris redundant `PUT /users/change-password`) dengan implementasi kode di `apps/api/src/modules/auth/auth.router.ts` dan test suite `password-management.test.ts`.
- **Keputusan**:
  1. Menetapkan secara tunggal dan definitif metode HTTP untuk penggantian kata sandi adalah **`PUT /api/v1/auth/change-password`**.
  2. Menghapus rute fiktif/duplikat `PUT /users/change-password` dari kontrak API.
  3. Memastikan `ROUTE_POLICY_REGISTRY` dan seluruh referensi kontrak tersinkronisasi 100%.
- **Alasan**: Semantik RESTful untuk penggantian/pembaruan atribut kata sandi secara penuh pada akun pengguna terautentikasi adalah idempotent replacement (`PUT`), dan modul auth mengelompokkan fungsionalitas manajemen kredensial di bawah namespace `/auth`.
- **Status**: `accepted`

---

### ADR-041: Session Binding Access Token ke Refresh Session Family untuk Pencabutan Seketika (Immediate Revocation)
- **Konteks**: Access token JWT 15 menit sebelumnya beroperasi murni stateless di tingkat token individu (hanya memverifikasi status keaktifan user). Akibatnya, token yang sudah diterbitkan tetap dapat digunakan selama sisa masa berlaku hingga 15 menit pasca `logout`, `logout-all`, `change-password`, atau `reset-password`. Diperlukan solusi pencabutan instan (*immediate revocation*) yang tetap mempertahankan performa tinggi tanpa dependensi eksternal (Redis).
- **Keputusan**:
  1. Menyematkan klaim sesi `sid` pada payload JWT access token yang berisi `family_id` dari rantai rotasi refresh token aktif.
  2. Middleware `authenticate` memverifikasi keaktifan sesi via subquery `EXISTS (SELECT 1 FROM refresh_tokens rt WHERE rt.family_id = $2 AND rt.user_id = u.id AND rt.is_revoked = false AND rt.expires_at > NOW())` yang digabungkan secara atomik dalam satu round-trip query ke tabel `users`.
  3. Membuat migration `010_add_session_binding_index` yang menambahkan partial composite index `CREATE INDEX idx_refresh_tokens_family_user_active ON refresh_tokens (family_id, user_id) WHERE is_revoked = false;`.
  4. Token ditolak seketika (HTTP 401 UNAUTHORIZED) apabila:
     - Sesi dicabut melalui `logout` (keluarga refresh token dibatalkan).
     - Seluruh sesi dicabut melalui `logout-all`, `change-password`, atau `reset-password`.
     - Token reuse detection membatalkan seluruh keluarga sesi.
     - Token tidak memuat klaim `sid` atau nilai `sid` tidak valid/tidak ada di database.
  5. Sesi login dari perangkat lain milik pengguna yang sama (dengan `family_id` berbeda) tetap terlindungi dan valid saat logout biasa dilakukan pada salah satu perangkat.
- **Dampak Performa**:
  - Penambahan pengecekan ini tidak menambah round-trip jaringan database (0 additional round-trips) karena dieksekusi dalam query `SELECT ... FROM users` yang sudah ada di pipeline `authenticate`.
  - Subquery memanfaatkan partial index `idx_refresh_tokens_family_user_active`, menghasilkan waktu eksekusi sub-milidetik ($< 0.1\text{ms}$) bertipe Index Only Scan pada PostgreSQL.
- **Status**: `accepted`

---

### ADR-042: Pembuatan Dompet Default secara Atomik Saat Registrasi Pengguna (D1)
- **Konteks**: Setiap pengguna baru wajib memiliki akun dompet utama (`wallets`) untuk dapat melakukan transaksi dan menerima transfer dana, tanpa memerlukan langkah inisialisasi terpisah.
- **Keputusan**: Registrasi pengguna di `auth.service.ts` membungkus pembuatan user dan dompet default (`Dompet Utama`, mata uang `IDR`, saldo awal 0) di dalam blok transaksi atomik yang sama (`withTransaction`).
- **Alasan**: Mencegah kondisi pengguna yatim (*orphan user*) yang terdaftar di basis data namun tidak memiliki dompet aktif akibat kegagalan parsial jaringan atau database.
- **Status**: `accepted`

---

### ADR-043: Pencegahan Deadlock Konkuren Menggunakan Deterministic Ascending UUID Locking (D2)
- **Konteks**: Transfer saldo simultan dua arah antara Pengguna A dan Pengguna B (A $\rightarrow$ B dan B $\rightarrow$ A) pada millisecond yang sama dapat memicu deadlock basis data (`40P01`) jika row-level lock diperoleh dalam urutan acak (*circular wait*).
- **Keputusan**: Transaksi transfer selalu mengurutkan UUID dompet pengirim dan penerima secara leksikografis menaik (`ORDER BY id ASC FOR UPDATE`) sebelum melakukan verifikasi saldo dan mutasi ledger.
- **Alasan**: Secara matematis mengeliminasi siklus ketergantungan sumber daya (syarat Coffman untuk deadlock). Terbukti lewat pengujian konkuren 100% bebas deadlock tanpa retry.
- **Status**: `accepted`

---

### ADR-044: Strategi Idempotensi Terdedikasi dengan Hashing Payload Kanonikal SHA-256 (D3)
- **Konteks**: Pengguna dengan jaringan lambat berpotensi mengirim request transfer berulang kali dengan key yang sama. Backend harus membedakan antara percobaan replay yang sah dengan tabrakan key pada muatan request berbeda.
- **Keputusan**:
  1. Membuat tabel terdedikasi `idempotency_records` dengan `UNIQUE (user_id, idempotency_key)`.
  2. Menghitung ringkasan SHA-256 dari representasi JSON kanonikal (*canonical stringify*) dari body request.
  3. Menyimpan status HTTP dan body respons secara atomik di dalam transaksi transfer.
  4. Request replay dengan key dan payload identik mengembalikan respons cache instan tanpa eksekusi mutasi saldo ulang. Replay dengan key sama namun isi berbeda ditolak dengan `409 IDEMPOTENCY_CONFLICT`.
- **Status**: `accepted`

---

### ADR-045: Mekanisme Pembatalan Transaksi (Void) Melalui Kompensasi Ledger Berpasangan (D4)
- **Konteks**: Kesalahan pencatatan transaksi pengeluaran atau pemasukan tidak boleh dihapus secara destruktif (*hard delete*) dari buku besar untuk menjaga integritas audit finansial historis.
- **Keputusan**:
  1. Endpoint `POST /transactions/:id/void` mengubah status transaksi menjadi `VOIDED` dalam transaksi database atomik.
  2. Menuliskan entri pembalik kompensasi (*compensating ledger entry*) pada `wallet_entries` dengan `reference_type = 'transaction_void'` (kredit pembalik untuk transaksi pengeluaran, debit pembalik untuk transaksi pemasukan).
  3. Memulihkan saldo `wallets.balance` secara presisi di bawah baris row lock.
- **Status**: `accepted`

---

### ADR-046: Isolasi Mutasi Saldo Struktural Tunggal pada WalletsRepository (D5)
- **Konteks**: Mencegah kebocoran logika mutasi saldo (*balance leak*) dan inkonsistensi antara snapshot saldo `wallets.balance` dengan catatan pembukuan `wallet_entries`.
- **Keputusan**: Mutasi kolom `wallets.balance` secara struktural HANYA boleh dieksekusi melalui metode privat/terkelola di `WalletsRepository` (`executeBalanceMutation`) yang otomatis menulis entri ledger berpasangan dalam transaksi database atomik.
- **Alasan**: Menghilangkan kemungkinan modifikasi saldo ad-hoc oleh controller atau service lain tanpa pencatatan buku besar. Ditegakkan melalui static code analysis test `structural-ledger-guard.test.ts`.
- **Status**: `accepted`

---

### ADR-047: Operasi Aritmatika Finansial Aman Berbasis BigInt Murni (D6)
- **Konteks**: Operasi floating-point pada JavaScript (`Number`) rentan menghasilkan artefak desimal pembulatan biner (seperti `0.1 + 0.2 !== 0.3`) dan overflow di atas `Number.MAX_SAFE_INTEGER`.
- **Keputusan**: Seluruh kalkulasi penambahan dan pengurangan uang dikemas dalam fungsi utilitas `safeAddMoney` dan `safeSubtractMoney` di `packages/shared/src/finance.ts` menggunakan tipe native `BigInt` dan divalidasi tidak negatif.
- **Alasan**: Menjamin akurasi 100% pada bilangan bulat Rupiah tanpa pembulatan desimal tak terduga.
- **Status**: `accepted`

---

### ADR-048: Immutability Atribut Finansial Transaksi
- **Konteks**: Perubahan atribut finansial transaksi lampau (`amount`, `type`, `wallet_id`) secara langsung pada record transaksi akan merusak konsistensi terhadap ledger entries yang telah tercatat sebelumnya.
- **Keputusan**: Pada endpoint `PUT /transactions/:id`, atribut finansial dilarang dimodifikasi. Hanya atribut non-finansial (`description`/`notes` dan `category_id`) yang dapat diperbarui. Jika pengguna melakukan kesalahan nominal atau jenis transaksi, alur resmi yang wajib digunakan adalah melakukan *void* dan mencatat transaksi baru.
- **Status**: `accepted`

---

### ADR-049: Scoped Idempotency Constraint pada Transaksi Transfer (Source Wallet Scoping)
- **Konteks**: Pada skema awal, tabel `transfers` memiliki constraint global `UNIQUE(idempotency_key)`. Hal ini menyebabkan potensi penolakan transaksi (*cross-tenant denial*) jika dua pengguna berbeda secara kebetulan atau sengaja menghasilkan string idempotency key yang sama.
- **Keputusan**: Mengubah constraint pada tabel `transfers` menjadi compound unique `CONSTRAINT uq_transfers_source_idempotency_key UNIQUE (source_wallet_id, idempotency_key)`, dan tabel `idempotency_records` menggunakan `CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, idempotency_key)`.
- **Alasan**: Menjamin isolasi idempotensi antar-pengguna sehingga key seorang pengguna tidak akan menginterferensi transaksi pengguna lainnya.
- **Status**: `accepted`

---

### ADR-050: Kebijakan Caching Idempotensi pada Request Gagal, Penegakan Atomisitas Transaksional, dan Siklus Hidup Kedaluwarsa Kunci (24 Jam)
- **Konteks**: Diperlukan kejelasan arsitektural mengenai perilaku idempotensi ketika request transfer gagal, jaminan atomisitas antara pencatatan rekam idempotensi dengan mutasi saldo, serta retensi penyimpanan kunci idempotensi.
- **Keputusan**:
  1. **Request Gagal TIDAK Di-cache**: Request transfer yang gagal validasi bisnis (seperti saldo tidak cukup / `INSUFFICIENT_BALANCE` atau dompet target tidak valid) tidak menyimpan record status `COMPLETED` maupun `FAILED` di database karena seluruh operasi berjalan di dalam database transaction atomik (`withTransaction`). Saat error dilempar, PostgreSQL melakukan `ROLLBACK`, sehingga baris `idempotency_records` ikut terhapus. Hal ini memungkinkan pengguna melakukan topup lalu mengirim ulang transfer dengan key yang persis sama tanpa tertolak.
  2. **Penulisan Idempotency Record 100% Atomik**: Penulisan dan finalisasi `idempotency_records` (status `COMPLETED`, response body, dan HTTP code) terjadi di dalam koneksi transaksi basis data yang sama dengan mutasi `wallets`, entri `transfers`, dan pembukuan ganda `wallet_entries`. Jika salah satu gagal, seluruh rangkaian transaksi dibatalkan bersama-sama (dibuktikan via test otomatis `transfers-idempotency.test.ts`).
  3. **Kebijakan Kedaluwarsa Kunci (24 Jam TTL)**: Setiap record idempotensi memiliki timestamp kedaluwarsa default 24 jam (`expires_at = NOW() + INTERVAL '24 hours'`). Kolom ini dilengkapi index terdedikasi `idx_idempotency_expires_at` untuk pembersihan berkala melalui scheduled maintenance task tanpa mengganggu performa query operasional.
- **Bukti Pengujian**: `tests/finance/transfers-idempotency.test.ts` (test case `failed transfer requests are not cached in idempotency_records...` dan `idempotency_records and transfer financial effects are strictly written and committed atomically...`).
- **Status**: `accepted`

---

### ADR-051: Simulasi Masuknya Saldo Ekosistem Tertutup, Gating Environment Top-up, dan Pagu Transaksional
- **Konteks**: Berdasarkan batasan arsitektur tertutup (*closed-loop wallet* tanpa payment gateway pihak ketiga), saldo pengguna tidak dapat masuk dari sistem eksternal secara otomatis. Untuk memfasilitasi pengujian, demonstrasi alur finansial, dan pencatatan arus kas masuk pribadi, aplikasi menyediakan dua jalur penambahan saldo: `POST /wallets/my/topup` dan transaksi `INCOME`. Diperlukan kontrol keamanan agar simulasi ini tidak disalahgunakan di lingkungan produksi dan tidak memicu penambahan nominal yang tidak terkontrol.
- **Keputusan**:
  1. **Gating Eksklusif Simulasi Topup**: Endpoint `POST /api/v1/wallets/my/topup` dikendalikan secara mutlak oleh variabel lingkungan `ENABLE_TOPUP_SIMULATION` (default: `false`). Pada lingkungan `NODE_ENV=production`, validasi konfigurasi Zod (`envSchema`) secara preventif menggagalkan start server jika flag bernilai `true`, dan service layer secara redundan memblokir eksekusi dengan error HTTP 403 `TOPUP_SIMULATION_DISABLED`.
  2. **Pagu Batas Atas Transaksional Terkonfigurasi**:
     - Simulasi topup dibatasi oleh variabel `TOPUP_MAX_AMOUNT_PER_TX` (default Rp 50.000.000).
     - Transaksi pemasukan pribadi (`INCOME`) dibatasi oleh variabel `INCOME_MAX_AMOUNT_PER_TX` (default Rp 50.000.000).
     Percobaan transaksi melebihi pagu ditolak dengan respons HTTP 400 `LIMIT_EXCEEDED`.
  3. **Integritas Pembukuan & Jejak Audit**: Seluruh penambahan saldo wajib menghasilkan baris mutasi kredit pada tabel buku besar `wallet_entries` (`reference_type = 'topup_simulation'` atau `'transaction'`) di dalam transaksi atomik terisolasi dan mencatat log audit pada `activity_logs`.
- **Status**: `accepted`

---

### ADR-052: Model Kategori Transaksi, Proteksi Kategori Sistem & Mekanisme Soft-Delete Reactivation
- **Konteks**: Aplikasi membutuhkan klasifikasi transaksi yang fleksibel namun aman. Terdapat kategori bawaan sistem (*seed*) dan kategori kustom pengguna. Dibutuhkan aturan tegas terkait kepemilikan, integritas tipe transaksi, dan penanganan bentrok nama pasca soft-delete.
- **Keputusan**:
  1. **Proteksi Kategori Sistem**: Kategori sistem (`is_system = true`, `user_id = NULL`) diproteksi secara absolut di service layer. Modifikasi atau penghapusan oleh pengguna reguler maupun admin ditolak dengan HTTP 403 `SYSTEM_CATEGORY_PROTECTED`.
  2. **Kesesuaian Tipe Mutlak**: Kategori dengan `type = 'income'` hanya dapat ditautkan ke transaksi `INCOME`, dan `type = 'expense'` ke transaksi `EXPENSE`. Pelanggaran ditolak dengan HTTP 400 `CATEGORY_TYPE_MISMATCH`.
  3. **Reaktivasi Otomatis Soft-Delete**: Jika pengguna membuat kategori baru dengan nama dan tipe yang identik dengan kategori miliknya yang telah di-soft-delete sebelumnya, sistem secara otomatis mereaktivasi kategori lama (`deleted_at = NULL`) dan memperbarui ikon/warna, mencegah error pelanggaran partial unique index.
- **Bukti Pengujian**: `tests/finance/categories.test.ts` (12 tests).
- **Status**: `accepted`

---

### ADR-053: Arsitektur Realisasi Anggaran Bebas Floating-Point Berbasis BigInt Basis Points, Zona Waktu Terkonfigurasi (`BUDGET_TIMEZONE`) & Interval Setengah Terbuka
- **Konteks**: Perhitungan persentase anggaran (*budget realization*) menggunakan floating-point biner rentan menghasilkan representasi desimal tidak konsisten (e.g. `83.33333333333334%`). Selain itu, penggunaan offset `+07` hardcoded dan batas atas tertutup `23:59:59.999` rentan mengabaikan konfigurasi zona waktu serta melewatkan transaksi sub-milidetik (misal `23:59:59.9995`) pada akhir `end_date`.
- **Keputusan**:
  1. **Kalkulasi Realisasi BigInt Basis Points**: Agregasi total belanja dan persentase dihitung menggunakan basis points integer: $\text{percentage\_bps} = \lfloor (\text{spent\_amount} \times 10000) / \text{limit\_amount} \rfloor$ dan persentase integer $\text{percentage} = \lfloor (\text{spent\_amount} \times 100) / \text{limit\_amount} \rfloor$.
  2. **Parameter Zona Waktu `BUDGET_TIMEZONE` (`AT TIME ZONE`) & Interval Setengah Terbuka**: Query agregasi realisasi menerima zona waktu IANA tervalidasi dari `env.BUDGET_TIMEZONE` (default `'Asia/Jakarta'`) sebagai parameter SQL `AT TIME ZONE` dengan interval setengah terbuka `t.transaction_date >= (b.start_date::timestamp AT TIME ZONE $tz) AND t.transaction_date < ((b.end_date + 1)::timestamp AT TIME ZONE $tz)`.
  3. **Pencegahan Tumpang Tindih**: Constraint GiST exclusion `chk_budgets_no_overlapping_periods` dan query validasi mencegah duplikasi atau overlap anggaran kategori yang sama pada periode aktif.
- **Bukti Pengujian**: `tests/finance/budgets.test.ts` (12 tests).
- **Status**: `accepted`

---

### ADR-054: Arsitektur Keamanan Unggah Berkas Bukti Transaksi: Validasi Magic Bytes, Sanitasi Nama & Non-Executable Storage
- **Konteks**: Pengguna dapat mengunggah bukti kuitansi transaksi. Verifikasi nama berkas atau header `Content-Type` semata rentan dimanipulasi oleh penyerang untuk mengunggah skrip web shell atau berkas berbahaya.
- **Keputusan**:
  1. **Verifikasi Magic Bytes Buffer Nyata**: Validator `detectMagicBytes` membaca signature biner berkas di memori untuk memastikan tipe MIME aktual (JPEG, PNG, WebP, PDF). Ekstensi atau header palsu langsung ditolak dengan HTTP 415 `UNSUPPORTED_MEDIA_TYPE`.
  2. **Penyimpanan Terisolasi Non-Executable**: Berkas disimpan di luar root web publik (`apps/api/uploads/attachments/`). Dilarang keras menggunakan `express.static()` pada direktori unggahan.
  3. **Sanitasi Nama & UUID Randomization**: Berkas disimpan menggunakan nama unik acak UUIDv4 tanpa ekstensi klien. Karakter traversal path disanitasi dari nama asli berkas.
  4. **Header Streaming Download Aman**: Pengunduhan berkas mewajibkan autentikasi dan otorisasi kepemilikan, disertai headers `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment`, dan `Cache-Control: private, no-store, max-age=0`.
  5. **Endpoint Kanonik Tunggal**: Unggah lampiran dilayani melalui satu rute kanonik `POST /api/v1/attachments` (alias `/attachments/upload` dihapus karena belum ada klien frontend dan mencegah duplikasi permukaan rute).
- **Bukti Pengujian**: `tests/attachments/attachments.test.ts` (10 tests).
- **Status**: `accepted`

---

### ADR-055: Penegakan Kuota Maksimal 5 Lampiran per Transaksi via Exclusive Row-Locking (FOR UPDATE)
- **Konteks**: Serangan upload konkuren paralel dapat melewati kuota maksimal lampiran per transaksi (*race condition*) jika verifikasi jumlah dilakukan tanpa penguncian atomik.
- **Keputusan**:
  1. Service mengunci baris transaksi di dalam database transaction: `SELECT t.id, t.status, t.wallet_id, w.user_id FROM transactions t JOIN wallets w ON t.wallet_id = w.id WHERE t.id = $1 FOR UPDATE`.
  2. Menghitung jumlah lampiran aktif. Jika $\ge 5$, upload ditolak dengan HTTP 400 `LIMIT_EXCEEDED`.
  3. Penambahan baris attachment dan pembersihan berkas fisik saat gagal disinkronkan secara ketat di bawah serialisasi row-lock tersebut.
- **Bukti Pengujian**: `tests/attachments/attachments-race.test.ts` (10 upload simultan konkuren ke `POST /api/v1/attachments`, rasio oversubscription 2x terhadap kuota 5: tepat 5 berhasil `201` dan 5 ditolak `400`; lulus 5 ronde pengujian berturut-turut).
- **Status**: `accepted`

---

### ADR-056: Penjaminan Jejak Audit Permanen (Append-Only Audit Trail) via PostgreSQL Immutable Trigger pada activity_logs
- **Konteks**: Jejak audit (*audit trail*) harus bersifat kebal manipulasi (*tamper-proof*). Admin atau pihak yang memiliki akses ke database tidak boleh dapat mengubah atau menghapus rekaman aktivitas untuk menutupi jejak.
- **Keputusan**:
  1. Memasang PostgreSQL trigger `trg_activity_logs_immutable` pada tabel `activity_logs` (`BEFORE UPDATE OR DELETE`) yang memanggil `prevent_activity_logs_mutation()`.
  2. Setiap perintah modifikasi atau penghapusan ditolak secara absolut di level kernel database.
  3. Metadata yang dicatat disanitasi secara otomatis oleh helper `recordActivity` / `sanitizeLogMetadata` beserta katalog aksi standar `ACTIVITY_ACTIONS` agar tidak memuat informasi sensitif (password, token autentikasi, hash, secret, atau `file_path` internal).
- **Bukti Pengujian**: `tests/activity-logs/activity-logs.test.ts` (10 tests).
- **Status**: `accepted`

---

### ADR-057: Batas Ukuran Berkas Multer 2MB, Analisis Dampak Memori per Request, dan Penanganan Penolakan Dini Klien
- **Konteks**: Multer memproses pengunggahan berkas secara in-memory buffer (`multer.memoryStorage()`). Jika batas Multer dilonggarkan (misal 10MB), setiap request berukuran besar akan menahan alokasi buffer memori di heap V8 hingga handler selesai membaca stream. Pada beban tinggi (misal 100 upload simultan), batas 10MB berpotensi memakan hingga 1.000 MB (1GB) RAM server, meningkatkan risiko *heap exhaustion* dan *Denial of Service* (DoS). Sebaliknya, menegakkan batas ketat 2MB langsung di konfigurasi Multer menghentikan stream lebih awal, namun dapat memicu reset socket prematur (`ECONNRESET`/`EPIPE`) pada pustaka klien HTTP (seperti Supertest/Node stream) jika klien masih memompa data saat koneksi ditutup dengan HTTP 413.
- **Keputusan**:
  1. **Batas Ketat Multer 2MB**: Batas ukuran berkas di Multer dikembalikan dan disinkronkan secara ketat dengan konfigurasi produksi `env.ATTACHMENT_MAX_FILE_SIZE_BYTES` (2 MB = 2.097.152 bytes).
  2. **Dampak Memori Terkendali per Request**: Memori maksimal per request dibatasi tepat pada 2MB. Di bawah lonjakan konkuren 100 request unggah bersamaan, konsumsi memori puncak dipatok maksimal ~200MB (turun 80% dari batas 10MB), menjamin stabilitas heap Node.js.
  3. **Pemetaan Kesalahan Terpusat**: Error bawaan Multer `LIMIT_FILE_SIZE` dipetakan secara terpusat oleh `error-handler.middleware.ts` ke HTTP 413 `PAYLOAD_TOO_LARGE`.
  4. **Penanganan Penolakan Dini pada Klien Test**: Klien pengujian disesuaikan untuk menangani penolakan dini (`ECONNRESET`/`EPIPE`) maupun HTTP `413` secara anggun, dengan tetap memverifikasi tanpa syarat bahwa tidak ada baris `attachments` baru di database dan tidak ada berkas baru di direktori `UPLOAD_DIR`.
  5. **Proteksi Rate Limiter Ketat**: Rute upload dilindungi oleh `attachmentUploadLimiter` (30 req/menit di produksi) dan rute unduh oleh `attachmentDownloadLimiter` (60 req/menit di produksi).
  6. **Rollback Berkas Fisik Otomatis**: Jika operasi database gagal atau di-rollback, blok `catch` pada service secara otomatis menghapus berkas fisik yang baru dibuat menggunakan `fs.unlink`.
- **Bukti Pengujian**: `tests/attachments/attachments.test.ts` (10 tests) dan `tests/attachments/attachments-race.test.ts`.
- **Status**: `accepted`

---

### ADR-058: Standarisasi Format Uang JSON Safe Integer `number` via Helper Fail-Fast `toSafeMoneyNumber` dan Kunci Metadata Audit `snake_case`
- **Konteks**: Basis data PostgreSQL menyimpan nilai moneter sebagai `BIGINT` ($2^{63} - 1 \approx 9{,}22 \times 10^{18}$) dan layer bisnis menghitungnya dengan `BigInt` murni, sedangkan `pg` mengembalikan kolom `BIGINT` sebagai `string` dan JSON mengikuti standar IEEE-754 double-precision `number` dengan batas bilangan bulat presisi penuh `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 = 9\,007\,199\,254\,740\,991 \approx \text{Rp } 9{,}007\text{ Kuadriliun}$). Sebelumnya konversi `Number(bigint)` dilakukan tersebar dan pada sebagian metadata `activity_logs` nilai uang tersimpan sebagai string (`limitAmount.toString()`) dengan kunci `camelCase` (`newBalance`, `limitAmount`).
- **Keputusan**:
  1. **Satu Aturan JSON Moneter**: Seluruh field uang pada payload JSON (`wallets`, `topup`, `wallet_entries`, `transactions`, `transfers`, `budgets`), cache `idempotency_records.response_body`, `activity_logs.metadata`, seeder database, dan fixture test wajib bertipe `number` bilangan bulat aman (*safe integer*).
  2. **Helper Tunggal Fail-Fast `toSafeMoneyNumber`**: Semua konversi nilai uang ke JSON wajib melewati `toSafeMoneyNumber` di `packages/shared/src/finance.ts`. Jika nilai melebihi $\pm(2^{53} - 1)$ atau bukan bilangan bulat valid, helper langsung melempar `RangeError`/`TypeError` (dipetakan ke HTTP `500 INTERNAL_SERVER_ERROR`) sehingga *silent precision loss* mustahil terjadi, tanpa merusak ergonomi numerik frontend (grafik Recharts, kalkulator UI, skema Zod).
  3. **Kunci Metadata Audit Seragam**: Seluruh nilai uang di `activity_logs.metadata` diseragamkan ke `snake_case` (`amount`, `new_balance`, `limit_amount`), termasuk pencatatan eksplisit `TRANSFER_RECEIVED` bagi penerima transfer selain `TRANSFER_SENT` bagi pengirim.
- **Bukti Pengujian**: `tests/unit/money-arithmetic.test.ts` (7 tests) dan `tests/finance/money-format-contract.test.ts` (3 tests).
- **Status**: `accepted`

---

### ADR-059: Penyatuan Katalog 25 `ACTIVITY_ACTIONS` Bertipe Union Ketat, Privasi Login Gagal Tanpa Email Mentah, Perlindungan Tabel Append-Only dari Jalur Tanpa Autentikasi, dan Batasan Retensi Log
- **Konteks**: Sebelumnya modul autentikasi Phase 4 memancarkan 4 string literal di luar katalog (`USER_LOGIN_SUCCESS`, `USER_LOGIN_FAILED`, `TOKEN_REFRESH_SUCCESS`, `TOKEN_REUSE_DETECTED`), parameter `action` pada `recordActivity` masih melonggarkan `ActivityAction | string`, dan kegagalan login menyimpan email mentah serta menulis baris `activity_logs` (`user_id = NULL`) untuk setiap percobaan email tak terdaftar. Karena `activity_logs` dilindungi trigger *append-only* `trg_activity_logs_immutable` (tanpa `DELETE`), jalur publik tanpa autentikasi yang menulis langsung ke tabel tersebut berisiko memicu pertumbuhan ukuran tabel tak terbatas (*unbounded table bloat / disk exhaustion*) serta menyimpan PII email mentah yang diketik penyerang.
- **Keputusan**:
  1. **Satu Katalog Kanonik 25 Aksi & Compile-Time Union**: Menyatukan seluruh peristiwa ke `ACTIVITY_ACTIONS` dengan tepat satu nama per peristiwa (`USER_LOGIN`, `USER_LOGIN_FAILED`, `TOKEN_REFRESHED`, `TOKEN_REUSE_DETECTED`, dll. — total 25 aksi). Parameter `action` pada `recordActivity` dan `authRepository.recordActivityLog` dipersempit menjadi union `ActivityAction` murni tanpa `| string`, diperkuat oleh test struktural pemindai kode `apps/api/src/` dan test emisi nyata 25/25 aksi.
  2. **Tanpa Email Mentah & Pemisahan Email Tak Terdaftar**:
     - Email tidak terdaftar pada `login` (maupun `forgotPassword`): **tidak ditulis** ke tabel `activity_logs`, melainkan hanya dicatat ke structured logger aplikasi (`logger.warn`) dengan hash SHA-256 dari email ternormalisasi (`email.trim().toLowerCase()`) dan alamat IP.
     - Kata sandi salah pada akun aktif yang ada: ditulis ke `activity_logs` (`USER_LOGIN_FAILED`) dengan `user_id`, IP, dan `metadata: { reason: 'INVALID_CREDENTIALS' }` tanpa email.
     - Akun nonaktif (`is_active = false`) atau soft-deleted (`deleted_at IS NOT NULL`) yang ada: ditulis ke `activity_logs` (`USER_LOGIN_FAILED`) dengan `user_id`, IP, dan `metadata: { reason: 'ACCOUNT_INACTIVE' }` tanpa email.
     - Kunci `email` ditambahkan ke `FORBIDDEN_KEY_PATTERNS` pada `sanitizeLogMetadata` sebagai *defense-in-depth*.
  3. **Batasan Retensi Log (`Log Retention Limitation`)**: Karena `trg_activity_logs_immutable` memblokir `DELETE`, belum terdapat mekanisme pemangkasan atau partisi arsip otomatis untuk log berusia tua. Batasan retensi ini didokumentasikan secara eksplisit pada `DOMAIN_MODEL.md` dan `AUTH_SECURITY.md` (`[OPEN-SEC-06]`) untuk ditangani dengan *declarative partitioning* pada fase persiapan produksi.
- **Bukti Pengujian**: `tests/auth/login-audit-privacy.test.ts` (3 tests) dan `tests/activity-logs/activity-logs.test.ts` (10 tests).
- **Status**: `accepted`









