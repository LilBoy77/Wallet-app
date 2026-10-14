-- Migration: 009_create_password_resets_table (UP)
-- Description: Create password_resets table and add session family tracking to refresh_tokens

CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_user_id ON password_resets (user_id);
CREATE INDEX idx_password_resets_token_hash ON password_resets (token_hash);

-- Family lineage tracking for refresh token rotation & reuse detection
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens (family_id);
