# Transactional access-level verification

Run locally: `node supabase/tests/employee-access-postgres.test.mjs`.

Requires psql and a local PostgreSQL server with the postgres superuser available. The runner fixes the host to 127.0.0.1; port defaults to 54322 and may be set with INSTITUVA_LOCAL_PG_PORT. INSTITUVA_LOCAL_PG_USER defaults to postgres. Use the normal PostgreSQL local credential mechanism (PGPASSWORD/pgpass). Never pass production credentials.

The runner creates a uniquely named instituva_access_test_* database, installs only synthetic fixtures and the repository's real permission resolver plus new migration, and drops that same database afterward. It does not run the migration against the existing application database. Standard NOLOGIN roles authenticated/anon/service_role are created if missing in this local cluster.

The SQL suite injects PostgreSQL AFTER-trigger failures after profile updates, assignment deletion/insertion, employee updates and audit insertion. Each call must throw, and a full JSON snapshot of rows, timestamps, assignments, overrides, audit and the target's effective permission answers must equal its pre-call snapshot. It also exercises the authenticated execution role, forbidden direct profile writes, invalid levels, cross-museum access, self changes and missing roles.assign. Independent psql sessions test lock waiting and stale-request rejection.

These are real PostgreSQL tests, not a JavaScript simulation. The minimal fixture is not a complete copy of the production schema: deployment compatibility still requires separate verification. The new migration updates the existing profile-security trigger function to accept only a trusted postgres execution identity for authorized changes to another user's role; direct authenticated UPDATE remains forbidden. It does not change RLS or JWT claims in production.

## Execution result — 2026-09-06

PASS on real PostgreSQL 17.11, Windows x64, at 127.0.0.1:55431. Used the official EDB portable binaries in .git/pr31-postgres-local; no Windows service, global PATH/configuration changes, or remote database. PATH and credentials were scoped to the test process. Download: https://sbp.enterprisedb.com/getfile.jsp?fileid=1260491 (SHA256 4B8DB0930C38F6EF845DB919551DEDDA3B6B845AEB0927B3D79A6E8E9E4537CF).

The complete existing runner exited 0 after correcting a single-dollar delimiter in the unlinked-employee test block. No application or migration changes were needed.

- Real rollback passed after profile update, assignment deletion, assignment insertion, employee update and audit insertion.
- Full before/after snapshots matched, including timestamps, previous assignments, individual overrides, audit rows and effective permissions.
- Audit failure also rolled back the intended level for an employee without an account.
- Successful replacement preserved the account state, unrelated roles and deny overrides; direct profile writes, unauthorized callers, self changes, invalid levels and cross-museum changes were rejected.
- Two independent psql connections passed: the second waited for the first transaction, then rejected its stale expected level. The final role was ejecutivo and status remained active.
- The runner removed its disposable databases; verified zero instituva_access_test_* databases afterward. The isolated server was stopped. Portable binaries and the stopped synthetic cluster remain under .git for reuse; no existing application data was removed.

Result: PASS: real PostgreSQL rollback at profile/delete/insert/employee/audit; permissions preserved; authenticated authorization; two-session concurrency.

This validates the migration against the synthetic PostgreSQL fixture, not the complete deployed Supabase schema. No production compatibility or deployment is implied.
