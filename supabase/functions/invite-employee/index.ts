import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const { admin, user, profile } = await requirePermission(req, "users.invite");
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const employeeId = body.employee_id ? String(body.employee_id) : null;
    const roleCode = String(body.role_code || "empleado");
    if (!email || !email.includes("@")) return json({ error: "Correo inválido." }, 400);
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (inviteError || !invited.user) return json({ error: inviteError?.message || "No se pudo invitar." }, 400);
    await admin.from("profiles").update({ museum_id: profile.museum_id, full_name: fullName, email, status: "active" }).eq("id", invited.user.id);
    if (employeeId) {
      const { error } = await admin.from("employees").update({ auth_user_id: invited.user.id, profile_id: invited.user.id }).eq("id", employeeId).eq("museum_id", profile.museum_id);
      if (error) throw error;
    }
    const { data: role } = await admin.from("roles").select("id").eq("code", roleCode).single();
    if (role) await admin.from("user_roles").upsert({ museum_id: profile.museum_id, user_id: invited.user.id, role_id: role.id, assigned_by: user.id });
    await admin.from("audit_logs").insert({ museum_id: profile.museum_id, actor_user_id: user.id, action: "USER_INVITED", table_name: "profiles", record_id: invited.user.id, new_value: { email, employee_id: employeeId, role: roleCode } });
    return json({ user_id: invited.user.id, invited: true }, 201);
  } catch (error) { return errorResponse(error); }
});