# Wallet App — Personal Finance & Internal Closed-Loop Wallet

Aplikasi web full-stack modern untuk manajemen keuangan pribadi, pencatatan transaksi pemasukan dan pengeluaran, anggaran, serta transfer saldo internal antar-pengguna dengan arsitektur monorepo aman dan tangguh.

---

> ### 🛠️ STATUS PROYEK: PHASE 1 COMPLETED (Monorepo Bootstrap & Tooling Active)
> **Status Saat Ini: Phase 1 — Project Bootstrap, Environment, & Tooling (Selesai)**.  
> Repositori telah dilengkapi kerangka monorepo pnpm aktif, build system TypeScript, linter ESLint, formatter Prettier, unit testing Vitest, Express server dengan endpoint `/health`, web scaffold Vite + Tailwind, serta orkestrasi Docker Compose PostgreSQL lokal.  
> **Fitur bisnis dan skema database belum diimplementasikan** (akan dibangun di Phase 2 dst sesuai [docs/IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md)).

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
| **Backend** | Node.js, Express.js, TypeScript, Zod, Prisma/Knex (query & migration), bcrypt/argon2, jsonwebtoken |
| **Database** | PostgreSQL (Relasional, migrasi terkelola, seeder minimal 20 data per tabel utama) |
| **Tools & Dokumen** | Docker, Swagger / OpenAPI v3, Postman Collection, Git |

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
│   ├── REQUIREMENTS.md        # Daftar spesifikasi terinci (status PLANNED)
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
│   └── api/                   # Layanan Backend (Express + TypeScript)
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
- **Docker & Docker Compose**: Untuk PostgreSQL lokal

### Langkah Setup & Eksekusi
```bash
# 1. Salin template konfigurasi environment
cp .env.example .env

# 2. Pasang seluruh dependensi monorepo
pnpm install

# 3. Jalankan container database PostgreSQL lokal
pnpm db:up

# 4. Verifikasi kualitas kode & typecheck
pnpm typecheck
pnpm lint
pnpm format:check

# 5. Jalankan suite pengujian unit & integrasi
pnpm test

# 6. Kompilasi bundle produksi seluruh paket
pnpm build

# 7. Menjalankan server pengembangan:
# Menjalankan API backend saja (port 5000):
pnpm dev:api

# Menjalankan Web frontend saja (port 5173):
pnpm dev:web

# Atau menjalankan keduanya secara paralel:
pnpm dev
```
