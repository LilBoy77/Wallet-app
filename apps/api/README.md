# apps/api — Backend REST API Service (Node.js + Express + TypeScript)

Direktori ini diperuntukkan bagi layanan backend RESTful API berbasis **Node.js, Express.js, TypeScript, dan PostgreSQL**.

## Status Saat Ini (Phase 0)
- **Status**: Kerangka direktori awal telah disiapkan.
- **Implementasi**: Belum ada server aktif atau endpoint bisnis yang berjalan. Inisialisasi dependensi dan implementasi dimulai pada **Phase 1, 2, dan 3**.

## Panduan Arsitektur Direktori (Rencana)
```text
src/
├── config/       # Validasi env (Zod) dan konfigurasi aplikasi
├── middlewares/  # Error handler, auth JWT, RBAC guard, rate limiter, upload
├── modules/      # Modul domain (auth, users, wallets, transactions, transfers, categories, budgets, attachments, admin)
│   └── [domain]/ # routes, controllers, services, repositories, schemas
├── database/     # Migrasi, seeder, dan koneksi PostgreSQL pool / ORM
└── shared/       # Error classes (AppError), helper response envelope, logger
tests/
├── unit/         # Pengujian logika bisnis murni
├── integration/  # Pengujian endpoint REST API dan transaksi database
└── fixtures/     # Data uji & mock
```

Rujuk dokumen spesifikasi: [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md) & [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md).
