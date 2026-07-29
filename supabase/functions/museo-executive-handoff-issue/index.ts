import { createClient } from "npm:@supabase/supabase-js@2";
import * as jose from "npm:jose@5.9.6";

const MUSEO_PROJECT_REF = "lonpdmxdvbxuagqxztig";
const MUSEO_URL = Deno.env.get("MUSEO_STAGING_URL") ?? `https://${MUSEO_PROJECT_REF}.supabase.co`;
const MUSEO_ANON_KEY = Deno.env.get("MUSEO_STAGING_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const ALLOWED_DESTINATION = "/administracion/direccion-ejecutiva";
const MAX_PASSWORD_AUTH_AGE_SEC = 120;
const TICKET_TTL_SEC = 120;

function allowedOrigins(): string[] {
  const raw = Deno.env.get("HANDOFF_CORS_ORIGINS") ??
    "http://localhost:8765,http://127.0.0.1:8765,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = allowedOrigins();
  const allow = allowed.includes(origin) ? origin : allowed[0] ?? "http://localhost:8765";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", bytes).then((buf) =>
    Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type AmrEntry = { method: string; timestamp: number };

function parseAmr(raw: unknown): AmrEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const entries: AmrEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const method = String((item as { method?: unknown }).method || "").trim();
    const timestamp = Number((item as { timestamp?: unknown }).timestamp || 0);
    if (!method || !Number.isFinite(timestamp) || timestamp <= 0) continue;
    entries.push({ method, timestamp });
  }
  return entries;
}

function requireRecentPasswordAmr(payload: jose.JWTPayload, nowSec: number) {
  const amr = parseAmr(payload.amr);
  if (amr.length === 0) throw new Error("REAUTH_REQUIRED");

  const passwordEvents = amr.filter((e) => e.method === "password");
  if (passwordEvents.length === 0) throw new Error("REAUTH_REQUIRED");

  const latestPassword = Math.max(...passwordEvents.map((e) => e.timestamp));
  if (nowSec - latestPassword > MAX_PASSWORD_AUTH_AGE_SEC || latestPassword > nowSec + 30) {
    throw new Error("REAUTH_REQUIRED");
  }

  // Reject when the newest AMR event is only a refresh (password must be the recent auth).
  const latestAny = Math.max(...amr.map((e) => e.timestamp));
  const latestEntries = amr.filter((e) => e.timestamp === latestAny);
  const latestIsOnlyRefresh =
    latestEntries.every((e) => e.method === "token_refresh") &&
    !latestEntries.some((e) => e.method === "password");
  if (latestIsOnlyRefresh && latestAny > latestPassword) {
    throw new Error("REAUTH_REQUIRED");
  }

  // Also reject if password is stale relative to a newer token_refresh-only chain.
  const newerRefreshOnly = amr.some(
    (e) => e.method === "token_refresh" && e.timestamp > latestPassword,
  );
  if (newerRefreshOnly) throw new Error("REAUTH_REQUIRED");

  return latestPassword;
}

