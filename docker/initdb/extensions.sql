-- The extensions Magnetic's migrations need, made once when the database is created (they need a superuser)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS ltree;
