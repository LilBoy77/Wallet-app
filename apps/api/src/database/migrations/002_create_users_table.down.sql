-- Migration: 002_create_users_table (DOWN)

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP TABLE IF EXISTS users CASCADE;
