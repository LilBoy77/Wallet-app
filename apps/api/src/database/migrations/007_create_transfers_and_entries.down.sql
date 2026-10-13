-- Migration: 007_create_transfers_and_entries (DOWN)

DROP TRIGGER IF EXISTS trg_wallet_entries_no_update ON wallet_entries;
DROP TRIGGER IF EXISTS trg_wallet_entries_no_delete ON wallet_entries;
DROP TABLE IF EXISTS wallet_entries CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
