import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { cleanEmployeeId, cleanRequestId, EMPLOYEE_LOGIN_REDIRECT, enforceEmailCooldown, findProcessedRequest, getEmployeeAccessTarget, latestInvitationAt, recordAccessAudit } from "../_shared/employee-access.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const body = await req.json();
    const action = String(body.action || "status");
    const permission = action === "reactivate" ? "users.deactivate" : "users.invite";
    const { admin, user, profile } = await requirePermission(req, permission);
    const employeeId = cleanEmployeeId(body.employee_id);
    const target = await getEmployeeAccessTarget(admin, profile.museum_id, employeeId);

    if (action === "status") {
      return json({
        email: target.email,
        status: target.status,
        last_invitation_at: await latestInvitationAt(admin, profile.museum_id, employeeId),
        last_sign_in_at: target.authUser?.last_sign_in_at || null
      });
    }

    const requestId = cleanRequestId(body.request_id);
    if (action === "recovery") {
      if (target.status !== "active" || !target.authUser) return json({ error: "La cuenta no está activa." }, 409);
      if (await findProcessedRequest(admin, profile.museum_id, employeeId, "USER_PASSWORD_RECOVERY_SENT", requestId)) return json({ recovery_sent: true, replayed: true });
      await enforceEmailCooldown(admin, profile.museum_id, employeeId, ["USER_PASSWORD_RECOVERY_SENT"]);
      const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo: EMPLOYEE_LOGIN_REDIRECT });
      if (error) return json({ error: "No se pudo enviar el enlace de recuperación." }, 400);
      await recordAccessAudit(admin, profile.museum_id, user.id, "USER_PASSWORD_RECOVERY_SENT", employeeId, target.authUser.id, requestId);
      return json({ recovery_sent: true });
    }

    if (action === "reactivate") {
      if (body.confirmed !== true) return json({ error: "Debe confirmar la reactivación." }, 400);
      if (!target.authUser) return json({ error: "El empleado no tiene una cuenta vinculada." }, 409);
      if (await findProcessedRequest(admin, profile.museum_id, employeeId, "USER_ACCESS_REACTIVATED", requestId)) return json({ reactivated: true, replayed: true });
      if (target.status !== "deactivated") return json({ error: "La cuenta no está desactivada." }, 409);
      const { error: authError } = await admin.auth.admin.updateUserById(target.authUser.id, { ban_duration: "none" });
      if (authError) throw authError;
      const { error: profileError } = await admin.from("profiles").update({ status: "active" }).eq("id", target.authUser.id).eq("museum_id", profile.museum_id);
      if (profileError) {
        await admin.auth.admin.updateUserById(target.authUser.id, { ban_duration: "876000h" });
        throw profileError;
      }
      await recordAccessAudit(admin, profile.museum_id, user.id, "USER_ACCESS_REACTIVATED", employeeId, target.authUser.id, requestId);
      return json({ reactivated: true });
    }

    return json({ error: "Acción no permitida." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
