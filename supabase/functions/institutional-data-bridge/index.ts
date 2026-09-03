import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

const RENTAL_RPC: Record<string, string> = {
  record_rental_municipal_receipt: "service_bridge_record_rental_municipal_receipt",
  set_rental_approval: "service_bridge_set_rental_approval",
  log_rental_blocked_event: "service_bridge_log_rental_blocked_event",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || body.type || "rpc");

    const instituvaUrl = Deno.env.get("INSTITUVA_SUPABASE_URL");
    const instituvaServiceKey =
      Deno.env.get("INSTITUVA_SERVICE_ROLE_KEY") || Deno.env.get("INSTITUVA_SECRET_KEY");
    const organizationId = Deno.env.get("INSTITUVA_ORGANIZATION_ID");
    if (!instituvaUrl || !instituvaServiceKey || !organizationId) {
      return json({ error: "Puente Instituva no configurado en el servidor." }, 503);
    }

    const permission = ["executive_snapshot", "executive_action"].includes(kind)
      ? "executive.case.read"
      : "rentals.manage";
    const { profile, user } = await requirePermission(req, permission);
    const email = profile.email || user.email;
    if (!email) return json({ error: "La cuenta no tiene correo para vincular con Instituva." }, 403);

    const instituva = createClient(instituvaUrl, instituvaServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: actorId, error: actorError } = await instituva.rpc(
      "service_bridge_resolve_actor_by_email",
      { p_organization_id: organizationId, p_email: email },
    );
    if (actorError || !actorId) {
      return json(
        {
          error:
            "No hay cuenta Instituva activa con este correo en la organización del museo. Use la misma cuenta en Instituva_App.",
        },
        403,
      );
    }

    if (kind === "executive_snapshot") {
      const { data, error } = await instituva.rpc("service_bridge_executive_snapshot", {
        p_organization_id: organizationId,
        p_actor_user_id: actorId,
      });
      if (error) throw error;
      return json(data);
    }

    if (kind === "executive_action") {
      const caseId = String(body.caseId || "");
      const action = String(body.action || "");
      const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
      if (!/^[0-9a-f-]{36}$/i.test(caseId)) {
        return json({ error: "El asunto ejecutivo no es válido." }, 400);
      }
      if (!["ready", "resubmit", "approve", "reject", "return"].includes(action)) {
        return json({ error: "La acción ejecutiva no es válida." }, 400);
      }
      if (["reject", "return"].includes(action) && !reason) {
        return json({ error: "La decisión requiere un motivo." }, 400);
      }
      const { data, error } = await instituva.rpc("service_bridge_execute_executive_action", {
        p_organization_id: organizationId,
        p_actor_user_id: actorId,
        p_case_id: caseId,
        p_action: action,
        p_reason: reason,
      });
      if (error) throw error;
      return json({ success: Boolean(data) });
    }

    if (kind === "membership_list") {
      const { data, error } = await instituva.rpc("service_bridge_membership_snapshot", {
        p_organization_id: organizationId,
        p_actor_user_id: actorId,
      });
      if (error) throw error;
      return json(data);
    }

    if (kind === "membership_upsert") {
      const member = body.payload ?? body.member;
      if (!member || typeof member !== "object") return json({ error: "Socio inválido." }, 400);
      const { data, error } = await instituva.rpc("service_bridge_upsert_museum_member", {
        p_organization_id: organizationId,
        p_actor_user_id: actorId,
        p_member: member,
      });
      if (error) throw error;
      return json([data]);
    }

    const rpcName = String(body.name || body.rpc || "");
    const bridgeFn = RENTAL_RPC[rpcName];
    if (!bridgeFn) return json({ error: "RPC no admitido en el puente." }, 400);

    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const args: Record<string, unknown> = {
      p_organization_id: organizationId,
      p_actor_user_id: actorId,
    };
    if (rpcName === "record_rental_municipal_receipt") {
      args.p_request_key = payload.p_request_key;
      args.p_receipt_number = payload.p_receipt_number ?? null;
      args.p_internal_production = Boolean(payload.p_internal_production);
    } else if (rpcName === "set_rental_approval") {
      args.p_request_key = payload.p_request_key;
      args.p_approved = Boolean(payload.p_approved);
      args.p_internal_production = Boolean(payload.p_internal_production);
    } else if (rpcName === "log_rental_blocked_event") {
      args.p_request_key = payload.p_request_key;
      args.p_action = payload.p_action;
    }

    const { data, error } = await instituva.rpc(bridgeFn, args);
    if (error) {
      const msg = error.message || "Instituva rechazó la operación.";
      return json({ message: msg, error: msg }, 400);
    }
    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
});
