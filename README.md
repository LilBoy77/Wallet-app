# Wallet App — Personal Finance & Internal Closed-Loop Wallet

Aplikasi web full-stack modern untuk manajemen keuangan pribadi, pencatatan transaksi pemasukan dan pengeluaran, anggaran, serta transfer saldo internal antar-pengguna dengan arsitektur monorepo aman dan tangguh.

---

> ### 🛠️ STATUS PROYEK: PHASE 3 COMPLETED (Backend Foundation, Security & Error Handling Verified)
> **Status Saat Ini: Phase 3 — Backend Foundation, Configuration & Error Handling (Selesai & Terverifikasi)**.  
> Pipeline middleware 10 langkah (Request ID, Helmet, CORS whitelist, Rate Limiter 429, Body Parser, Pino structured logging dengan redaksi sensitif, `/health` liveness, `/health/ready` readiness probe, `/api/v1` router modular registry, 404 handler, dan Global Error Handler) telah aktif dan terverifikasi. Seluruh model error (`AppError`), validasi Zod, translasi SQLSTATE PostgreSQL (zero information leakage), helper query listing anti-SQL injection, helper transaksi `withTransaction` dengan isolasi level dan bounded retry, serta graceful shutdown teruji 100% lulus (70 tests Vitest di backend).  
> **Modul bisnis, autentikasi sesi, dan token RBAC akan dibangun di Phase 4** sesuai [docs/IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md).

---

## 1. Fitur Terencana
- **Manajemen Akun & Autentikasi**: Registrasi, login dengan JWT + Refresh Token dalam HttpOnly cookie, Role-Based Access Control (User & Admin).
- **Wallet & Saldo Internal**: Closed-loop balance management, riwayat mutasi saldo ganda (double-entry ledger / wallet entries), validasi saldo non-negatif.
- **Transaksi Pemasukan & Pengeluaran**: Pencatatan transaksi harian, kategori multi-level, lampiran struk/bukti transaksi, dan soft delete.
- **Transfer Saldo Internal**: Pengiriman saldo instan antar-pengguna terdaftar dengan perlindungan locking atomik dan idempotency key.
- **Kategori & Anggaran (Budgets)**: Pelacakan alokasi dana per kategori dengan progress bar persentase realisasi anggaran.
- **Dashboard Statistik & Visualisasi**: Grafik arus kas interaktif, distribusi pengeluaran, ringkasan saldo, dan riwayat aktivitas terbaru.
- **Admin Dashboard**: Monitoring audit transaksi, kelola status pengguna, pemantauan log aktivitas sistem.
- **Dokumentasi & Testing**: Swagger/OpenAPI interaktif, Postman Collection, pengujian komprehensif (Unit, Integration, E2E).

## 2. Tech Stack Terpilih `[DECIDED]`
| Lapisan | Teknologi |
| :--- | :--- |
| **Monorepo** | pnpm workspaces |
| **Frontend** | React 18+, TypeScript, Vite, Tailwind CSS, React Router v6+, TanStack Query v5, React Hook Form, Zod, Recharts, Lucide Icons |
| **Backend** | Node.js, Express.js, TypeScript, Zod, pg (Native PostgreSQL Pool & SQL Migrator), bcrypt/argon2, jsonwebtoken |
| **Database** | PostgreSQL 16+ (Relasional, migrasi terkelola up/down, seeder deterministik $\ge 20$ baris per tabel, append-only ledger) |
| **Tools & Dokumen** | Docker, Vitest, Swagger / OpenAPI v3, Postman Collection, Git |

## 3. Struktur Repositori
```text
wallet-app/
├── AGENTS.md                  # Aturan operasional AI Agent (Single Source of Truth)
├── GEMINI.md                  # Compatibility layer Antigravity/Gemini
├── README.md                  # Dokumentasi utama proyek
├── .env.example               # Template environment variable aman
├── .gitignore                 # Konfigurasi ignore file Git
├── .editorconfig              # Standar pemformatan kode
├── pnpm-workspace.yaml        # Definisi workspace monorepo
├── package.json               # Konfigurasi script monorepo root
├── docs/                      # Spesifikasi teknis, arsitektur, dan tata kelola
│   ├── ASSIGNMENT_SOURCE.md   # Teks tugas asli dan ketentuan dasar
│   ├── PROJECT_BRIEF.md       # Visi produk, cakupan, dan glosarium
│   ├── REQUIREMENTS.md        # Daftar spesifikasi terinci
│   ├── ARCHITECTURE.md        # Arsitektur sistem dan diagram
│   ├── DOMAIN_MODEL.md        # Model domain dan analisis trade-off
│   ├── DATABASE_DESIGN.md     # Desain database, relasi, constraint, seeder
│   ├── API_CONTRACT.md        # Spesifikasi REST API & katalog endpoint
│   ├── AUTH_SECURITY.md       # Desain keamanan, auth, RBAC, dan validasi
│   ├── FRONTEND_GUIDELINES.md # Panduan UI/UX, arsitektur komponen & state
│   ├── BACKEND_GUIDELINES.md  # Panduan backend, pola layered, transaksi DB
│   ├── TESTING_STRATEGY.md    # Strategi pengujian & skenario batas
│   ├── IMPLEMENTATION_PLAN.md # Roadmap 13 fase pengembangan (Phase 0–12)
│   ├── DEFINITION_OF_DONE.md  # Checklist standar penyelesaian tugas
│   ├── AI_WORKFLOW.md         # 12 langkah eksekusi kerja AI Agent
│   └── DECISIONS_LOG.md       # Rekaman keputusan teknis (ADR)
├── apps/
│   ├── web/                   # Aplikasi Frontend (React + Vite)
│   └── api/                   # Layanan Backend (Express + TypeScript + Database Migrations)
├── packages/
│   └── shared/                # Skema Zod, tipe TypeScript, dan utilitas bersama
└── infrastructure/            # Konfigurasi Docker & infrastruktur lokal
```

