import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

const actions = ["clock_in", "lunch_out", "lunch_in", "clock_out"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);

  try {
    const { admin, user, profile } = await requirePermission(req, "time.clock");
    const body = await req.json();
    const action = String(body.action || "");
    const presence = body.presence && typeof body.presence === "object" ? body.presence : {};
    if (!actions.includes(action)) return json({ error: "Accion de ponche invalida." }, 400);

    const { data, error } = await admin.rpc("record_employee_attendance", {
      actor_user_id: user.id,
      actor_museum_id: profile.museum_id,
      requested_event: action,
      presence
    });

    const messages: Record<string, [string, number]> = {
        ACTIVE_EMPLOYEE_REQUIRED: ["No existe un expediente activo vinculado.", 403],
        PRESENCE_NOT_CONFIGURED: ["La validacion de presencia aun no esta configurada. Contacte a Recursos Humanos.", 409],
        NO_ASSIGNED_SHIFT: ["No hay un turno asignado para este momento.", 409],
        TOO_EARLY: ["El turno aun no permite registrar asistencia.", 409],
        PRESENCE_VALIDATION_FAILED: ["No se pudo confirmar su presencia fisica en el Museo.", 403],
        INVALID_EVENT_SEQUENCE: ["Este ponche no corresponde al siguiente evento de su jornada.", 409]
    };
    if (error) {
      const match = Object.entries(messages).find(([code]) => error.message.includes(code));
      if (match) return json({ error: match[1][0], code: match[0] }, match[1][1]);
      throw error;
    }

    if (data?.ok === false) {
      const rejection = messages[String(data.code || "")];
      if (rejection) return json({ error: rejection[0], code: data.code, available_at: data.available_at || null }, rejection[1]);
      return json({ error: "No se pudo confirmar el ponche.", code: data.code || "ATTENDANCE_REJECTED" }, 409);
    }

    return json(data, 200);
  } catch (error) {
    return errorResponse(error);
  }
});
