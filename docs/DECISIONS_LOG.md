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



