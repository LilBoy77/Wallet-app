-- Migration: 001_setup_extensions_and_triggers (UP)
-- Description: Enable pgcrypto extension and create common triggers/functions

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce append-only immutability on ledger entries
CREATE OR REPLACE FUNCTION prevent_wallet_entries_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'wallet_entries is an append-only audit ledger and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;
