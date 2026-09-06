# Transactional access-level verification

Run locally: `node supabase/tests/employee-access-postgres.test.mjs`.

Requires psql and a local PostgreSQL server with the postgres superuser available. The runner fixes the host to 127.0.0.1; port defaults to 54322 and may be set with INSTITUVA_LOCAL_PG_PORT. INSTITUVA_LOCAL_PG_USER defaults to postgres. Use the normal PostgreSQL local credential mechanism (PGPASSWORD/pgpass). Never pass production credentials.

The runner creates a uniquely named instituva_access_test_* database, installs only synthetic fixtures and the repository's real permission resolver plus new migration, and drops that same database afterward. It does not run the migration against the existing application database. Standard NOLOGIN roles authenticated/anon/service_role are created if missing in this local cluster.

The SQL suite injects PostgreSQL AFTER-trigger failures after profile updates, assignment deletion/insertion, employee updates and audit insertion. Each call must throw, and a full JSON snapshot of rows, timestamps, assignments, overrides, audit and the target's effective permission answers must equal its pre-call snapshot. It also exercises the authenticated execution role, forbidden direct profile writes, invalid levels, cross-museum access, self changes and missing roles.assign. Independent psql sessions test lock waiting and stale-request rejection.

These are real PostgreSQL tests, not a JavaScript simulation. The minimal fixture is not a complete copy of the production schema: deployment compatibility still requires separate verification. The new migration updates the existing profile-security trigger function to accept only a trusted postgres execution identity for authorized changes to another user's role; direct authenticated UPDATE remains forbidden. It does not change RLS or JWT claims in production.

Current execution status: NOT EXECUTED on this host. psql is absent; supabase status reports Docker/Podman unavailable. JavaScript tests validate only frontend/Edge wiring and do not establish database rollback.
