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
