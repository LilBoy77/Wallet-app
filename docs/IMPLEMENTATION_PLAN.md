# IMPLEMENTATION_PLAN — Peta Jalan Implementasi 13 Fase (Phase 0–12)

Dokumen ini adalah rencana kerja master bertahap untuk pengembangan **Wallet App**. Setiap fase memiliki batasan, prasyarat, dokumen acuan, dan kriteria kelulusan yang ketat.

> **Status Saat Ini**: Hanya **Phase 0** yang aktif. Fase 1 sampai 12 berstatus `PENDING` dan dilarang dikerjakan sebelum fase sebelumnya tuntas diverifikasi sesuai [DEFINITION_OF_DONE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DEFINITION_OF_DONE.md).

---

## Ringkasan Status Fase
| Fase | Nama Fase | Status |
| :--- | :--- | :--- |
| **Phase 0** | AI Foundation & Project Governance | **COMPLETED** |
| **Phase 1** | Monorepo Bootstrap & Tooling Setup | **COMPLETED (Verified)** |
| **Phase 2** | Database Schema, Migration & Seeder | **COMPLETED (Verified)** |
| **Phase 3** | Backend Foundation, Configuration & Error Handling | `PENDING (Next Up)` |
| **Phase 4** | Authentication, Session, Cookie & RBAC | `PENDING` |
| **Phase 5** | Wallet, Transaction & Transfer Business Logic | `PENDING` |
| **Phase 6** | Categories, Budgets, Attachments & Activity Logs | `PENDING` |
| **Phase 7** | Frontend Foundation, Design System & Routing | `PENDING` |
| **Phase 8** | Dashboard Integration & Core CRUD Modules | `PENDING` |
| **Phase 9** | Search, Filter, Sort, Pagination, Upload & Notification | `PENDING` |
| **Phase 10** | Swagger/OpenAPI, Postman & Integration Testing | `PENDING` |
| **Phase 11** | Security Hardening, Responsive Review & Acceptance | `PENDING` |
| **Phase 12** | Deployment Preparation & Final Documentation Handover | `PENDING` |

---

## Rincian Spesifikasi Tiap Fase

