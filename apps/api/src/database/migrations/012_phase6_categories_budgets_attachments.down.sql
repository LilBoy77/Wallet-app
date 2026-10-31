-- Migration: 012_phase6_categories_budgets_attachments (DOWN)
-- Description: Revert Phase 6 database schema changes

-- 1. Revert Activity Logs trigger and function
DROP TRIGGER IF EXISTS trg_activity_logs_immutable ON activity_logs;
DROP FUNCTION IF EXISTS prevent_activity_logs_mutation();

-- 2. Revert Attachments MIME check and file_hash column
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS chk_attachments_mime_type;

-- Remove any attachments with webp before restoring old constraint
DELETE FROM attachments WHERE mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf');

ALTER TABLE attachments ADD CONSTRAINT attachments_mime_type_check
CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf'));

ALTER TABLE attachments DROP COLUMN IF EXISTS file_hash;

-- 3. Revert Budgets soft delete and restore original unique constraint
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS chk_budgets_no_overlapping_periods;
DROP INDEX IF EXISTS idx_budgets_deleted_at;
DROP INDEX IF EXISTS idx_budgets_user_category_period_active;

-- Remove soft-deleted budgets before restoring strict unique constraint
DELETE FROM budgets WHERE deleted_at IS NOT NULL;

ALTER TABLE budgets DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE budgets ADD CONSTRAINT uq_budgets_user_category_period
UNIQUE (user_id, category_id, start_date, end_date);
