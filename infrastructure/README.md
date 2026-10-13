# infrastructure — Local Development Infrastructure

Direktori ini memuat orkestrasi Docker Compose khusus untuk **PostgreSQL Local Development & Testing**.

> ⚠️ **PERINGATAN**: Konfigurasi ini HANYA diperuntukkan bagi lingkungan pengembangan lokal. Dilarang menggunakan kredensial default untuk lingkungan produksi.

## Konfigurasi Service
- **Engine**: PostgreSQL `16.8-alpine` (versi dipin)
- **Container Name**: `wallet_app_postgres_dev`
- **Volume Bernama**: `wallet_app_pg_data` (data persisten lokal)
- **Port**: `5432` (atau sesuai konfigurasi `DB_PORT` di `.env`)
- **Healthcheck**: Terintegrasi menggunakan `pg_isready`

## Perintah Operasional Database
Dari root workspace:
```bash
# Menjalankan container PostgreSQL di latar belakang
pnpm db:up

# Mematikan container PostgreSQL
pnpm db:down

# Melihat log streaming database
pnpm db:logs

# Menjalankan seluruh migrasi skema database (up)
pnpm db:migrate

# Melihat status migrasi yang telah dieksekusi
pnpm db:status

# Membatalkan 1 migrasi terakhir (down) atau gunakan --all untuk rollback penuh
pnpm db:rollback
pnpm db:rollback --all

# Mengisi database dengan data seed deterministik (≥20 baris per tabel)
pnpm db:seed

# Reset total database (rollback all -> migrate up -> seed)
pnpm db:reset

# Verifikasi integritas & konsistensi data database
pnpm db:verify

# Reset total volume database container (HAPUS DATA LOKAL PERSISTEN):
docker compose -f infrastructure/docker-compose.yml down -v
```

## Database Pengujian (Test Database)
Pengujian integrasi database otomatis menggunakan database terpisah (`wallet_test`).
Skrip pengujian (`pnpm test`) akan secara otomatis membuat database `wallet_test` jika belum ada, menjalankan migrasi, dan membersihkan data antar pengujian. Skrip pengujian secara eksplisit menolak berjalan pada database development (`wallet_app_db`) atau lingkungan produksi.
