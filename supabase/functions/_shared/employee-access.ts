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
