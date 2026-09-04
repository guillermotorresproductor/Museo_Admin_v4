import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { cleanEmployeeId, cleanRequestId, EMPLOYEE_LOGIN_REDIRECT, enforceEmailCooldown, findAuthUserByEmail, findProcessedRequest, getEmployeeAccessTarget, recordAccessAudit } from "../_shared/employee-access.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const { admin, user, profile } = await requirePermission(req, "users.invite");
    const body = await req.json();
    const employeeId = cleanEmployeeId(body.employee_id);
    const requestId = cleanRequestId(body.request_id);
    const action = body.action === "resend" ? "resend" : "invite";
    const target = await getEmployeeAccessTarget(admin, profile.museum_id, employeeId);
    const { employee, email } = target;
    const fullName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();

    const auditAction = action === "resend" ? "USER_INVITATION_RESENT" : "USER_INVITED";
    if (await findProcessedRequest(admin, profile.museum_id, employeeId, auditAction, requestId)) {
      return json({ invited: true, replayed: true });
    }
    await enforceEmailCooldown(admin, profile.museum_id, employeeId, ["USER_INVITED", "USER_INVITATION_RESENT"]);

    if (action === "resend") {
      if (target.status !== "invitation_pending" || !target.authUser) return json({ error: "La cuenta no tiene una invitación pendiente." }, 409);
      const { error: resendError } = await admin.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: EMPLOYEE_LOGIN_REDIRECT }
      });
      if (resendError) return json({ error: "No se pudo reenviar la invitación." }, 400);
      await recordAccessAudit(admin, profile.museum_id, user.id, auditAction, employeeId, target.authUser.id, requestId);
      return json({ invited: true, resent: true });
    }

    if (target.status !== "no_account") return json({ error: "Este empleado ya tiene una identidad vinculada." }, 409);
    if (await findAuthUserByEmail(admin, email)) {
      return json({ error: "Ya existe una cuenta sin vínculo oficial. Requiere conciliación administrativa." }, 409);
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: EMPLOYEE_LOGIN_REDIRECT
    });
    if (inviteError || !invited.user) return json({ error: "No se pudo enviar la invitación." }, 400);

    try {
      const { error: profileUpsertError } = await admin
        .from("profiles")
        .upsert({
          id: invited.user.id,
          museum_id: profile.museum_id,
          full_name: fullName,
          email,
          role: "empleado",
          status: profile.status
        }, { onConflict: "id" });
      if (profileUpsertError) {
        console.error("invite-employee", { code: "PROFILE_PROVISION_FAILED" });
        throw new Error("PROFILE_PROVISION_FAILED");
      }

      const { data: linkedEmployee, error: linkError } = await admin
        .from("employees")
        .update({ profile_id: invited.user.id })
        .eq("id", employeeId)
        .eq("museum_id", profile.museum_id)
        .is("profile_id", null)
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

      await recordAccessAudit(admin, profile.museum_id, user.id, "USER_INVITED", employeeId, invited.user.id, requestId);
    } catch (error) {
      await admin.auth.admin.deleteUser(invited.user.id);
      throw error;
    }

    return json({ invited: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});
