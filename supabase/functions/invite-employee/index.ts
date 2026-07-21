import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const { admin, user, profile } = await requirePermission(req, "users.invite");
    const body = await req.json();
    const employeeId = String(body.employee_id || "").trim();
    if (!employeeId) return json({ error: "Debe indicar el expediente del empleado." }, 400);

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id,email,first_name,last_name,auth_user_id")
      .eq("id", employeeId)
      .eq("museum_id", profile.museum_id)
      .single();

    if (employeeError || !employee) return json({ error: "No se encontró el empleado." }, 404);
    if (employee.auth_user_id) return json({ error: "Este empleado ya tiene una identidad vinculada." }, 409);

    const email = String(employee.email || "").trim().toLowerCase();
    const fullName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
    if (!email || !email.includes("@")) return json({ error: "El expediente no tiene un correo válido." }, 400);

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName }
    });
    if (inviteError || !invited.user) return json({ error: inviteError?.message || "No se pudo invitar." }, 400);

    try {
      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ museum_id: profile.museum_id, full_name: fullName, email, status: "active" })
        .eq("id", invited.user.id);
      if (profileUpdateError) throw profileUpdateError;

      const { data: linkedEmployee, error: linkError } = await admin
        .from("employees")
        .update({ auth_user_id: invited.user.id, profile_id: invited.user.id })
        .eq("id", employeeId)
        .eq("museum_id", profile.museum_id)
        .is("auth_user_id", null)
        .select("id")
        .single();
      if (linkError || !linkedEmployee) throw linkError || new Error("EMPLOYEE_LINK_FAILED");

      const { data: role, error: roleError } = await admin
        .from("roles")
        .select("id")
        .eq("code", "empleado")
        .single();
      if (roleError || !role) throw roleError || new Error("EMPLOYEE_ROLE_REQUIRED");

      const { error: roleAssignmentError } = await admin.from("user_roles").upsert({
        museum_id: profile.museum_id,
        user_id: invited.user.id,
        role_id: role.id,
        assigned_by: user.id
      });
      if (roleAssignmentError) throw roleAssignmentError;

      const { error: auditError } = await admin.from("audit_logs").insert({
        museum_id: profile.museum_id,
        actor_user_id: user.id,
        action: "USER_INVITED",
        table_name: "profiles",
        record_id: invited.user.id,
        new_value: { employee_id: employeeId, role: "empleado" }
      });
      if (auditError) throw auditError;
    } catch (error) {
      await admin.auth.admin.deleteUser(invited.user.id);
      throw error;
    }

    return json({ user_id: invited.user.id, invited: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
