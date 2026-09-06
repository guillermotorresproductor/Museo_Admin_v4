import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const invite = await readFile(new URL("../functions/invite-employee/index.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../../js/services/supabase.js", import.meta.url), "utf8");

// Main's legacy profile provisioning and status vocabulary remain supported.
assert.match(invite, /const usesLegacyRbac = roleError\?\.code === "PGRST205"/);
assert.match(invite, /legacyProbe\.error\?\.code !== "PGRST205"/);
assert.match(invite, /LEGACY_RBAC_PROFILE_ROLE/);
assert.match(invite, /\.from\("profiles"\)[\s\S]*?\.upsert\(\{ id: userId/);
assert.match(invite, /role: "empleado", status: profile\.status/);
assert.match(invite, /if \(!usesLegacyRbac\)[\s\S]*admin\.from\("user_roles"\)\.upsert/);
assert.match(service, /roles_unavailable/);
assert.match(service, /assignments_unavailable/);
assert.match(service, /profile\.role !== "empleado"/);
assert.match(service, /\["active", "activo"\]/);

// The conflict is resolved in favor of durable repair, never destructive rollback.
assert.equal((invite.match(/inviteUserByEmail\(/g) || []).length, 1);
assert.doesNotMatch(invite, /deleteUser|ban_duration|updateUserById/);
for (const state of ["invite_failed", "invite_sent_link_pending", "invite_sent_linked"]) assert.ok(invite.includes(state));
assert.match(invite, /cleanEmployeeId\(body\.employee_id\)/);
assert.match(invite, /cleanRequestId\(body\.request_id\)/);
assert.match(invite, /enforceEmailCooldown/);
assert.match(invite, /action === "resend"[\s\S]*admin\.auth\.resend/);
assert.match(invite, /resend-request:/);
assert.match(invite, /USER_INVITATION_RESENT/);
assert.match(invite, /allowed\.includes\(destination\)/);
assert.doesNotMatch(invite, /body\.(redirectTo|redirect_to|redirect)/);
console.log("Reconciled legacy/normalized invitation checks passed.");
