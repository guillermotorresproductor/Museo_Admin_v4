import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { cleanEmployeeId, employeeLevelState, replaceEmployeeLevel } from "../_shared/employee-access.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const body = await req.json();
    const employeeId = cleanEmployeeId(body.employee_id);
    if (body.action === "read") {
      let context;
      try { context = await requirePermission(req, "roles.assign"); }
      catch { context = await requirePermission(req, "employees.read.all"); }
      const state = await employeeLevelState(context.admin, context.profile.museum_id, employeeId);
      return json({ role: state.role, conflicting: state.conflicting, source: state.profile ? "server_roles" : "saved_employee_level" });
    }
    const { admin, user, profile } = await requirePermission(req, "roles.assign");
    return json(await replaceEmployeeLevel(admin, profile.museum_id, user.id, employeeId, body.role_code, body.expected_role));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ACCESS_CHANGE_INCOMPLETE_PROFILE_SUSPENDED") return json({ error: "El cambio no se completó. El acceso permanece suspendido y requiere revisión administrativa.", code }, 409);
    if (["ACCESS_LEVEL_CHANGED_RELOAD", "SELF_LEVEL_CHANGE_FORBIDDEN", "ACCESS_CHANGE_REQUIRES_ACTIVE_PROFILE", "INVALID_ACCESS_LEVEL"].includes(code)) return json({ error: "No se cambió el nivel. Recargue el perfil; los cambios propios o de cuentas suspendidas requieren otro administrador.", code }, 409);
    return errorResponse(error);
  }
});
