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

# Reset total volume database (HAPUS DATA LOKAL):
docker compose -f infrastructure/docker-compose.yml down -v
```
