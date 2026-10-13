-- Migration: 008_create_support_tables (DOWN)

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
