import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export async function requirePermission(req: Request, permission: string) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  const url = Deno.env.get("SUPABASE_URL")!;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secretKey) throw new Error("SERVER_CONFIGURATION");
  const caller = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new Error("AUTH_REQUIRED");
  const { data: allowed, error: permissionError } = await caller.rpc("has_permission", { requested_permission: permission });
  if (permissionError || allowed !== true) throw new Error("FORBIDDEN");
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("profiles").select("id,museum_id,email,status").eq("id", userData.user.id).single();
  if (profileError || !profile) throw new Error("PROFILE_REQUIRED");
  return { admin, user: userData.user, profile };
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "AUTH_REQUIRED") return json({ error: "Debe iniciar sesión." }, 401);
  if (message === "FORBIDDEN") return json({ error: "No tiene permiso para esta operación." }, 403);
  if (message === "PROFILE_REQUIRED") return json({ error: "La cuenta no tiene un perfil válido." }, 403);
  if (message === "SERVER_CONFIGURATION") return json({ error: "El servicio no está configurado." }, 500);
  if (message === "INVALID_EMPLOYEE" || message === "INVALID_REQUEST") return json({ error: "La solicitud no es válida." }, 400);
  if (message === "EMPLOYEE_NOT_FOUND") return json({ error: "No se encontró el empleado." }, 404);
  if (message === "INVALID_EMPLOYEE_EMAIL") return json({ error: "El expediente no tiene un correo válido." }, 400);
  if (message === "IDENTITY_LINK_INVALID") return json({ error: "El vínculo de acceso requiere revisión administrativa." }, 409);
  if (message === "RATE_LIMITED") return json({ error: "Espere un minuto antes de enviar otro correo." }, 429);
  if (message === "PROFILE_PROVISION_FAILED") return json({ error: "No se pudo preparar el acceso del empleado." }, 500);
  return json({ error: "No se pudo completar la operación." }, 500);
}
