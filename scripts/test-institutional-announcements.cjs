const assert = require("assert");
const fs = require("fs");
const path = require("path");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const root = path.join(__dirname, "..");
const migrationSql = fs.readFileSync(
  path.join(root, "supabase", "migrations", "202607310002_institutional_announcements.sql"),
  "utf8"
);
const appJs = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const supabaseJs = fs.readFileSync(path.join(root, "js", "services", "supabase.js"), "utf8");
const boletinHtml = fs.readFileSync(path.join(root, "boletin.html"), "utf8");
const hrHtml = fs.readFileSync(path.join(root, "recursos-humanos.html"), "utf8");
const portalHtml = fs.readFileSync(path.join(root, "employee-portal.html"), "utf8");

const helpersSlice = migrationSql.slice(
  migrationSql.indexOf("create or replace function public.linked_employee_blocks_announcements"),
  migrationSql.indexOf("create or replace function public.write_institutional_announcement_audit")
);
const eligibleSlice = migrationSql.slice(
  migrationSql.indexOf("create or replace function public.eligible_institutional_announcement_recipients"),
  migrationSql.indexOf("create or replace function public.write_institutional_announcement_audit")
);
const rlsSlice = migrationSql.slice(
  migrationSql.indexOf("drop policy if exists institutional_announcements_select"),
  migrationSql.indexOf("create or replace function public.write_institutional_announcement_audit")
);
const publishSlice = migrationSql.slice(
  migrationSql.indexOf("create or replace function public.publish_institutional_announcement"),
  migrationSql.indexOf("create or replace function public.list_institutional_announcements")
);

test("official nomenclature and client use only announcement RPCs", () => {
  assert.match(appJs, /Boletín de Avisos Institucionales/);
  assert.match(boletinHtml, /Boletín de Avisos Institucionales/);
  assert.match(hrHtml, /Publicar aviso institucional/);
  assert.match(portalHtml, /Boletín de Avisos Institucionales/);
  assert.match(supabaseJs, /rpc\/publish_institutional_announcement/);
  assert.match(supabaseJs, /rpc\/list_institutional_announcements/);
  assert.match(supabaseJs, /rpc\/mark_institutional_announcement_read/);
  assert.match(supabaseJs, /rpc\/archive_institutional_announcement/);
  assert.doesNotMatch(supabaseJs, /\/rest\/v1\/institutional_announcements/);
  assert.doesNotMatch(supabaseJs, /\/rest\/v1\/institutional_announcement_recipients/);
  assert.doesNotMatch(appJs, /\/rest\/v1\/institutional_announcements/);
  assert.doesNotMatch(appJs, /Boletín institucional|Bulletin Board|Boletín Board/);
});

test("active linked administrador can publish and read via fail-closed helpers", () => {
  assert.match(migrationSql, /can_publish_institutional_announcement/);
  assert.match(migrationSql, /can_read_institutional_announcements/);
  assert.match(migrationSql, /not public\.linked_employee_blocks_announcements\(\)/);
  assert.match(migrationSql, /has_permission\('announcements\.publish'\)/);
  assert.match(migrationSql, /is_admin_or_executive_profile/);
  assert.match(migrationSql, /profile_has_nonactive_linked_employee/);
  assert.match(migrationSql, /not public\.employee_status_is_active\(e\.status\)/);
  assert.match(migrationSql, /public\.employee_status_is_active\(e\.status\)/);
});

test("active linked ejecutivo can publish and read", () => {
  assert.match(migrationSql, /r\.code in \('administrador', 'ejecutivo'\)/);
  assert.match(migrationSql, /p\.role in \('administrador', 'ejecutivo'\)/);
  assert.match(appJs, /currentProfileRole === "ejecutivo"/);
});

