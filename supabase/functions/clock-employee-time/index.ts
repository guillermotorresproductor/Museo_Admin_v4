import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const { admin, user, profile } = await requirePermission(req, "time.clock");
    const body = await req.json();
    const action = String(body.action || "");
    if (!['clock_in', 'clock_out'].includes(action)) return json({ error: "Acción de ponche inválida." }, 400);

    const { data: entry, error } = await admin
      .rpc("clock_employee_time", {
        actor_user_id: user.id,
        actor_museum_id: profile.museum_id,
        requested_action: action
      })
      .single();

    if (error) {
      if (error.message.includes("ALREADY_CLOCKED_IN")) return json({ error: "Ya existe una entrada abierta." }, 409);
      if (error.message.includes("NOT_CLOCKED_IN")) return json({ error: "No existe una entrada abierta." }, 409);
      if (error.message.includes("ACTIVE_EMPLOYEE_REQUIRED")) return json({ error: "No existe un expediente activo vinculado." }, 403);
      throw error;
    }

    return json({ entry }, 200);
  } catch (error) {
    return errorResponse(error);
  }
});
