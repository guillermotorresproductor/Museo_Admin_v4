import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

const eventTypes = ["clock_in", "lunch_out", "lunch_in", "clock_out"];

function correctionError(error: { message?: string }) {
  const known: Record<string, [string, number]> = {
    ACTIVE_EMPLOYEE_REQUIRED: ["No existe un expediente activo vinculado.", 403],
    SHIFT_NOT_AVAILABLE: ["El turno seleccionado no esta disponible.", 404],
    PROPOSED_TIME_OUTSIDE_SHIFT: ["La hora propuesta esta fuera del periodo permitido para este turno.", 400],
    CORRECTION_WINDOW_EXPIRED: ["El plazo para solicitar esta correccion ha vencido.", 409],
    ORIGINAL_EVENT_MISMATCH: ["El ponche original no corresponde al turno seleccionado.", 400],
    ORIGINAL_EVENT_REQUIRED: ["Seleccione el ponche original que desea corregir.", 400],
    PENDING_CORRECTION_EXISTS: ["Ya existe una solicitud pendiente para ese evento.", 409],
    PENDING_REQUEST_REQUIRED: ["La solicitud ya fue decidida o no esta disponible.", 409],
    SELF_APPROVAL_FORBIDDEN: ["No puede aprobar su propia solicitud.", 403],
    EMPLOYEE_SCOPE_FORBIDDEN: ["No tiene autorizacion sobre este empleado.", 403],
    REASON_REQUIRED: ["Escriba un motivo de al menos cinco caracteres.", 400],
    DECISION_REASON_REQUIRED: ["Escriba el motivo de la decision.", 400]
  };
  const match = Object.entries(known).find(([code]) => String(error.message || "").includes(code));
  return match ? json({ error: match[1][0], code: match[0] }, match[1][1]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "request") {
      const { admin, user, profile } = await requirePermission(req, "attendance.corrections.request");
      const eventType = String(body.event_type || "");
      if (!eventTypes.includes(eventType)) return json({ error: "Tipo de evento invalido." }, 400);
      if (!body.shift_id || !body.proposed_occurred_at) return json({ error: "Turno y hora propuesta son requeridos." }, 400);

      const { data, error } = await admin.rpc("request_attendance_correction", {
        actor_user_id: user.id,
        actor_museum_id: profile.museum_id,
        target_shift_id: body.shift_id,
        target_original_event_id: body.original_event_id || null,
        target_event_type: eventType,
        proposed_occurred_at: body.proposed_occurred_at,
        request_reason: String(body.reason || "")
      });
      if (error) return correctionError(error) || errorResponse(error);
      return json({ request: data }, 201);
    }

    if (action === "decide") {
      const { admin, user, profile } = await requirePermission(req, "attendance.corrections.approve");
      const decision = String(body.decision || "");
      if (!body.request_id || !["approved", "rejected"].includes(decision)) return json({ error: "Decision invalida." }, 400);

      const { data, error } = await admin.rpc("decide_attendance_correction", {
        actor_user_id: user.id,
        actor_museum_id: profile.museum_id,
        target_request_id: body.request_id,
        decision,
        decision_reason: String(body.reason || "")
      });
      if (error) return correctionError(error) || errorResponse(error);
      return json(data, 200);
    }

    return json({ error: "Accion invalida." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