### Phase 0: AI Foundation & Project Governance
- **Tujuan**: Menyiapkan fondasi dokumentasi, aturan kerja AI, dan kerangka workspace tanpa menulis kode fitur bisnis.
- **Prasyarat**: Repositori kosong atau bersih.
- **Hasil**: Kumpulan dokumen spesifikasi di `docs/`, `AGENTS.md`, `GEMINI.md`, `README.md`, konfigurasi monorepo root dasar, dan direktori kerangka.
- **Dokumen Terkait**: [AGENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/AGENTS.md), [AI_WORKFLOW.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AI_WORKFLOW.md), [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
- **Pengujian / Verifikasi**: Seluruh dokumen ada, tautan valid, sintaks workspace valid.
- **Kriteria Lanjut**: Review kelengkapan Phase 0 disetujui.

---

### Phase 1: Monorepo Bootstrap & Tooling Setup
- **Tujuan**: Menginisialisasi dependensi monorepo pnpm, konfigurasi TypeScript, ESLint, Prettier, dan skrip build.
- **Prasyarat**: Phase 0 selesai.
- **Hasil**: `pnpm install` berhasil tanpa error, build test minimal pada `packages/shared`, `apps/api`, `apps/web`.
- **Dokumen yang Dibaca**: [ARCHITECTURE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ARCHITECTURE.md), [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
- **Test yang Harus Lulus**: `pnpm -r build` dan `pnpm lint` berjalan bersih.
- **Kriteria Lanjut**: Package scripts root terverifikasi dapat menjalankan web dan api.

---

### Phase 2: Database Schema, Migration & Seeder
- **Status**: **COMPLETED (Verified)**
- **Tujuan**: Membangun skema database PostgreSQL lengkap dengan migrasi up/down, constraint, index, dan seeder $\ge 20$ data per tabel utama.
- **Prasyarat**: Phase 1 selesai, koneksi PostgreSQL tersedia.
- **Hasil**: 8 pasang migrasi up/down untuk 13 tabel (`users`, `wallets`, `categories`, `budgets`, `transactions`, `tags`, `transaction_tags`, `attachments`, `transfers`, `wallet_entries`, `refresh_tokens`, `activity_logs`, `notifications`), connection pool `pg`, skrip CLI (`db:migrate`, `db:rollback`, `db:status`, `db:seed`, `db:reset`, `db:verify`), serta 25 integration tests (migration lifecycle, database constraints, soft-delete, append-only ledger trigger, seeder safety guard, data consistency).
- **Dokumen yang Dibaca**: [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md), [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md), [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
- **Test yang Lulus**: `pnpm db:migrate`, `pnpm db:rollback --all`, `pnpm db:seed`, `pnpm db:verify`, dan 25 Vitest tests di `apps/api`.
- **Kriteria Lanjut**: Data seeder terisi $\ge 20$ record per tabel utama dan integritas relasi 1:1, 1:N, N:1, N:N terbukti 100% konsisten.

---

### Phase 3: Backend Foundation, Configuration & Error Handling
- **Status**: **COMPLETED (Verified)**
- **Tujuan**: Menyiapkan struktur Express, modular architecture, middleware global (CORS, Helmet, Rate Limit, Error Handler), env validation, database client, dan error handling lintas-modul.
- **Prasyarat**: Phase 2 selesai.
- **Hasil**: Server `apps/api` menyala dengan pipeline 10 middleware terstandarisasi, liveness `/health` dan readiness `/health/ready`, hirarki `AppError` lengkap, katalog kode error stabil, validasi Zod dengan perapian field, helper listing anti-SQL injection, transaksi terkelola `withTransaction` dengan isolasi level dan bounded retry, structured logger Pino dengan redaksi otomatis, shutdown anggun terverifikasi, serta 70 tests Vitest lulus di seluruh monorepo.
- **Dokumen yang Dibaca**: [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md), [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md), [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md), [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
- **Test yang Lulus**: 70 tests Vitest di `apps/api` (error hierarchy, PostgreSQL real constraint violations, log redaction, rate limiter 429, CORS & Helmet, listing SQL injection protection, transaction commit/rollback/release, health probes) dan 1 test di `apps/web`.
- **Kriteria Lanjut**: Seluruh endpoint error konsisten dalam envelope `{ success: false, error: { code, message, details, requestId } }`, fondasi siap menyangga modul bisnis Phase 4+.

---

### Phase 4: Authentication, Session, Cookie & RBAC
- **Tujuan**: Mengimplementasikan registrasi, login, logout, refresh token rotatif (HttpOnly cookie), serta middleware RBAC (`requireAuth`, `requireRole`).
- **Prasyarat**: Phase 3 selesai.
- **Hasil**: Modul auth berfungsi dengan pembuatan wallet otomatis saat registrasi.
- **Dokumen yang Dibaca**: [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md), [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md).
- **Test yang Harus Lulus**: Integration test login, token refresh, proteksi unauthorized 401, dan role forbidden 403.
- **Kriteria Lanjut**: Pengguna dapat login dan mendapatkan refresh token cookie aman.

---

### Phase 5: Wallet, Transaction & Transfer Business Logic
- **Tujuan**: Membangun modul inti finansial: mutasi saldo, pencatatan transaksi pemasukan/pengeluaran, transfer saldo internal atomik dengan database lock & idempotency key.
- **Prasyarat**: Phase 4 selesai.
- **Hasil**: Endpoint `/api/v1/wallets`, `/api/v1/transactions`, `/api/v1/transfers`.
- **Dokumen yang Dibaca**: [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md), [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md).
- **Test yang Harus Lulus**: Unit test saldo non-negatif, concurrency test transfer internal mencegah race condition / transfer ganda.
- **Kriteria Lanjut**: Atomisitas transfer terbukti lulus uji konkurensi tanpa *double spend*.

---

### Phase 6: Categories, Budgets, Attachments & Activity Logs
- **Tujuan**: Mengimplementasikan CRUD kategori, manajemen anggaran per periode, upload bukti kuitansi (MIME & size check), dan pencatatan audit log otomatis.
- **Prasyarat**: Phase 5 selesai.
- **Hasil**: Endpoint kategori, anggaran, upload attachment, dan audit log.
- **Dokumen yang Dibaca**: [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md), [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md).
- **Test yang Harus Lulus**: Upload validation test (tipe file ilegal ditolak), soft delete kategori & transaksi test.
- **Kriteria Lanjut**: Seluruh $\ge 6$ entitas CRUD di backend selesai dan lulus uji fungsional.

---

### Phase 7: Frontend Foundation, Design System & Routing
- **Tujuan**: Menyiapkan antarmuka React di `apps/web`: styling Tailwind CSS (design tokens fintech, micro-interactions), routing React Router (Public, Private, Admin Guard), Axios client interceptor, dan layout dasar.
- **Prasyarat**: Phase 1 selesai, Phase 4 tersedia untuk integrasi auth.
- **Hasil**: Layout responsif dengan Sidebar, Header, Mobile Nav, dan halaman Login/Register terproteksi.
- **Dokumen yang Dibaca**: [FRONTEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/FRONTEND_GUIDELINES.md).
- **Test yang Harus Lulus**: Route guard test (unauthenticated redirect), responsive rendering audit.
- **Kriteria Lanjut**: Desain dinilai premium, tidak generik, dan alur navigasi berjalan mulus.

---

### Phase 8: Dashboard Integration & Core CRUD Modules
- **Tujuan**: Menghubungkan frontend dengan API backend: Dashboard pengguna (grafik Recharts, ringkasan saldo), modul Transaksi (pencatatan pemasukan/pengeluaran), form Transfer saldo, dan Kategori.
- **Prasyarat**: Phase 5, Phase 6, Phase 7 selesai.
- **Hasil**: Fitur utama keuangan dapat dioperasikan penuh melalui UI web.
- **Dokumen yang Dibaca**: [FRONTEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/FRONTEND_GUIDELINES.md), [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md).
- **Test yang Harus Lulus**: Component integration test, form validation test (Zod + React Hook Form).
- **Kriteria Lanjut**: Transaksi diinput di web langsung tercermin pada saldo dashboard tanpa reload halaman penuh (TanStack Query cache invalidation).

---

### Phase 9: Search, Filter, Sort, Pagination, Upload & Notification
- **Tujuan**: Melengkapi pengalaman pengguna dengan server-side pagination, filter multi-kriteria, sorting dinamis, preview upload file struk, dan panel notifikasi aktivitas.
- **Prasyarat**: Phase 8 selesai.
- **Hasil**: Tabel transaksi dan log aktivitas memiliki filter tanggal/kategori, pencarian cepat (debounced), dan notifikasi masuk realistis.
- **Dokumen yang Dibaca**: [REQUIREMENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/REQUIREMENTS.md).
- **Test yang Harus Lulus**: UI filter & pagination test, upload attachment flow test.
- **Kriteria Lanjut**: Seluruh kebutuhan UX lanjutan berfungsi stabil.

---

### Phase 10: Swagger/OpenAPI, Postman & Integration Testing
- **Tujuan**: Menyediakan dokumentasi API interaktif lengkap (Swagger UI di `/api/docs`), Postman Collection JSON, serta suite integration test menyeluruh.
- **Prasyarat**: Phase 6 & Phase 9 selesai.
- **Hasil**: Dokumentasi API Swagger dapat diakses dan diuji langsung, Postman collection terverifikasi.
- **Dokumen yang Dibaca**: [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md), [TESTING_STRATEGY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/TESTING_STRATEGY.md).
- **Test yang Harus Lulus**: Seluruh endpoint lolos verifikasi kontrak Swagger dan Postman runner.
- **Kriteria Lanjut**: 100% endpoint publik dan privat terpetakan dalam Swagger.

---

### Phase 11: Security Hardening, Responsive Review & Acceptance
- **Tujuan**: Audit menyeluruh terhadap kerentanan keamanan (SQL Injection, XSS, CSRF, IDOR / ownership check), review tampilan pada perangkat mobile (viewport 375px), dan validasi kriteria tugas.
- **Prasyarat**: Phase 10 selesai.
- **Hasil**: Laporan audit keamanan dan checklist penerimaan tugas terpenuhi 100%.
- **Dokumen yang Dibaca**: [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md), [TESTING_STRATEGY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/TESTING_STRATEGY.md).
- **Test yang Harus Lulus**: Penetration test checklist (IDOR test, rate limit test, XSS sanitization test).
- **Kriteria Lanjut**: Zero critical/high security vulnerability terdeteksi.

---

### Phase 12: Deployment Preparation & Final Documentation Handover
- **Tujuan**: Menyiapkan konfigurasi docker-compose untuk kemudahan demonstrasi lokal, dokumentasi panduan menjalankan aplikasi di `README.md`, dan serah terima proyek.
- **Prasyarat**: Phase 11 selesai.
- **Hasil**: Repositori siap dievaluasi oleh penguji/dosen dengan instruksi satu langkah instalasi dan demo.
- **Dokumen yang Dibaca**: [README.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/README.md), [ASSIGNMENT_SOURCE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ASSIGNMENT_SOURCE.md).
- **Test yang Harus Lulus**: Verifikasi deployment lokal dari awal (`git clone` simulasi hingga `seed` dan berjalan).
- **Kriteria Lanjut**: Seluruh checklist [DEFINITION_OF_DONE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DEFINITION_OF_DONE.md) tercentang hijau.
