-- Migration: 003_create_wallets_table (DOWN)

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
DROP TABLE IF EXISTS wallets CASCADE;
