import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const { admin, profile } = await requirePermission(req, "employees.deactivate");
    const { employee_id: employeeId, status } = await req.json();
    if (!employeeId || !["activo", "inactivo"].includes(status)) return json({ error: "Datos inválidos." }, 400);
    const { data, error } = await admin.from("employees").update({ status }).eq("id", employeeId).eq("museum_id", profile.museum_id).select("id,status").single();
    if (error || !data) return json({ error: "Empleado no encontrado." }, 404);
    return json({ employee: data });
  } catch (error) { return errorResponse(error); }
});