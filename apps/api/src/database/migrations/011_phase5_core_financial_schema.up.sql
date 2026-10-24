-- Migration: 011_phase5_core_financial_schema (UP)
-- Description: Core financial schema enhancements: wallet metadata, transaction status state machine, reference types, and per-user idempotency records

-- 1. Wallets table: add metadata and active status
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Dompet Utama';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Transactions table: add explicit status state machine (COMPLETED, VOIDED)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_status;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_status CHECK (status IN ('COMPLETED', 'VOIDED'));

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_status ON transactions (wallet_id, status, transaction_date DESC);

-- 3. Wallet Entries table: expand reference_type check for transaction_void & reversal
ALTER TABLE wallet_entries DROP CONSTRAINT IF EXISTS wallet_entries_reference_type_check;
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_reference_type_check
CHECK (reference_type IN ('transaction', 'transfer_send', 'transfer_receive', 'topup_simulation', 'transaction_void', 'reversal'));

-- 4. Transfers table: scope idempotency_key unique constraint per source_wallet
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_idempotency_key_key;
ALTER TABLE transfers ADD CONSTRAINT transfers_idempotency_key_key UNIQUE (source_wallet_id, idempotency_key);

-- 5. Idempotency Records table: dedicated per-user canonical payload idempotency storage
CREATE TABLE IF NOT EXISTS idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  response_code INTEGER NULL,
  response_body JSONB NULL,
  resource_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_user_key ON idempotency_records (user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_records (expires_at);
