-- Migration: 001_setup_extensions_and_triggers (DOWN)

DROP FUNCTION IF EXISTS prevent_wallet_entries_mutation();
DROP FUNCTION IF EXISTS set_updated_at_timestamp();
