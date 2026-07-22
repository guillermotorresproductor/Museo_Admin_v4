import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);
  try {
    const { admin, user, profile } = await requirePermission(req, "schedules.manage");
    const body = await req.json();
    if (body.action !== "create_rule" || !body.rule) return json({ error: "Operacion de horario invalida." }, 400);
    const { data, error } = await admin.rpc("save_attendance_schedule_rule", {
      actor_user_id: user.id,
      actor_museum_id: profile.museum_id,
      rule_payload: body.rule
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) return json({ error: "No puede administrar el horario de este empleado." }, 403);
      if (error.message.includes("WEEKDAYS_REQUIRED")) return json({ error: "Seleccione al menos un dia de trabajo." }, 400);
      throw error;
    }
    return json(data, 200);
  } catch (error) {
    return errorResponse(error);
  }
});
