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
const dashboardHtml = fs.readFileSync(path.join(root, "dashboard.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("official nomenclature appears in menu and pages", () => {
  assert.match(appJs, /Boletín de Avisos Institucionales/);
  assert.match(boletinHtml, /Boletín de Avisos Institucionales/);
  assert.match(dashboardHtml, /Boletín de Avisos Institucionales/);
  assert.match(indexHtml, /Boletín de Avisos Institucionales/);
  assert.match(portalHtml, /Boletín de Avisos Institucionales/);
  assert.doesNotMatch(appJs, /Boletín institucional/);
  assert.doesNotMatch(boletinHtml, /Boletín Board|Bulletin Board|Boletín institucional/);
  assert.doesNotMatch(dashboardHtml, /Boletín institucional|Bulletin Board/);
  assert.doesNotMatch(indexHtml, /Boletín Board|Bulletin Board/);
});

test("administrator and executive can publish via RPC gate", () => {
  assert.match(migrationSql, /can_publish_institutional_announcement/);
  assert.match(migrationSql, /is_admin_or_executive_profile/);
  assert.match(migrationSql, /announcements\.publish/);
  assert.match(migrationSql, /r\.code in \('administrador', 'ejecutivo'\)/);
  assert.match(migrationSql, /p\.role in \('administrador', 'ejecutivo'\)/);
  assert.match(appJs, /canPublishInstitutionalAnnouncement/);
  assert.match(appJs, /currentProfileRole === "administrador"/);
  assert.match(appJs, /currentProfileRole === "ejecutivo"/);
});

test("regular employee and ujier cannot publish", () => {
  assert.match(migrationSql, /if not public\.can_publish_institutional_announcement\(\) then/);
  assert.match(migrationSql, /raise exception 'FORBIDDEN'/);
  assert.doesNotMatch(
    migrationSql.slice(
      migrationSql.indexOf("create or replace function public.can_publish_institutional_announcement"),
      migrationSql.indexOf("create or replace function public.can_read_institutional_announcements")
    ),
    /ujier|empleado'/
  );
  assert.match(appJs, /if \(!canPublishInstitutionalAnnouncement\(\)\) \{\s*panel\.hidden = true;/);
});

test("active linked museum recipients are selected; inactive terminated unlinked excluded", () => {
  assert.match(migrationSql, /eligible_institutional_announcement_recipients/);
  assert.match(migrationSql, /e\.status = 'activo'/);
  assert.match(migrationSql, /p\.status = 'active'/);
  assert.match(migrationSql, /linked_employee_blocks_announcements/);
  assert.match(migrationSql, /e\.status is distinct from 'activo'/);
  assert.match(migrationSql, /auth_user_id = p\.id or e\.profile_id = p\.id/);
});

test("other museum cannot read announcement rows", () => {
  assert.match(migrationSql, /museum_id = public\.current_user_museum_id\(\)/);
  assert.match(migrationSql, /a\.museum_id = mid/);
  assert.match(migrationSql, /institutional_announcements_select/);
  assert.doesNotMatch(migrationSql, /app_records/);
});

test("publish creates recipients notifications and audit atomically", () => {
  assert.match(migrationSql, /publish_institutional_announcement/);
  assert.match(migrationSql, /insert into public\.institutional_announcements/);
  assert.match(migrationSql, /insert into public\.institutional_announcement_recipients/);
  assert.match(migrationSql, /insert into public\.employee_notifications/);
  assert.match(migrationSql, /write_institutional_announcement_audit/);
  assert.match(migrationSql, /recipient_count < 1/);
  assert.match(migrationSql, /NO_ELIGIBLE_RECIPIENTS/);
  assert.match(migrationSql, /category.*institutional_announcement|'institutional_announcement'/);
});

test("reading updates only the authenticated recipient", () => {
  assert.match(migrationSql, /mark_institutional_announcement_read/);
  assert.match(migrationSql, /r\.recipient_user_id = actor/);
  assert.match(migrationSql, /n\.recipient_user_id = actor/);
  assert.match(migrationSql, /NOT_A_RECIPIENT/);
  assert.match(supabaseJs, /mark_institutional_announcement_read/);
});

test("no direct delete of published announcements", () => {
  assert.match(migrationSql, /ANNOUNCEMENT_DELETE_FORBIDDEN/);
  assert.match(migrationSql, /protect_institutional_announcement_mutations/);
  assert.match(migrationSql, /ANNOUNCEMENT_CONTENT_IMMUTABLE/);
  assert.match(migrationSql, /archive_institutional_announcement/);
  assert.doesNotMatch(migrationSql, /grant delete on table public\.institutional_announcements/i);
  assert.doesNotMatch(migrationSql, /create policy\s+\w+\s+on public\.institutional_announcements\s+for delete/i);
  assert.doesNotMatch(migrationSql, /create policy\s+\w+\s+on public\.institutional_announcement_recipients\s+for delete/i);
});

test("HR publish UI and bulletin module are wired", () => {
  assert.match(hrHtml, /data-hr-announcement-panel/);
  assert.match(hrHtml, /Publicación institucional/);
  assert.match(hrHtml, /Publicar aviso institucional/);
  assert.match(boletinHtml, /data-announcements-module/);
  assert.match(appJs, /bindHrAnnouncementPublish/);
  assert.match(appJs, /bindAnnouncementsModule/);
  assert.match(appJs, /bindPortalAnnouncementsCard/);
  assert.match(supabaseJs, /publish_institutional_announcement/);
  assert.match(supabaseJs, /list_institutional_announcements/);
});

test("internal helpers are not executable by authenticated clients", () => {
  assert.match(migrationSql, /revoke all on function public\.%s from public, anon, authenticated/);
  assert.match(migrationSql, /write_institutional_announcement_audit\(uuid,uuid,text,jsonb,jsonb\)/);
  assert.match(migrationSql, /eligible_institutional_announcement_recipients\(uuid\)/);
  assert.match(migrationSql, /grant execute on function public\.publish_institutional_announcement\(text, text\) to authenticated;/);
});

test("SESSION_IDLE_MS remains five minutes", () => {
  assert.match(appJs, /const SESSION_IDLE_MS = 5 \* 60 \* 1000;/);
});

console.log("All institutional announcement checks passed.");
