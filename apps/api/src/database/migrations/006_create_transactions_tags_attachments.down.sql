-- Migration: 006_create_transactions_tags_attachments (DOWN)

DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS transaction_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
DROP TABLE IF EXISTS transactions CASCADE;
