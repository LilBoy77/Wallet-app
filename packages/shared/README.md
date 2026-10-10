# packages/shared — Shared Schemas, Types & Utilities

Paket ini menyediakan *Single Source of Truth* untuk tipe data TypeScript, skema validasi Zod, konstanta sistem, dan utilitas yang dipakai bersama oleh `apps/web` dan `apps/api`.

## Status Saat Ini (Phase 1)
- **Status**: Paket telah terkonfigurasi untuk monorepo (`@wallet-app/shared`).
- **Placeholder Wiring**: Saat ini paket mengekspor konstanta placeholder `SHARED_APP_NAME`, `SHARED_API_VERSION`, dan interface `HealthCheckPayload` untuk memvalidasi interkoneksi typecheck lintas paket. Placeholder ini akan digantikan oleh tipe domain dan skema Zod penuh pada fase-fase berikutnya.

## Panduan Arsitektur Direktori (Rencana)
```text
src/
├── index.ts    # Entry point ekspor utama
├── schemas/    # Skema validasi Zod untuk request DTO, query params, form inputs (Phase 2+)
├── types/      # Tipe data TypeScript (User, Wallet, Transaction, ResponseEnvelope)
├── constants/  # Enum peran (Role), tipe transaksi (TransactionType), status
└── utils/      # Utilitas format mata uang (IDR), sanitasi string, parsing tanggal
```

## Cara Build & Typecheck
```bash
pnpm --filter @wallet-app/shared build
pnpm --filter @wallet-app/shared typecheck
```
