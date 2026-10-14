# apps/api — Backend REST API Service (Node.js + Express + TypeScript)

Direktori ini memuat layanan backend RESTful API berbasis **Node.js, Express.js, TypeScript, and PostgreSQL**.

## Status Saat Ini (Phase 3 Completed)
- **Status**: Fondasi backend, konfigurasi terpadu, keamanan, dan error handling lintas-modul aktif dan terverifikasi.
- **Implementasi Fondasi**:
  - **Pipeline Middleware 10 Langkah**: Request ID (`X-Request-Id` UUID v4), Helmet security headers + trust proxy, CORS whitelist ketat, Global Rate Limiting (429 dengan `Retry-After`), Body Parser aman (1MB limit), Structured logging (Pino) dengan redaksi otomatis data sensitif, Liveness `/health`, Readiness `/health/ready`, API Router `/api/v1` (modular blueprint registry), 404 handler, dan Global Error Handler.
  - **Model & Katalog Error**: Hirarki `AppError` lengkap, katalog kode error stabil, `asyncHandler` untuk Express v4, penanganan error Zod (HTTP 422 dengan detail field), format JSON rusak (HTTP 400), payload melebihi batas (HTTP 413), dan translasi kode error PostgreSQL (23505, 23503, 23514, 23502, 22P02, 40001, 57014) tanpa kebocoran schema/SQL ke klien.
  - **Akses Database & Transaksi**: Helper `withTransaction<T>(fn, options)` dengan dukungan isolation level (`READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`), penolakan tegas nested transaction, bounded retry untuk serialization/deadlock, dan auto-release client ke pool.
  - **Helper Listing Query**: Parsing `page`, `limit` (max 100), `search`, `filter`, dan **whitelist kolom sort/filter** yang memblokir serangan SQL injection pada klausa `ORDER BY`.
  - **Konfigurasi Fail-Fast**: Validasi env Zod untuk seluruh parameter operasional (`BODY_SIZE_LIMIT`, `RATE_LIMIT_*`, `TRUST_PROXY`, `SHUTDOWN_TIMEOUT_MS`, `PAGINATION_MAX_LIMIT`).
  - **Shutdown Anggun**: Menutup server HTTP, mendrain koneksi aktif, menutup connection pool database, dan exit bersih dengan timeout pengaman.

## Variabel Environment Baru (Phase 3)
| Variabel | Tipe | Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `BODY_SIZE_LIMIT` | string | `1mb` | Batas maksimum ukuran request body JSON |
| `RATE_LIMIT_WINDOW_MS` | number | `900000` | Jendela waktu rate limiting (ms, default 15 menit) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `100` | Maksimum request per IP per jendela waktu |
| `TRUST_PROXY` | boolean / number | `false` | Konfigurasi reverse proxy Express |
| `SHUTDOWN_TIMEOUT_MS` | number | `10000` | Batas waktu tunggu koneksi aktif saat shutdown (10 detik) |
| `PAGINATION_MAX_LIMIT` | number | `100` | Batas maksimum parameter `limit` pagination |

## Perintah Eksekusi
```bash
# Menjalankan server dalam mode development (live watch)
pnpm --filter @wallet-app/api dev

# Menjalankan typecheck
pnpm --filter @wallet-app/api typecheck

# Menjalankan test runner
pnpm --filter @wallet-app/api test

# Membangun build produksi
pnpm --filter @wallet-app/api build
```
