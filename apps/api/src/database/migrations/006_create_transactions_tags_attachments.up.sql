-- Migration: 006_create_transactions_tags_attachments (UP)
-- Description: Create transactions (with soft delete), tags, transaction_tags (N:N pivot), and attachments tables

-- 1. Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  amount BIGINT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_transactions_amount_positive CHECK (amount > 0)
);

-- Indexes for transactions
CREATE INDEX idx_transactions_wallet_date ON transactions (wallet_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_category ON transactions (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_deleted_at ON transactions (deleted_at);

-- Trigger for transactions updated_at
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 2. Tags Table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tags_name_not_empty CHECK (char_length(name) >= 1)
);

CREATE UNIQUE INDEX idx_tags_name_unique ON tags (LOWER(name));

-- 3. Pivot Table: Transaction Tags (Many-to-Many Relationship)
CREATE TABLE transaction_tags (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX idx_transaction_tags_tag_id ON transaction_tags (tag_id);

-- 4. Attachments Table (Max 2MB, MIME validation)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 2097152),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_transaction_id ON attachments (transaction_id);
