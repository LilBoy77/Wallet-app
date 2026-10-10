# AGENTS.md — Instruksi Operasional AI & Tata Kelola Proyek

Dokumen ini adalah pedoman operasional wajib bagi setiap AI agent yang bekerja pada repositori **Wallet App**. Semua aturan di bawah ini bersifat mengikat dan harus dipatuhi.

## 1. Ringkasan Proyek & Konteks Eksekusi
- **Aplikasi**: Wallet App (manajemen keuangan pribadi + transfer saldo internal antar-pengguna).
- **Arsitektur**: Monorepo pnpm (`apps/web`, `apps/api`, `packages/shared`, `infrastructure`).
- **Stack Inti**: React 18+ (TS, Vite, Tailwind, TanStack Query, React Hook Form, Zod, Recharts, Lucide) | Node.js + Express (TS, Zod) | PostgreSQL.
- **Model Transfer**: Saldo tertutup internal (closed-loop wallet). DILARANG mengasumsikan integrasi payment gateway eksternal.

## 2. Peta Dokumen Wajib Dibaca per Jenis Tugas
Sebelum menjalankan tugas apa pun, baca dokumen terkait berikut:
- **Tugas Global / Memulai Fase Baru**: [IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md), [REQUIREMENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/REQUIREMENTS.md), [DEFINITION_OF_DONE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DEFINITION_OF_DONE.md), [AI_WORKFLOW.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AI_WORKFLOW.md).
- **Tugas Backend & API**: [ARCHITECTURE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/ARCHITECTURE.md), [BACKEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/BACKEND_GUIDELINES.md), [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md), [AUTH_SECURITY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/AUTH_SECURITY.md).
- **Tugas Database & Model**: [DOMAIN_MODEL.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DOMAIN_MODEL.md), [DATABASE_DESIGN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DATABASE_DESIGN.md).
- **Tugas Frontend & UI**: [FRONTEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/FRONTEND_GUIDELINES.md), [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md).
- **Tugas Testing & Kualitas**: [TESTING_STRATEGY.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/TESTING_STRATEGY.md), [DEFINITION_OF_DONE.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DEFINITION_OF_DONE.md).
- **Keputusan Arsitektur / Konflik**: [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).

## 3. Batasan Arsitektur & Aturan Kode
1. **Periksa Kode Nyata Terlebih Dahulu**: Jangan berasumsi file atau fungsi ada; selalu verifikasi keberadaan dan isi file sebelum memodifikasi atau mengimpor.
2. **Kemandirian Modul**: `apps/web` dan `apps/api` hanya boleh berbagi kode melalui `packages/shared`. Dilarang mengimpor file backend langsung ke frontend atau sebaliknya.
3. **Standar Kode**: Gunakan TypeScript strict mode. Dilarang menggunakan tipe `any` tanpa justifikasi tertulis. Semua skema validasi wajib menggunakan Zod.
4. **Keamanan & Otorisasi**: Otorisasi data wajib diverifikasi di sisi server (Backend). Jangan pernah mengandalkan proteksi UI semata.
5. **Perubahan Database & API**: Semua perubahan skema database wajib melalui migrasi terkelola (up & down). Kontrak API tidak boleh diubah secara breaking tanpa memperbarui [API_CONTRACT.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/API_CONTRACT.md) dan [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).

## 4. Larangan Mutlak (Strict Prohibitions)
1. **Dilarang Menggunakan Data Dummy sebagai Pengganti Backend**: Kegagalan API/database tidak boleh ditutupi dengan hardcoded mock data pada halaman produksi.
2. **Dilarang Menghapus Fitur Tanpa Instruksi**: Jangan refactor dengan menghapus fungsionalitas yang sudah ada.
3. **Dilarang Komit Kredensial**: Dilarang membuat file `.env` berisi secret sungguhan; gunakan `.env.example` dengan placeholder aman.
4. **Dilarang Mengklaim Status Tanpa Bukti**: Dilarang menandai requirement `IMPLEMENTED`/`VERIFIED` sebelum ada bukti kode dan hasil tes yang lulus.

## 5. Prosedur Validasi, Update Dokumen & Pelaporan
1. **Validasi**: Jalankan pengujian otomatis/linting terkait sebelum menyatakan tugas selesai.
2. **Pembaruan Dokumen**: Jika implementasi mengubah spesifikasi atau menyelesaikan requirement, perbarui status di [REQUIREMENTS.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/REQUIREMENTS.md) dan log di [DECISIONS_LOG.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/DECISIONS_LOG.md).
3. **Format Pelaporan**: Setiap respon penyelesaian task wajib menyajikan:
   - **Ringkasan Perubahan**: Apa yang dilakukan.
   - **File yang Diubah/Dibuat**: Daftar file lengkap dengan link.
   - **Hasil Validasi**: Bukti tes/verifikasi yang dijalankan.
   - **Status Requirement**: ID requirement yang terpengaruh dan status terbarunya.
   - **Langkah Berikutnya**: Apa yang perlu dilakukan selanjutnya sesuai [IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md).
