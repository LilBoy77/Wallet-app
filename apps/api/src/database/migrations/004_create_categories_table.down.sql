-- Migration: 004_create_categories_table (DOWN)

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
DROP TABLE IF EXISTS categories CASCADE;
