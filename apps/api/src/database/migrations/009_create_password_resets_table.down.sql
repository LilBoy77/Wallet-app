-- Migration: 009_create_password_resets_table (DOWN)
-- Description: Drop password_resets table and remove session family column

DROP INDEX IF EXISTS idx_refresh_tokens_family_id;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS family_id;
DROP TABLE IF EXISTS password_resets CASCADE;
