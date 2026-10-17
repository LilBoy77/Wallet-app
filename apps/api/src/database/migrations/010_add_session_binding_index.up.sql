-- Migration: 010_add_session_binding_index (UP)
-- Description: Composite partial index on refresh_tokens for immediate session binding verification in authenticate middleware

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_user_active
ON refresh_tokens (family_id, user_id)
WHERE is_revoked = false;