## 4. Dokumentasi Lengkap
Seluruh rincian perancangan dapat diakses melalui tautan berikut:
- **Konsep & Cakupan Produk**: [PROJECT_BRIEF.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/PROJECT_BRIEF.md) & [REQUIREMENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/REQUIREMENTS.md)
- **Arsitektur & Data**: [ARCHITECTURE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ARCHITECTURE.md), [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md), [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md)
- **API & Keamanan**: [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md), [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md)
- **Pedoman Kode & Pengujian**: [FRONTEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/FRONTEND_GUIDELINES.md), [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md), [TESTING_STRATEGY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/TESTING_STRATEGY.md)
- **Manajemen Eksekusi**: [IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md), [DEFINITION_OF_DONE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DEFINITION_OF_DONE.md), [AI_WORKFLOW.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AI_WORKFLOW.md), [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md)

## 5. Panduan Menjalankan Proyek (Setup & Operasional)
Ikuti langkah berikut untuk menjalankan repositori secara lokal:

### Prasyarat
- **Node.js**: $\ge 20.0.0$ (disarankan v24 LTS sesuai `.nvmrc`)
- **pnpm**: $\ge 9.0.0$ (menggunakan `pnpm@10.15.1`)
- **PostgreSQL**: PostgreSQL 16+ via Docker Compose atau PostgreSQL lokal pada port 5432

### Langkah Setup & Eksekusi
```bash
# 1. Salin template konfigurasi environment
cp .env.example .env

# 2. Pasang seluruh dependensi monorepo
pnpm install

# 3. Jalankan container database PostgreSQL lokal (jika menggunakan Docker)
pnpm db:up

# 4. Jalankan migrasi skema database
pnpm db:migrate

# 5. Isi database dengan data seed awal (development)
pnpm db:seed

# 6. Verifikasi konsistensi saldo, transfer, dan ledger
pnpm db:verify

# 7. Verifikasi kualitas kode, typecheck, dan linter
pnpm typecheck
pnpm lint
pnpm format:check

# 8. Jalankan suite pengujian unit & integrasi (termasuk database constraint test)
pnpm test

# 9. Kompilasi bundle produksi seluruh paket
pnpm build

# 10. Menjalankan server pengembangan:
# Menjalankan API backend saja (port 5000):
pnpm dev:api

# Menjalankan Web frontend saja (port 5173):
pnpm dev:web

# Atau menjalankan keduanya secara paralel:
pnpm dev
```

### Akun Seed Development
Data seed menyediakan kredensial pengembangan berikut (password di-hash menggunakan bcrypt cost 12):

| Role | Nama | Email | Username | Password (Dev Only) | Saldo Awal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | System Administrator | `admin@walletapp.local` | `admin` | `Admin123!` | Rp 50.000.000 |
| **User** | Budi Santoso | `user01@walletapp.local` | `budisantoso` | `User123!` | Rp 5.000.000 |
| **User** | Siti Rahmawati | `user02@walletapp.local` | `sitirahma` | `User123!` | Rp 12.500.000 |
| **User** | Andi Pratama | `user03@walletapp.local` | `andipratama` | `User123!` | Rp 8.200.000 |
| **User** | Dewi Lestari | `user04@walletapp.local` | `dewilestari` | `User123!` | Rp 15.000.000 |
| **User** | Eko Prasetyo | `user05@walletapp.local` | `ekoprasetyo` | `User123!` | Rp 3.400.000 |
| **User** (Soft-deleted) | Deleted User Example | `deleted_user@walletapp.local` | `deleteduser` | `User123!` | Rp 0 |
