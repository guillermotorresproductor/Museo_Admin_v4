import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

const actions = ["clock_in", "lunch_out", "lunch_in", "clock_out"];

// IT-2026-005: Only a gateway-attested museum egress IP may claim Wi-Fi.
// A browser-supplied SSID, IP, or network_hash is never trusted.
// Default configuration is geolocation only. No Wi-Fi punches until explicit activation.
function trustworthyPublicIpv4(input: string | null): string | null {
  if (!input || !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(input)) return null;
  const octets = input.split(".").map(Number);
  if (octets.some((v) => v > 255)) return null;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c === 0))) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)) return null;
  return octets.join(".");
}

async function museumWifiHash(museumId: string, ip: string): Promise<string> {
  const value = new TextEncoder().encode("instituva-wifi-egress-v1|" + museumId + "|" + ip);
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);

  try {
    const { admin, user, profile } = await requirePermission(req, "time.clock");
    const body = await req.json();
    const action = String(body.action || "");
    if (!actions.includes(action)) return json({ error: "Accion de ponche invalida." }, 400);
    const incomingPresence = body.presence && typeof body.presence === "object" && !Array.isArray(body.presence) ? body.presence : {};
    let verifiedPresence: Record<string, unknown>;
    if (incomingPresence.method === "wifi") {
      // Supabase hosted Cloudflare ingress must overwrite CF-Connecting-IP.
      // Never use x-forwarded-for or client-submitted IP/hash as proof.
      const clientIp = trustworthyPublicIpv4(req.headers.get("cf-connecting-ip"));
      const { data: settings, error: settingsError } = await admin
        .from("attendance_settings")
        .select("presence_required,presence_validation_mode,allowed_wifi_hashes")
        .eq("museum_id", profile.museum_id).maybeSingle();
      if (settingsError) throw settingsError;
      if (!clientIp || !settings?.presence_required ||
          !["any", "wifi"].includes(settings.presence_validation_mode) ||
          !Array.isArray(settings.allowed_wifi_hashes) ||
          settings.allowed_wifi_hashes.length === 0) {
        return json({ error: "Wi-Fi institucional no disponible; utilice GPS.", code: "WIFI_NOT_AVAILABLE" }, 409);
      }
      const hash = await museumWifiHash(profile.museum_id, clientIp);
      if (!settings.allowed_wifi_hashes.includes(hash)) {
        return json({ error: "No se confirmó conexión a la red institucional; utilice GPS.", code: "WIFI_NOT_AVAILABLE" }, 409);
      }
      verifiedPresence = { method: "wifi", network_hash: hash };
    } else if (incomingPresence.method === "geolocation") {
      verifiedPresence = {
        method: "geolocation",
        latitude: incomingPresence.latitude,
        longitude: incomingPresence.longitude,
        accuracy_meters: incomingPresence.accuracy_meters
      };
    } else {
      return json({ error: "Método de presencia inválido.", code: "INVALID_PRESENCE_METHOD" }, 400);
    }

    const { data, error } = await admin.rpc("record_employee_attendance", {
      actor_user_id: user.id,
      actor_museum_id: profile.museum_id,
      requested_event: action,
      presence: verifiedPresence
    });

    const messages: Record<string, [string, number]> = {
        ACTIVE_EMPLOYEE_REQUIRED: ["No existe un expediente activo vinculado.", 403],
        ATTENDANCE_NOT_REQUIRED: ["Este expediente no está sujeto a registro de asistencia.", 403],
        PRESENCE_NOT_CONFIGURED: ["La validacion de presencia aun no esta configurada. Contacte a Recursos Humanos.", 409],
        NO_ASSIGNED_SHIFT: ["No hay un turno asignado para este momento.", 409],
        TOO_EARLY: ["El turno aun no permite registrar asistencia.", 409],
        PRESENCE_VALIDATION_FAILED: ["No se pudo confirmar su presencia fisica en el Museo.", 403],
        PREVIOUS_SHIFT_OPEN: ["Existe una jornada anterior sin cerrar. Contacte a Administración para conciliarla antes del próximo ponche; no se alteró su registro.", 409],
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
