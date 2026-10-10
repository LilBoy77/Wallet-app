# apps/web — Frontend Application (React + Vite)

Direktori ini diperuntukkan bagi aplikasi klien antarmuka pengguna berbasis **React 18+, TypeScript, Vite, dan Tailwind CSS**.

## Status Saat Ini (Phase 0)
- **Status**: Kerangka direktori awal telah disiapkan.
- **Implementasi**: Belum ada kode antarmuka yang diaktifkan. Inisialisasi tooling dan dependensi akan dijalankan pada **Phase 1 & Phase 7**.

## Panduan Arsitektur Direktori (Rencana)
```text
src/
├── app/         # Inisialisasi provider (QueryClient, AuthContext, Theme)
├── routes/      # Definisi rute React Router (Public, Private, Admin)
├── layouts/     # Layout template (AuthLayout, DashboardLayout)
├── features/    # Modul fitur bisnis (auth, wallet, transactions, transfers, budgets, admin)
├── components/  # Komponen UI bersama (Button, Modal, Input, Card, Table)
├── hooks/       # Custom React hooks (useAuth, useDebounce, useMediaQuery)
├── services/    # Klien HTTP Axios / TanStack Query hooks
├── lib/         # Utilitas lokal & konfigurasi pustaka (axiosInstance, formatters)
├── types/       # Definisi tipe khusus frontend
└── styles/      # Styling global Tailwind CSS & design tokens
```

Rujuk dokumen spesifikasi: [FRONTEND_GUIDELINES.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/FRONTEND_GUIDELINES.md).
