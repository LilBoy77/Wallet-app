# apps/api — Backend REST API Service (Node.js + Express + TypeScript)

Direktori ini memuat layanan backend RESTful API berbasis **Node.js, Express.js, TypeScript, dan PostgreSQL**.

## Status Saat Ini (Phase 1)
- **Status**: Fondasi server dan kerangka teknis telah aktif.
- **Implementasi**:
  - Validasi environment fail-fast dengan Zod (`src/config/env.ts`).
  - Pemisahan `app.ts` (factory aplikasi Express) dan `server.ts` (listener + graceful shutdown).
  - Middleware: JSON parser (limit 1MB), Helmet, CORS dengan origin env spesifik, logging tersanitasi (tanpa mencatat authorization/cookies).
  - Endpoint infrastruktur: `GET /health` mengembalikan status service dan versi `@wallet-app/shared`.
  - Format 404 handler dan global error handler seragam sesuai [docs/API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md).
  - Pengujian Vitest + Supertest untuk endpoint `/health`, penanganan 404, dan validasi env.

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
