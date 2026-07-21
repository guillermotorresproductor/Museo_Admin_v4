import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  try {
    const { admin, user, profile } = await requirePermission(req, "users.deactivate");
    const { user_id: userId } = await req.json();
    if (!userId || userId === user.id) return json({ error: "Usuario inválido." }, 400);
    const { data: target } = await admin.from("profiles").select("id,museum_id").eq("id", userId).single();
    if (!target || target.museum_id !== profile.museum_id) return json({ error: "Usuario no encontrado." }, 404);
    const { error: authError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (authError) throw authError;
    await admin.from("profiles").update({ status: "suspended" }).eq("id", userId);
    await admin.from("employees").update({ status: "inactivo" }).eq("auth_user_id", userId).eq("museum_id", profile.museum_id);
    await admin.from("audit_logs").insert({ museum_id: profile.museum_id, actor_user_id: user.id, action: "USER_ACCESS_DEACTIVATED", table_name: "profiles", record_id: userId });
    return json({ deactivated: true });
  } catch (error) { return errorResponse(error); }
});