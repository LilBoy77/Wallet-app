-- Migration: 007_create_transfers_and_entries (UP)
-- Description: Create transfers table and immutable append-only wallet_entries (ledger) table

-- 1. Transfers Table (Internal Closed-Loop Transfer)
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  target_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_transfers_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_transfers_different_wallets CHECK (source_wallet_id <> target_wallet_id)
);

CREATE INDEX idx_transfers_source_target ON transfers (source_wallet_id, target_wallet_id, created_at DESC);
CREATE INDEX idx_transfers_idempotency_key ON transfers (idempotency_key);
CREATE INDEX idx_transfers_status ON transfers (status);

-- 2. Wallet Entries Table (Immutable Audit Ledger)
CREATE TABLE wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  reference_id UUID NULL,
  reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('transaction', 'transfer_send', 'transfer_receive', 'topup_simulation')),
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_wallet_entries_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_wallet_entries_balance_after_non_negative CHECK (balance_after >= 0)
);

CREATE INDEX idx_wallet_entries_wallet ON wallet_entries (wallet_id, created_at DESC);
CREATE INDEX idx_wallet_entries_reference ON wallet_entries (reference_type, reference_id);

-- Enforce append-only immutability at database level
CREATE TRIGGER trg_wallet_entries_no_update
BEFORE UPDATE ON wallet_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_wallet_entries_mutation();

CREATE TRIGGER trg_wallet_entries_no_delete
BEFORE DELETE ON wallet_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_wallet_entries_mutation();
