-- Migration: 004_create_categories_table (UP)
-- Description: Create categories table with soft delete, system defaults, and soft-delete-aware unique constraints

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  icon VARCHAR(50) NOT NULL DEFAULT 'tag',
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Partial Unique Indexes:
-- Custom categories unique per user, name (case-insensitive), and type among active rows
CREATE UNIQUE INDEX idx_categories_user_name_type_active 
ON categories (user_id, LOWER(name), type) 
WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- System categories unique by name (case-insensitive) and type among active rows
CREATE UNIQUE INDEX idx_categories_system_name_type_active 
ON categories (LOWER(name), type) 
WHERE deleted_at IS NULL AND user_id IS NULL;

-- Query performance indexes
CREATE INDEX idx_categories_user_id ON categories (user_id);
CREATE INDEX idx_categories_type ON categories (type);
CREATE INDEX idx_categories_deleted_at ON categories (deleted_at);

-- Attach updated_at trigger
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
