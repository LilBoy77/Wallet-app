# packages/shared — Shared Schemas, Types & Utilities

Paket ini menyediakan *Single Source of Truth* untuk tipe data TypeScript, skema validasi Zod, konstanta sistem, dan utilitas yang dipakai bersama oleh `apps/web` dan `apps/api`.

## Status Saat Ini (Phase 0)
- **Status**: Kerangka direktori awal telah disiapkan.
- **Implementasi**: Belum ada paket terinstal. Tooling dan build paket diinisialisasi pada **Phase 1**.

## Panduan Arsitektur Direktori (Rencana)
```text
src/
├── schemas/    # Skema validasi Zod untuk request DTO, query params, form inputs
├── types/      # Tipe data TypeScript (User, Wallet, Transaction, ResponseEnvelope)
├── constants/  # Enum peran (Role), tipe transaksi (TransactionType), status
└── utils/      # Utilitas format mata uang (IDR), sanitasi string, parsing tanggal
```
