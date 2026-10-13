-- Migration: 005_create_budgets_table (UP)
-- Description: Create budgets table with positive limit, date range check, and RESTRICT on category deletion

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  limit_amount BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_budgets_limit_positive CHECK (limit_amount > 0),
  CONSTRAINT chk_budgets_date_range CHECK (end_date >= start_date),
  CONSTRAINT uq_budgets_user_category_period UNIQUE (user_id, category_id, start_date, end_date)
);

-- Query performance indexes
CREATE INDEX idx_budgets_user_period ON budgets (user_id, start_date, end_date);
CREATE INDEX idx_budgets_category_id ON budgets (category_id);

-- Attach updated_at trigger
CREATE TRIGGER trg_budgets_updated_at
BEFORE UPDATE ON budgets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
