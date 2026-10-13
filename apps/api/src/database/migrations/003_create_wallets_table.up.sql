-- Migration: 003_create_wallets_table (UP)
-- Description: Create wallets table (1:1 with users) with balance non-negative check and currency check

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_number VARCHAR(32) NOT NULL UNIQUE,
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_wallets_balance_non_negative CHECK (balance >= 0)
);

-- Indexes for fast lookup
CREATE INDEX idx_wallets_user_id ON wallets (user_id);
CREATE INDEX idx_wallets_wallet_number ON wallets (wallet_number);

-- Attach updated_at trigger
CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
