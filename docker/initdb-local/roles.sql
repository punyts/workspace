-- The roles the servers and the aggregate connect as in docker/magnetic.compose.yml's local profile, as the hosted
-- database has them: no superuser and no BYPASSRLS, so row-level security holds. `magnetic migrate --app-role
-- magnetic_app --aggregate-role magnetic_aggregate` grants them their tables: the servers every table but only reading
-- people's state, the aggregate writing it (docs/design/statenet-network.md, S11)
CREATE ROLE magnetic_app LOGIN PASSWORD 'magnetic_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE magnetic_aggregate LOGIN PASSWORD 'magnetic_aggregate' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
