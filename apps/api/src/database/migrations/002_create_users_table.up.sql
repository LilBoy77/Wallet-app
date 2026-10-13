-- Migration: 002_create_users_table (UP)
-- Description: Create users table with soft delete, case-insensitive partial unique indexes, and updated_at trigger

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_users_username_len CHECK (char_length(username) >= 3),
  CONSTRAINT chk_users_email_not_empty CHECK (char_length(email) >= 5)
);

-- Partial Unique Indexes for active users (soft-delete aware and case-insensitive)
CREATE UNIQUE INDEX idx_users_email_active ON users (LOWER(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_username_active ON users (LOWER(username)) WHERE deleted_at IS NULL;

-- General query indexes
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_deleted_at ON users (deleted_at);

-- Attach updated_at trigger
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
