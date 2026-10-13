-- Migration: 005_create_budgets_table (DOWN)

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
DROP TABLE IF EXISTS budgets CASCADE;
