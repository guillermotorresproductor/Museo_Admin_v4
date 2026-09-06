import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { cleanEmployeeId, cleanRequestId, findProcessedRequest, getEmployeeAccessTarget, recordAccessAudit } from "../_shared/employee-access.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const { admin, user, profile } = await requirePermission(req, "users.deactivate");
    const body = await req.json();
    if (body.confirmed !== true) return json({ error: "Debe confirmar la desactivación." }, 400);
    const employeeId = cleanEmployeeId(body.employee_id);
    const requestId = cleanRequestId(body.request_id);
    const target = await getEmployeeAccessTarget(admin, profile.museum_id, employeeId);
    const userId = target.authUser?.id;
    if (!userId || userId === user.id) return json({ error: "Usuario inválido." }, 400);
    if (await findProcessedRequest(admin, profile.museum_id, employeeId, "USER_ACCESS_DEACTIVATED", requestId)) return json({ deactivated: true, replayed: true });
    if (target.status === "deactivated") return json({ deactivated: true, already_deactivated: true });
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (authError) throw authError;
    const { error: profileError } = await admin.from("profiles").update({ status: "suspended" }).eq("id", userId).eq("museum_id", profile.museum_id);
    if (profileError) {
      await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      throw profileError;
    }
    await recordAccessAudit(admin, profile.museum_id, user.id, "USER_ACCESS_DEACTIVATED", employeeId, userId, requestId);
    return json({ deactivated: true });
  } catch (error) { return errorResponse(error); }
});
