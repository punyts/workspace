-- The role the servers connect as in docker/magnetic.compose.yml's local profile, as the hosted database has it:
-- no superuser and no BYPASSRLS, so row-level security holds. `magnetic migrate --app-role` grants it the tables
CREATE ROLE magnetic_app LOGIN PASSWORD 'magnetic_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
