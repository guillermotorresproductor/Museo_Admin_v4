import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const invite = await readFile(new URL("../functions/invite-employee/index.ts", import.meta.url), "utf8");
const access = await readFile(new URL("../functions/_shared/employee-access.ts", import.meta.url), "utf8");

// The production legacy schema has profiles.role but no roles/user_roles.
// PGRST205 must select that compatibility path without masking any other error.
assert.match(invite, /const usesLegacyRbac = roleError\?\.code === "PGRST205"/);
assert.match(invite, /if \(usesLegacyRbac\)[\s\S]*LEGACY_RBAC_PROFILE_ROLE[\s\S]*else[\s\S]*EMPLOYEE_ROLE_REQUIRED/);
assert.match(invite, /role:\s*"empleado"/);
assert.match(invite, /status:\s*profile\.status/);
assert.match(invite, /\.update\(\{ profile_id: invited\.user\.id \}\)[\s\S]*\.is\("profile_id", null\)/);

// Normalized RBAC remains supported and still assigns the employee role.
assert.match(invite, /\.from\("roles"\)[\s\S]*\.eq\("code", "empleado"\)/);
assert.match(invite, /admin\.from\("user_roles"\)\.upsert\([\s\S]*role_id: role\.id/);

// Safety properties: one invite call, rollback on later failure, durable audit,
// request idempotency, resend path, cooldown, and the mandated redirect.
assert.equal((invite.match(/inviteUserByEmail\(/g) || []).length, 1);
assert.match(invite, /findProcessedRequest/);
assert.match(invite, /enforceEmailCooldown/);
assert.match(invite, /action === "resend"[\s\S]*admin\.auth\.resend/);
assert.match(invite, /recordAccessAudit[\s\S]*USER_INVITED/);
assert.match(invite, /admin\.auth\.admin\.deleteUser\(invited\.user\.id\)/);
assert.match(access, /EMPLOYEE_LOGIN_REDIRECT = "https:\/\/mmdpr\.org\/login"/);
assert.match(access, /findAuthUserByEmail/);

console.log("Invite employee legacy/normalized RBAC compatibility checks passed.");
