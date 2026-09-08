import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { cleanEmployeeId, employeeLevelState, getEmployeeAccessTarget } from "../_shared/employee-access.ts";
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
    const { caller, admin, profile } = await requirePermission(req, "roles.assign");
    const target = await getEmployeeAccessTarget(admin, profile.museum_id, employeeId);
    if (target.employee.profile_id) {
      const linked = await admin.from("employees").select("id").eq("profile_id", target.employee.profile_id);
      const targetProfile = await admin.from("profiles").select("email,museum_id").eq("id", target.employee.profile_id).single();
      if (linked.error || targetProfile.error || linked.data?.length !== 1
          || targetProfile.data?.museum_id !== profile.museum_id
          || String(target.authUser?.email || "").trim().toLowerCase() !== target.email
          || String(targetProfile.data?.email || "").trim().toLowerCase() !== target.email) {
        throw new Error("IDENTITY_LINK_INVALID");
      }
    }
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
