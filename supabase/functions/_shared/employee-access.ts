export const EMPLOYEE_LOGIN_REDIRECT = "https://mmdpr.org/login";
export const ACCESS_EMAIL_COOLDOWN_MS = 60_000;

export function cleanEmployeeId(value: unknown) {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("INVALID_EMPLOYEE");
  }
  return id;
}

export function cleanRequestId(value: unknown) {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("INVALID_REQUEST");
  }
  return id;
}

export async function getEmployeeAccessTarget(admin: any, museumId: string, employeeId: string) {
  const { data: employee, error } = await admin
    .from("employees")
    .select("id,email,first_name,last_name,profile_id")
    .eq("id", employeeId)
    .eq("museum_id", museumId)
    .single();
  if (error || !employee) throw new Error("EMPLOYEE_NOT_FOUND");

  const email = String(employee.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("INVALID_EMPLOYEE_EMAIL");
  if (!employee.profile_id) return { employee, email, authUser: null, status: "no_account" };

  const { data, error: authError } = await admin.auth.admin.getUserById(employee.profile_id);
  if (authError || !data?.user) throw new Error("IDENTITY_LINK_INVALID");
  const authUser = data.user;
  const bannedUntil = authUser.banned_until ? new Date(authUser.banned_until).getTime() : 0;
  const status = bannedUntil > Date.now()
    ? "deactivated"
    : authUser.email_confirmed_at
      ? "active"
      : "invitation_pending";
  return { employee, email, authUser, status };
}

export async function findProcessedRequest(admin: any, museumId: string, employeeId: string, action: string, requestId: string) {
  const { data } = await admin.from("audit_logs")
    .select("id")
    .eq("museum_id", museumId)
    .eq("action", action)
    .contains("new_value", { employee_id: employeeId, request_id: requestId })
    .limit(1);
  return Boolean(data?.length);
}

export async function enforceEmailCooldown(admin: any, museumId: string, employeeId: string, actions: string[]) {
  const { data, error } = await admin.from("audit_logs")
    .select("created_at")
    .eq("museum_id", museumId)
    .in("action", actions)
    .contains("new_value", { employee_id: employeeId })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (data?.[0]?.created_at && Date.now() - new Date(data[0].created_at).getTime() < ACCESS_EMAIL_COOLDOWN_MS) {
    throw new Error("RATE_LIMITED");
  }
}

export async function latestInvitationAt(admin: any, museumId: string, employeeId: string) {
  const { data } = await admin.from("audit_logs")
    .select("created_at")
    .eq("museum_id", museumId)
    .in("action", ["USER_INVITED", "USER_INVITATION_RESENT"])
    .contains("new_value", { employee_id: employeeId })
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.created_at || null;
}

export async function recordAccessAudit(admin: any, museumId: string, actorId: string, action: string, employeeId: string, userId: string | null, requestId: string | null) {
  const { error } = await admin.from("audit_logs").insert({
    museum_id: museumId,
    actor_user_id: actorId,
    action,
    table_name: "employee_access",
    record_id: userId,
    new_value: { employee_id: employeeId, request_id: requestId }
  });
  if (error) throw error;
}

export async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((candidate: any) => String(candidate.email || "").toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new Error("AUTH_DIRECTORY_LIMIT");
}

// Technical access levels only; department/position never authorize access.
export const ACCESS_LEVELS = ["empleado", "ejecutivo", "administrador"];
export function accessLevel(value: unknown) {
  const role = String(value || "").trim().toLowerCase();
  if (!ACCESS_LEVELS.includes(role)) throw new Error("INVALID_ACCESS_LEVEL");
  return role;
}
export async function employeeLevelState(admin: any, museumId: string, employeeId: string) {
  const employeeResult = await admin.from("employees").select("id,museum_id,profile_id,access_level")
    .eq("id", employeeId).eq("museum_id", museumId).single();
  if (employeeResult.error || !employeeResult.data) throw employeeResult.error || new Error("EMPLOYEE_NOT_FOUND");
  const employee = employeeResult.data;
  if (!employee.profile_id) return { employee, role: accessLevel(employee.access_level), conflicting: false, profile: null, roles: [], assignments: [], legacy: true };
  const profileResult = await admin.from("profiles").select("id,museum_id,role,status")
    .eq("id", employee.profile_id).eq("museum_id", museumId).single();
  if (profileResult.error || !profileResult.data) throw profileResult.error || new Error("IDENTITY_LINK_INVALID");
  const profile = profileResult.data;
  const catalog = await admin.from("roles").select("id,code,active").in("code", ACCESS_LEVELS);
  const assignments = await admin.from("user_roles").select("role_id,valid_until")
    .eq("user_id", profile.id).eq("museum_id", museumId);
  const legacy = catalog.error?.code === "PGRST205" && assignments.error?.code === "PGRST205";
  if (!legacy && (catalog.error || assignments.error)) throw catalog.error || assignments.error;
  const roles = legacy ? [] : catalog.data;
  const assigned = legacy ? [] : assignments.data;
  const codes = new Set([accessLevel(profile.role)]);
  for (const assignment of assigned) {
    if (assignment.valid_until && Date.parse(assignment.valid_until) <= Date.now()) continue;
    const role = roles.find((r: any) => r.id === assignment.role_id);
    if (role) codes.add(role.code);
  }
  // has_permission combines assigned grants and profiles.role, so report the highest level.
  const role = [...ACCESS_LEVELS].reverse().find(code => codes.has(code))!;
  return { employee, profile, roles, assignments: assigned, legacy, role, conflicting: codes.size > 1 };
}
export async function levelAudit(admin: any, museumId: string, actorId: string, employeeId: string, action: string, oldRole: string, newRole: string) {
  const probe = await admin.from("audit_logs").select("actor_user_id").limit(0);
  let actorColumn = "actor_user_id";
  if (probe.error) {
    if (!["PGRST204", "42703"].includes(probe.error.code) || !String(probe.error.message).includes("actor_user_id")) throw probe.error;
    actorColumn = "user_id";
  }
  const audit = await admin.from("audit_logs").insert({ museum_id: museumId, [actorColumn]: actorId,
    action, table_name: "employees", record_id: employeeId, old_value: { role: oldRole }, new_value: { role: newRole } });
  if (audit.error) throw audit.error;
}
export async function replaceEmployeeLevel(admin: any, museumId: string, actorId: string, employeeId: string, requested: string, expected: string) {
  const role = accessLevel(requested);
  const state = await employeeLevelState(admin, museumId, employeeId);
  if (state.role !== accessLevel(expected)) throw new Error("ACCESS_LEVEL_CHANGED_RELOAD");
  if (state.profile?.id === actorId) throw new Error("SELF_LEVEL_CHANGE_FORBIDDEN");
  const audit = (action: string) => levelAudit(admin, museumId, actorId, employeeId, action, state.role, role);
  if (!state.profile) {
    await audit("ACCESS_LEVEL_CHANGE_REQUESTED");
    const saved = await admin.from("employees").update({ access_level: role }).eq("id", employeeId)
      .eq("museum_id", museumId).is("profile_id", null).eq("access_level", state.employee.access_level).select("id").single();
    if (saved.error || !saved.data) throw saved.error || new Error("ACCESS_LEVEL_CHANGED_RELOAD");
    await audit("ACCESS_LEVEL_CHANGED");
    return { assigned: true, role };
  }
  const target = state.roles.find((r: any) => r.code === role && r.active);
  if (!state.legacy && !target) throw new Error("INVALID_ACCESS_LEVEL");
  if (!["active", "activo"].includes(state.profile.status)) throw new Error("ACCESS_CHANGE_REQUIRES_ACTIVE_PROFILE");
  // Existing status field serializes changes and closes has_permission during the multi-request write.
  // Never restore access after an incomplete role replacement/audit.
  await audit("ACCESS_LEVEL_CHANGE_REQUESTED");
  const locked = await admin.from("profiles").update({ status: "suspended" }).eq("id", state.profile.id)
    .eq("museum_id", museumId).eq("status", state.profile.status).eq("role", state.profile.role).select("id").single();
  if (locked.error || !locked.data) throw locked.error || new Error("ACCESS_LEVEL_CHANGED_RELOAD");
  try {
    const profileWrite = await admin.from("profiles").update({ role }).eq("id", state.profile.id)
      .eq("museum_id", museumId).eq("status", "suspended").select("id").single();
    if (profileWrite.error || !profileWrite.data) throw profileWrite.error || new Error("PROFILE_UPDATE_FAILED");
    if (!state.legacy) {
      const removed = await admin.from("user_roles").delete().eq("museum_id", museumId).eq("user_id", state.profile.id)
        .in("role_id", state.roles.map((r: any) => r.id));
      if (removed.error) throw removed.error;
      const added = await admin.from("user_roles").upsert({ museum_id: museumId, user_id: state.profile.id,
        role_id: target.id, assigned_by: actorId, valid_until: null }, { onConflict: "museum_id,user_id,role_id" });
      if (added.error) throw added.error;
    }
    const saved = await admin.from("employees").update({ access_level: role }).eq("id", employeeId)
      .eq("museum_id", museumId).eq("profile_id", state.profile.id).select("id").single();
    if (saved.error || !saved.data) throw saved.error || new Error("EMPLOYEE_UPDATE_FAILED");
    const verified = await employeeLevelState(admin, museumId, employeeId);
    if (verified.conflicting || verified.role !== role || verified.employee.access_level !== role) throw new Error("ROLE_ASSIGNMENT_INCOMPLETE");
    await audit("ACCESS_LEVEL_CHANGED");
    const unlocked = await admin.from("profiles").update({ status: state.profile.status }).eq("id", state.profile.id)
      .eq("museum_id", museumId).eq("status", "suspended").eq("role", role).select("id").single();
    if (unlocked.error || !unlocked.data) throw unlocked.error || new Error("PROFILE_RESTORE_FAILED");
    return { assigned: true, role };
  } catch {
    throw new Error("ACCESS_CHANGE_INCOMPLETE_PROFILE_SUSPENDED");
  }
}
