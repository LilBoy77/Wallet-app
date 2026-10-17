-- Migration: 010_add_session_binding_index (DOWN)
-- Description: Drop session binding composite partial index

DROP INDEX IF EXISTS idx_refresh_tokens_family_user_active;
