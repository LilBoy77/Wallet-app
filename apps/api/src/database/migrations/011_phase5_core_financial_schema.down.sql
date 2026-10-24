-- Migration: 011_phase5_core_financial_schema (DOWN)
-- Description: Revert core financial schema enhancements

-- 5. Drop idempotency_records table
DROP TABLE IF EXISTS idempotency_records;

-- 4. Restore transfers table idempotency_key unique constraint
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_idempotency_key_key;
ALTER TABLE transfers ADD CONSTRAINT transfers_idempotency_key_key UNIQUE (idempotency_key);

-- 3. Restore original wallet_entries reference_type check
ALTER TABLE wallet_entries DROP CONSTRAINT IF EXISTS wallet_entries_reference_type_check;
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_reference_type_check
CHECK (reference_type IN ('transaction', 'transfer_send', 'transfer_receive', 'topup_simulation'));

-- 2. Drop transactions status and index
DROP INDEX IF EXISTS idx_transactions_wallet_status;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_status;
ALTER TABLE transactions DROP COLUMN IF EXISTS status;

-- 1. Drop wallets name and is_active columns
ALTER TABLE wallets DROP COLUMN IF EXISTS is_active;
ALTER TABLE wallets DROP COLUMN IF EXISTS name;