async function verifyMuseoJwt(token: string) {
  const jwks = jose.createRemoteJWKSet(
    new URL(`${MUSEO_URL}/auth/v1/.well-known/jwks.json`),
  );
  const expectedIssuer = `${MUSEO_URL}/auth/v1`;
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: expectedIssuer,
    audience: "authenticated",
    clockTolerance: 30,
  });

  const sub = String(payload.sub || "");
  if (!sub) throw new Error("AUTH_REQUIRED");

  const iss = String(payload.iss || "");
  if (iss !== expectedIssuer) throw new Error("WRONG_ISSUER");

  const aud = payload.aud;
  const audOk = aud === "authenticated" ||
    (Array.isArray(aud) && aud.includes("authenticated"));
  if (!audOk) throw new Error("AUTH_REQUIRED");

  const exp = Number(payload.exp || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!exp || exp <= now) throw new Error("AUTH_REQUIRED");

  const sessionId = String(
    (payload as { session_id?: unknown }).session_id || payload.sessionId || "",
  );
  if (!sessionId) throw new Error("REAUTH_REQUIRED");

  const ref = String(payload.ref || "");
  if (ref && ref !== MUSEO_PROJECT_REF) throw new Error("WRONG_ISSUER");

  if (!Object.prototype.hasOwnProperty.call(payload, "amr")) {
    throw new Error("REAUTH_REQUIRED");
  }

  const passwordAuthAt = requireRecentPasswordAmr(payload, now);
  return { sub, passwordAuthAt, sessionId, payload };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);

  const instituvaUrl = Deno.env.get("INSTITUVA_SUPABASE_URL");
  const instituvaServiceKey =
    Deno.env.get("INSTITUVA_SERVICE_ROLE_KEY") || Deno.env.get("INSTITUVA_SECRET_KEY");
  const organizationId = Deno.env.get("INSTITUVA_ORGANIZATION_ID");

  if (!instituvaUrl || !instituvaServiceKey || !organizationId || !MUSEO_ANON_KEY) {
    return json(req, { error: "Handoff no configurado en el servidor." }, 503);
  }

  const instituva = createClient(instituvaUrl, instituvaServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const audit = async (
    event_type: string,
    result: "allowed" | "denied" | "error",
    fields: Record<string, unknown> = {},
  ) => {
    const details = { ...(fields.details as object || {}), module: "direccion_ejecutiva" };
    delete (details as { code?: unknown }).code;
    await instituva.from("museo_auth_handoff_audit").insert({
      event_type,
      result,
      museo_project_ref: MUSEO_PROJECT_REF,
      museo_user_id: fields.museo_user_id ?? null,
      instituva_user_id: fields.instituva_user_id ?? null,
      organization_id: fields.organization_id ?? organizationId,
      ticket_id: fields.ticket_id ?? null,
      identity_link_id: fields.identity_link_id ?? null,
      destination: ALLOWED_DESTINATION,
      details,
    });
  };

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      await audit("HANDOFF_ISSUE", "denied", { details: { reason: "missing_bearer" } });
      return json(req, { error: "Debe iniciar sesión." }, 401);
    }
    const token = authorization.slice(7).trim();
    const verified = await verifyMuseoJwt(token);

    const museo = createClient(MUSEO_URL, MUSEO_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await museo.auth.getUser();
    if (userError || !userData.user || userData.user.id !== verified.sub) {
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason: "user_mismatch" },
      });
      return json(req, { error: "Sesión Museo inválida." }, 401);
    }

    const { data: profile, error: profileError } = await museo
      .from("profiles")
      .select("id,museum_id,email,role,status")
      .eq("id", verified.sub)
      .single();

    if (profileError || !profile?.museum_id || profile.status !== "active") {
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason: "inactive_museum_relation" },
      });
      return json(req, { error: "No tiene una relación activa con el museo." }, 403);
    }

    if (profile.role !== "administrador") {
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason: "role_not_administrador", role: profile.role },
      });
      return json(req, { error: "Solo un Administrador autorizado puede abrir este módulo." }, 403);
    }

    const { data: allowed, error: permError } = await museo.rpc("has_permission", {
      requested_permission: "executive.case.read",
    });
    if (permError || allowed !== true) {
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason: "missing_executive_case_read" },
      });
      return json(req, { error: "Sin permiso executive.case.read." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const requestedDest = body?.destination ? String(body.destination) : ALLOWED_DESTINATION;
    if (requestedDest !== ALLOWED_DESTINATION) {
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason: "destination_rejected", requested: requestedDest },
      });
      return json(req, { error: "Destino no permitido." }, 400);
    }

    const code = randomCode();
    const codeHash = await sha256Hex(code);

    const { data: issued, error: issueError } = await instituva.rpc(
      "issue_museo_auth_handoff_ticket",
      {
        p_museo_project_ref: MUSEO_PROJECT_REF,
        p_museo_user_id: verified.sub,
        p_code_hash: codeHash,
        p_ttl_seconds: TICKET_TTL_SEC,
        p_metadata: {
          password_auth_at: verified.passwordAuthAt,
          session_id: verified.sessionId,
          museum_id: profile.museum_id,
        },
      },
    );

    if (issueError || !issued) {
      const msg = issueError?.message || "issue_failed";
      let reason = "issue_failed";
      if (/Vinculación/i.test(msg)) reason = "no_explicit_link";
      else if (/INSTITUVA inactivo/i.test(msg)) reason = "instituva_user_inactive";
      else if (/Membresía/i.test(msg)) reason = "instituva_membership_inactive";
      else if (/executive\.case\.read/i.test(msg)) reason = "instituva_missing_permission";
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason },
      });
      return json(req, { error: "No se pudo emitir el acceso a Dirección Ejecutiva." }, 403);
    }

    const row = Array.isArray(issued) ? issued[0] : issued;
    if (!row?.ticket_id) {
      await audit("HANDOFF_ISSUE", "denied", {
        museo_user_id: verified.sub,
        details: { reason: "empty_issue_result" },
      });
      return json(req, { error: "No se pudo emitir el acceso a Dirección Ejecutiva." }, 403);
    }
    await audit("HANDOFF_ISSUE", "allowed", {
      museo_user_id: verified.sub,
      instituva_user_id: row.instituva_user_id,
      organization_id: row.organization_id,
      ticket_id: row.ticket_id,
      details: { expires_at: row.expires_at },
    });

    return json(req, {
      code,
      destination: ALLOWED_DESTINATION,
      expiresAt: row.expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "REAUTH_REQUIRED") {
      await audit("HANDOFF_ISSUE", "denied", { details: { reason: "password_amr_required" } });
      return json(req, { error: "Debe confirmar su acceso nuevamente." }, 401);
    }
    if (message === "AUTH_REQUIRED" || message === "WRONG_ISSUER") {
      await audit("HANDOFF_ISSUE", "denied", { details: { reason: message.toLowerCase() } });
      return json(req, { error: "Sesión Museo inválida." }, 401);
    }
    console.error("handoff_issue_error", message);
    await audit("HANDOFF_ISSUE", "error", { details: { reason: "server_error" } });
    return json(req, { error: "No se pudo completar la operación." }, 500);
  }
});
