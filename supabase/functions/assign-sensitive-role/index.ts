import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const { admin, user, profile } = await requirePermission(req, "roles.assign");
    const { user_id: userId, role_code: roleCode } = await req.json();
    const { data: target } = await admin.from("profiles").select("id,museum_id").eq("id", userId).single();
    if (!target || target.museum_id !== profile.museum_id) return json({ error: "Usuario no encontrado." }, 404);
    const { data: role } = await admin.from("roles").select("id,code").eq("code", roleCode).eq("active", true).single();
    if (!role) return json({ error: "Rol inválido." }, 400);
    await admin.from("user_roles").upsert({ museum_id: profile.museum_id, user_id: userId, role_id: role.id, assigned_by: user.id });
    await admin.from("audit_logs").insert({ museum_id: profile.museum_id, actor_user_id: user.id, action: "ROLE_ASSIGNED", table_name: "user_roles", record_id: userId, new_value: { role: role.code } });
    return json({ assigned: true, role: role.code });
  } catch (error) { return errorResponse(error); }
});