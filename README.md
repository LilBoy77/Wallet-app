# Wallet App — Personal Finance & Internal Closed-Loop Wallet

Aplikasi web full-stack modern untuk manajemen keuangan pribadi, pencatatan transaksi pemasukan dan pengeluaran, anggaran, serta transfer saldo internal antar-pengguna dengan arsitektur monorepo aman dan tangguh.

---

> ### ⚠️ PEMBERITAHUAN STATUS PROYEK (FASE 0)
> **Status Saat Ini: Phase 0 — AI Foundation & Project Governance**.  
> Pada fase ini, repositori **hanya memuat spesifikasi arsitektur, dokumen tata kelola, dan struktur kerangka kerja**. **Fitur bisnis, database produksi, endpoint API aktif, dan antarmuka pengguna BELUM diimplementasikan**. Semua proses pengembangan fitur akan dijalankan secara bertahap sesuai [docs/IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md).

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

## 5. Rencana Pengaturan Lokal (Rencana Pasca-Fase 0)
Pengaturan lokal akan dilakukan pada **Phase 1** setelah tooling diinisialisasi. Rencana umum langkah eksekusi:
1. Menyalin environment file: `cp .env.example .env`
2. Instalasi dependensi: `pnpm install` (dijalankan pada Phase 1)
3. Menjalankan database PostgreSQL via Docker atau instalasi lokal.
4. Menjalankan migrasi database & seeder.
5. Menjalankan server pengembangan: `pnpm dev`
