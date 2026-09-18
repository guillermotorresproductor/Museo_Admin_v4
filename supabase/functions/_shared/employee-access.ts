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
  let status = bannedUntil > Date.now()
    ? "deactivated"
    : authUser.email_confirmed_at
      ? "active"
      : "invitation_pending";
  if (status === 'active' && Deno.env.get('EMPLOYEE_INVITATIONS_V2') === 'true') {
    const latest=await admin.from('employee_invitation_grants').select('accepted_at')
      .eq('employee_id',employeeId).eq('auth_user_id',authUser.id).is('revoked_at',null)
      .order('issued_at',{ascending:false}).limit(1);
    if(latest.error)throw latest.error;
    if(latest.data?.length && !latest.data[0].accepted_at)status='password_setup_pending';
  }
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
  const { data, error } = await admin.from("audit_logs")
    .select("created_at")
    .eq("museum_id", museumId)
    .in("action", ["USER_INVITED", "USER_INVITATION_RESENT"])
    .contains("new_value", { employee_id: employeeId })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.created_at || null;
}

// Read-only invitation readiness. Missing HR fields are data, not service errors.
// Never infer an absent Auth identity solely from a missing profile_id.
export async function employeeInvitationState(admin: any, museumId: string, employeeId: string) {
  const { data: employee, error } = await admin.from("employees")
    .select("id,email,profile_id,access_level").eq("id", employeeId).eq("museum_id", museumId).single();
  if (error || !employee) throw error || new Error("EMPLOYEE_NOT_FOUND");
  const email = String(employee.email || "").trim().toLowerCase();
  const missing = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) missing.push("email");
  if (!ACCESS_LEVELS.includes(String(employee.access_level || "").trim().toLowerCase())) missing.push("access_level");
  const base = { email, can_invite: false, missing_fields: missing, last_sign_in_at: null };
  if (missing.includes("email")) return { ...base, status: employee.profile_id ? "review_required" : "incomplete_record" };
  const pattern = email.replace(/[\\%_]/g, "\\$&");
  const duplicates = await admin.from("employees").select("id").ilike("email", pattern);
  const profiles = await admin.from("profiles").select("id,museum_id,email").ilike("email", pattern);
  if (duplicates.error || profiles.error) throw duplicates.error || profiles.error;
  const matches = [];
  for (let page = 1; ; page++) {
    const { data, error: authError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (authError) throw authError;
    matches.push(...data.users.filter((u: any) => String(u.email || "").trim().toLowerCase() === email));
    if (data.users.length < 1000) break;
  }
  const account = matches[0];
  if (duplicates.data?.length !== 1 || duplicates.data[0].id !== employeeId || matches.length > 1
      || profiles.data.length > 1 || profiles.data.some((p: any) => p.id !== account?.id || p.museum_id !== museumId)
      || (employee.profile_id && (employee.profile_id !== account?.id || profiles.data.length !== 1))) {
    return { ...base, status: "review_required" };
  }
  if (account) {
    const links = await admin.from("employees").select("id").eq("profile_id", account.id);
    if (links.error) throw links.error;
    if (links.data.some((e: any) => e.id !== employeeId)) return { ...base, status: "review_required" };
    if (!employee.profile_id) return { ...base, status: account.invited_at ? "link_pending" : "review_required" };
    const target = await getEmployeeAccessTarget(admin, museumId, employeeId);
    return { ...base, status: target.status, last_sign_in_at: target.status==='password_setup_pending'?null:account.last_sign_in_at || null };
  }
  const attempts = await admin.from("audit_logs").select("id").eq("museum_id", museumId)
    .in("action", ["USER_INVITATION_REQUESTED", "USER_INVITED", "USER_INVITATION_RESENT"])
    .contains("new_value", { employee_id: employeeId }).limit(1);
  if (attempts.error) throw attempts.error;
  if (attempts.data?.length) return { ...base, status: "verification_required" };
  return { ...base, status: missing.length ? "incomplete_record" : "no_account", can_invite: missing.length === 0 };
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
  const employeeResult = await admin.from("employees").select("id,museum_id,profile_id,access_level,access_profile")
    .eq("id", employeeId).eq("museum_id", museumId).single();
  if (employeeResult.error || !employeeResult.data) throw employeeResult.error || new Error("EMPLOYEE_NOT_FOUND");
  const employee = employeeResult.data;
  if (!employee.profile_id) return { employee, role: employee.access_level === null ? null : accessLevel(employee.access_level), conflicting: false, profile: null, roles: [], assignments: [], legacy: true };
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
