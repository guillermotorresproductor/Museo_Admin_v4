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
      return json({ role: state.employee.access_profile || state.role, access_profile: state.employee.access_profile,
        requested_role: state.employee.access_level,
        effective_role: state.profile ? state.role : null,
        conflicting: state.employee.access_profile ? false : state.conflicting, source: state.profile ? "server_roles" : "saved_employee_level" });
    }
    let context;
    try { context = await requirePermission(req, "roles.assign"); }
    catch {
      // Gerencia Administrativa puede asignar perfiles de módulos a empleados sin alterar roles técnicos.
      // La RPC mantiene aislamiento por museo, bloqueo de autoasignación y concurrencia optimista.
      context = await requirePermission(req, "employees.create");
    }
    const { caller, admin, profile } = context;
    const state = await employeeLevelState(admin, profile.museum_id, employeeId);
    if (state.employee.profile_id) {
      const target = await getEmployeeAccessTarget(admin, profile.museum_id, employeeId);
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
    const isLegacy = ["empleado", "ejecutivo", "administrador"].includes(body.role_code);
    if (isLegacy && state.employee.access_profile) return json({ error: "Seleccione uno de los diez perfiles de módulos." }, 409);
    const { data, error } = await caller.rpc(isLegacy ? "replace_employee_access_level" : "assign_employee_module_profile", {
      p_employee_id: employeeId, [isLegacy ? "p_role_code" : "p_profile_code"]: body.role_code, p_expected_role: body.expected_role
    });
    if (error) {
      const conflict = ["40001", "40P01", "22023", "PT409"].includes(error.code);
      return json({ error: "No se confirmó el cambio. Recargue el nivel del servidor antes de reintentar.", code: error.code }, error.code === "42501" ? 403 : conflict ? 409 : 500);
    }
    if (data?.assigned !== true) throw new Error("ROLE_ASSIGNMENT_INCOMPLETE");
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
});
