-- Migration: 012_phase6_categories_budgets_attachments (UP)
-- Description: Add soft delete & partial unique index to budgets, WebP & SHA-256 hash to attachments, and append-only trigger to activity_logs

-- 1. Budgets: Add btree_gist extension, soft delete, and atomic exclusion constraint against overlapping periods
CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS uq_budgets_user_category_period;
DROP INDEX IF EXISTS idx_budgets_user_category_period_active;

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS chk_budgets_no_overlapping_periods;

ALTER TABLE budgets 
ADD CONSTRAINT chk_budgets_no_overlapping_periods 
EXCLUDE USING gist (
  user_id WITH =,
  category_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
)
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_budgets_deleted_at ON budgets (deleted_at);

-- 2. Attachments: Add file_hash (SHA-256) and update MIME check constraint to include image/webp
ALTER TABLE attachments ADD COLUMN file_hash VARCHAR(64) NOT NULL DEFAULT '';

-- Drop existing inline check constraint if present
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_mime_type_check;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS chk_attachments_mime_type;

ALTER TABLE attachments ADD CONSTRAINT chk_attachments_mime_type 
CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));

-- 3. Activity Logs: Enforce append-only immutability at database level
CREATE OR REPLACE FUNCTION prevent_activity_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is an append-only audit trail and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_logs_immutable ON activity_logs;

CREATE TRIGGER trg_activity_logs_immutable
BEFORE UPDATE OR DELETE ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_logs_mutation();
