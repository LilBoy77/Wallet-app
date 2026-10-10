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
