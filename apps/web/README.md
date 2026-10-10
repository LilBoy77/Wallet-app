# apps/web — Frontend Application (React + Vite + Tailwind CSS)

Direktori ini memuat antarmuka pengguna berbasis **React 18+, TypeScript, Vite, dan Tailwind CSS**.

## Status Saat Ini (Phase 1)
- **Status**: Tooling dan kerangka aplikasi telah aktif.
- **Implementasi**:
  - Halaman placeholder netral *"Wallet App — scaffold"* untuk membuktikan build dan dev server.
  - Tailwind CSS terkonfigurasi dengan design tokens tema fintech (`tailwind.config.js`).
  - Vite dev server dengan proxy `/api` ke backend service (`vite.config.ts`).
  - Testing menggunakan Vitest + React Testing Library + JSDOM dengan smoke test render.
  - Interkoneksi monorepo diverifikasi lewat impor `@wallet-app/shared`.

## Perintah Eksekusi
```bash
# Menjalankan frontend dalam mode development
pnpm --filter @wallet-app/web dev

# Menjalankan typecheck
pnpm --filter @wallet-app/web typecheck

# Menjalankan test runner
pnpm --filter @wallet-app/web test

# Membangun bundle produksi
pnpm --filter @wallet-app/web build
```