test("inactive linked administrador is blocked even with publish permission", () => {
  assert.match(migrationSql, /linked_employee_blocks_announcements/);
  assert.match(migrationSql, /profile_has_nonactive_linked_employee/);
  assert.match(migrationSql, /not public\.employee_status_is_active\(e\.status\)/);
  assert.match(rlsSlice, /not public\.linked_employee_blocks_announcements\(\)/);
  assert.doesNotMatch(rlsSlice, /has_permission\('announcements\.publish'\)\s*\)/);
  assert.match(
    migrationSql.slice(
      migrationSql.indexOf("create or replace function public.can_publish_institutional_announcement"),
      migrationSql.indexOf("create or replace function public.can_read_institutional_announcements")
    ),
    /not public\.linked_employee_blocks_announcements\(\)/
  );
});

test("terminated linked ejecutivo is blocked", () => {
  assert.match(migrationSql, /employee_status_is_active/);
  assert.doesNotMatch(migrationSql, /e\.status\s*<>\s*'/);
  assert.doesNotMatch(migrationSql, /e\.status\s+not in\s*\(/i);
  assert.doesNotMatch(eligibleSlice, /status\s*<>\s*'/);
});

test("null empty or unknown employee status is blocked fail-closed", () => {
  assert.match(migrationSql, /not public\.employee_status_is_active\(e\.status\)/);
  assert.match(migrationSql, /public\.employee_status_is_active\(e\.status\)/);
  // Active path requires positive normalized active check only.
  assert.doesNotMatch(eligibleSlice, /coalesce\(e\.status/);
});

test("administrador without linked employee keeps role access", () => {
  assert.match(helpersSlice, /is_admin_or_executive_profile/);
  assert.match(eligibleSlice, /profile_is_admin_or_executive/);
  assert.match(eligibleSlice, /profile_has_active_auth_linked_employee/);
  assert.match(eligibleSlice, /not public\.profile_has_nonactive_linked_employee/);
});

test("ejecutivo without linked employee keeps role access", () => {
  assert.match(eligibleSlice, /or public\.profile_is_admin_or_executive\(p\.id, p_museum_id\)/);
});

test("active ujier receives announcement but cannot publish", () => {
  assert.match(eligibleSlice, /profile_has_active_auth_linked_employee/);
  assert.match(migrationSql, /e\.auth_user_id = p_profile_id/);
  assert.match(migrationSql, /if not public\.can_publish_institutional_announcement\(\) then/);
  assert.match(appJs, /function canPublishInstitutionalAnnouncement\(\)/);
  assert.match(
    appJs,
    /if \(!canPublishInstitutionalAnnouncement\(\)\) \{\s*panel\.closest\("\[data-hr-announcement-workspace\]"\)\?\.setAttribute\("hidden", ""\);\s*if \(avisosCard\) avisosCard\.hidden = true;/
  );
  assert.match(appJs, /avisosCard\.hidden = !canPublish/);
  assert.doesNotMatch(appJs, /canPublishInstitutionalAnnouncement\(\)\s*\|\|\s*currentProfileRole === "ujier"/);
});

test("HR page separates directory and announcement workspaces", () => {
  assert.match(hrHtml, /data-hr-hub/);
  assert.match(hrHtml, /data-hr-hub-card="directorio"/);
  assert.match(hrHtml, /data-hr-hub-card="avisos"/);
  assert.match(hrHtml, /Directorio de Empleados/);
  assert.match(hrHtml, /Consulta y administración del personal del museo\./);
  assert.match(hrHtml, /Abrir directorio/);
  assert.match(hrHtml, /Publicación de Avisos Institucionales/);
  assert.match(hrHtml, /Publica avisos para el personal activo del museo\./);
  assert.match(hrHtml, /Publicar aviso/);
  assert.match(hrHtml, /data-hr-directory-workspace/);
  assert.match(hrHtml, /data-hr-announcement-workspace/);
  assert.match(hrHtml, /Volver a Recursos Humanos/);
  assert.match(hrHtml, /data-icon="users"/);
  assert.match(hrHtml, /data-icon="megaphone"/);

  // Hub uses Dashboard module-card pattern; workspaces start hidden.
  assert.match(hrHtml, /<section class="hr-hub" data-hr-hub>/);
  assert.match(hrHtml, /class="grid module-grid hr-module-grid"/);
  assert.match(hrHtml, /class="card module-card theme-blue"[^>]*data-hr-hub-card="directorio"/);
  assert.match(hrHtml, /class="card module-card theme-gold"[^>]*data-hr-hub-card="avisos"/);
  assert.match(hrHtml, /card-action">Abrir directorio</);
  assert.match(hrHtml, /card-action">Publicar aviso</);
  assert.doesNotMatch(hrHtml, /class="[^"]*hr-hub-panel|class="[^"]*hr-hub-card/);
  assert.doesNotMatch(hrHtml, /hr-hub-grid/);
  assert.match(hrHtml, /data-hr-directory-workspace hidden/);
  assert.match(hrHtml, /data-hr-announcement-workspace hidden/);
  assert.ok(
    hrHtml.indexOf("data-hr-hub") < hrHtml.indexOf("data-hr-directory-workspace"),
    "hub precedes directory workspace"
  );
  assert.ok(
    hrHtml.indexOf("data-hr-directory-workspace") < hrHtml.indexOf("data-hr-announcement-workspace"),
    "directory and announcement are separate sections"
  );
  // Announcement form must not live inside hub cards.
  const hubStart = hrHtml.indexOf('data-hr-hub>');
  const hubClose = hrHtml.indexOf("</section>", hrHtml.indexOf("hr-module-grid"));
  const hubChunk = hrHtml.slice(hubStart, hubClose);
  assert.doesNotMatch(hubChunk, /data-hr-announcement-form/);
  assert.doesNotMatch(hubChunk, /data-employee-form/);
  assert.doesNotMatch(hubChunk, /class="card panel/);
  assert.match(hubChunk, /class="card module-card/);
  assert.match(appJs, /function bindHrWorkspaceNavigation\(/);
  assert.match(appJs, /raw === "directorio"/);
  assert.match(appJs, /raw === "avisos"/);
  assert.match(appJs, /extras\.section = section/);
  assert.match(appJs, /museoPageUrl\("recursos-humanos\.html", extras\)/);
  assert.match(appJs, /window\.history\[method\]\(\{ hrSection: next \}/);
  assert.match(appJs, /popstate/);
  assert.match(appJs, /applySection\("hub"/);
  assert.match(appJs, /directoryWorkspace\.hidden = next !== "directorio"/);
  assert.match(appJs, /announcementWorkspace\.hidden = next !== "avisos"/);
  assert.match(appJs, /hub\.hidden = next !== "hub"/);
  assert.match(appJs, /clearWorkspaceMessages\(directoryWorkspace\)/);
  assert.match(appJs, /clearWorkspaceMessages\(announcementWorkspace\)/);
});

test("inactive employee does not receive announcement", () => {
  assert.ok(
    eligibleSlice.indexOf("not public.profile_has_nonactive_linked_employee")
      < eligibleSlice.indexOf("profile_has_active_auth_linked_employee")
  );
  assert.match(eligibleSlice, /not public\.profile_has_nonactive_linked_employee\(p\.id, p_museum_id\)/);
});

test("inactive linked admin does not receive announcement", () => {
  assert.match(eligibleSlice, /not public\.profile_has_nonactive_linked_employee\(p\.id, p_museum_id\)/);
  assert.ok(
    eligibleSlice.indexOf("not public.profile_has_nonactive_linked_employee")
      < eligibleSlice.indexOf("profile_is_admin_or_executive")
  );
});

test("any non-active linked employee among multiple links blocks access", () => {
  assert.match(migrationSql, /auth_user_id = p_profile_id or e\.profile_id = p_profile_id/);
  assert.match(migrationSql, /not public\.employee_status_is_active\(e\.status\)/);
  assert.match(
    migrationSql.slice(
      migrationSql.indexOf("create or replace function public.linked_employee_blocks_announcements"),
      migrationSql.indexOf("create or replace function public.is_admin_or_executive_profile")
    ),
    /profile_has_nonactive_linked_employee\(\s*auth\.uid\(\)/
  );
});

test("other museum is excluded from recipients and reads", () => {
  assert.match(eligibleSlice, /p\.museum_id = p_museum_id/);
  assert.match(migrationSql, /a\.museum_id = mid/);
  assert.match(rlsSlice, /museum_id = public\.current_user_museum_id\(\)/);
  assert.doesNotMatch(migrationSql, /app_records/);
});

test("recipients are distinct with no duplicate rows", () => {
  assert.match(eligibleSlice, /select distinct p\.id/);
  assert.match(migrationSql, /primary key \(announcement_id, recipient_user_id\)/);
});

test("authenticated has no direct SELECT on announcement tables", () => {
  assert.match(migrationSql, /revoke all on table public\.institutional_announcements from public, anon, authenticated;/);
  assert.match(migrationSql, /revoke all on table public\.institutional_announcement_recipients from public, anon, authenticated;/);
  assert.doesNotMatch(migrationSql, /grant select on table public\.institutional_announcements to authenticated;/i);
  assert.doesNotMatch(migrationSql, /grant select on table public\.institutional_announcement_recipients to authenticated;/i);
  assert.match(rlsSlice, /recipient_user_id = auth\.uid\(\)/);
  assert.doesNotMatch(
    rlsSlice.slice(rlsSlice.indexOf("institutional_announcement_recipients_select")),
    /can_publish_institutional_announcement|announcements\.publish/
  );
});

test("internal helpers revoke EXECUTE from public anon authenticated", () => {
  assert.match(migrationSql, /revoke all on function public\.%s from public, anon, authenticated/);
  assert.match(migrationSql, /profile_has_nonactive_linked_employee\(uuid,uuid\)/);
  assert.match(migrationSql, /eligible_institutional_announcement_recipients\(uuid\)/);
  assert.match(migrationSql, /linked_employee_blocks_announcements\(\)/);
  assert.match(migrationSql, /grant execute on function public\.publish_institutional_announcement\(text, text\) to authenticated;/);
  assert.match(migrationSql, /grant execute on function public\.list_institutional_announcements\(boolean\) to authenticated;/);
  assert.match(migrationSql, /grant execute on function public\.mark_institutional_announcement_read\(uuid\) to authenticated;/);
  assert.match(migrationSql, /grant execute on function public\.archive_institutional_announcement\(uuid\) to authenticated;/);
});

test("publish recipients notifications and audit remain atomic", () => {
  assert.match(publishSlice, /insert into public\.institutional_announcements/);
  assert.match(publishSlice, /insert into public\.institutional_announcement_recipients/);
  assert.match(publishSlice, /insert into public\.employee_notifications/);
  assert.match(publishSlice, /write_institutional_announcement_audit/);
  assert.match(publishSlice, /NO_ELIGIBLE_RECIPIENTS/);
  assert.match(migrationSql, /ANNOUNCEMENT_DELETE_FORBIDDEN/);
  assert.match(migrationSql, /ANNOUNCEMENT_CONTENT_IMMUTABLE/);
});

test("RLS no longer grants publish permission without active-link gate", () => {
  assert.match(rlsSlice, /not public\.linked_employee_blocks_announcements\(\)/);
  assert.match(rlsSlice, /can_publish_institutional_announcement\(\)/);
  assert.doesNotMatch(
    migrationSql.replace(/\s+/g, " "),
    /using \( museum_id = public\.current_user_museum_id\(\) and \( public\.has_permission\('announcements\.publish'\)/
  );
});

test("SESSION_IDLE_MS remains five minutes", () => {
  assert.match(appJs, /const SESSION_IDLE_MS = 5 \* 60 \* 1000;/);
});

console.log("All institutional announcement hardening checks passed.");
