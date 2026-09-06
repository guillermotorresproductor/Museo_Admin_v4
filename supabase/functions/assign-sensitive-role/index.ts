import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { cleanEmployeeId, employeeLevelState } from "../_shared/employee-access.ts";
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
    const { caller } = await requirePermission(req, "roles.assign");
    // Use the caller JWT, never the service-role client: PostgreSQL derives auth.uid().
    const { data, error } = await caller.rpc("replace_employee_access_level", {
      p_employee_id: employeeId, p_role_code: body.role_code, p_expected_role: body.expected_role
    });
    if (error) {
      const conflict = ["40001", "40P01", "22023"].includes(error.code);
      return json({ error: "No se confirmó el cambio. Recargue el nivel del servidor antes de reintentar.", code: error.code }, error.code === "42501" ? 403 : conflict ? 409 : 500);
    }
    if (data?.assigned !== true) throw new Error("ROLE_ASSIGNMENT_INCOMPLETE");
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
});
