import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);
  try {
    const { admin, user, profile } = await requirePermission(req, "schedules.manage");
    const body = await req.json();
    let operation;
    if (["create_rule", "revise_rule"].includes(body.action) && body.rule) operation = admin.rpc("save_attendance_schedule_rule", { actor_user_id: user.id, actor_museum_id: profile.museum_id, rule_payload: body.rule });
    else if (body.action === "deactivate_rule" && body.rule_id) operation = admin.rpc("deactivate_attendance_schedule_rule", { actor_user_id: user.id, actor_museum_id: profile.museum_id, target_rule_id: body.rule_id, reason: body.reason });
    else if (body.action === "create_exception" && body.exception) operation = admin.rpc("save_attendance_schedule_exception", { actor_user_id: user.id, actor_museum_id: profile.museum_id, exception_payload: body.exception });
    else return json({ error: "Operacion de horario invalida." }, 400);
    const { data, error } = await operation;
    if (error) {
      if (error.message.includes("FORBIDDEN")) return json({ error: "No puede administrar el horario de este empleado." }, 403);
      if (error.message.includes("WEEKDAYS_REQUIRED")) return json({ error: "Seleccione al menos un dia de trabajo." }, 400);
      if (error.message.includes("SCHEDULE_CONFLICT")) return json({ error: "El empleado ya tiene una regla activa incompatible para esas fechas y dias." }, 409);
      if (error.message.includes("ACTIVE_RULE_REQUIRED")) return json({ error: "La regla ya no esta activa." }, 409);
      if (error.message.includes("REASON_REQUIRED") || error.message.includes("INVALID_EXCEPTION")) return json({ error: "Indique un motivo valido y complete los datos de la excepcion." }, 400);
      throw error;
    }
    return json(data, 200);
  } catch (error) {
    return errorResponse(error);
  }
});
