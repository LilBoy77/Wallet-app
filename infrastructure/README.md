# infrastructure — Local Development & Deployment Infrastructure

Direktori ini memuat konfigurasi orkestrasi infrastruktur pendukung aplikasi Wallet App, khususnya untuk pengembangan lokal dan pengujian.

## Status Saat Ini (Phase 0)
- **Status**: Kerangka direktori awal telah disiapkan.
- **Implementasi**: Belum ada Dockerfile atau docker-compose kompleks yang diaktifkan. Konfigurasi orkestrasi PostgreSQL lokal akan disiapkan pada fase berikutnya sesuai [IMPLEMENTATION_PLAN.md](file:///c:/Users/Ulil%20Arsyad%20Ramadhan/Wallet-app/docs/IMPLEMENTATION_PLAN.md).

## Rencana Isi Direktori
- `docker-compose.yml`: Container PostgreSQL terisolasi untuk database development dan testing lokal.
- `init-scripts/`: Skrip inisialisasi basis data (ekstensi uuid-ossp, pgcrypto).
