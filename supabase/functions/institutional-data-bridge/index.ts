import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";

const RENTAL_RPC: Record<string, string> = {
  record_rental_municipal_receipt: "service_bridge_record_rental_municipal_receipt",
  set_rental_approval: "service_bridge_set_rental_approval",
  log_rental_blocked_event: "service_bridge_log_rental_blocked_event",
};

const FINANCE_RPC: Record<string, { rpc: string; permission: "finance.read" | "finance.write" }> = {
  finance_budget_snapshot: { rpc: "service_bridge_finance_budget_snapshot", permission: "finance.read" },
  finance_create_budget_draft: { rpc: "service_bridge_finance_create_budget_draft", permission: "finance.write" },
  finance_upsert_budget_line: { rpc: "service_bridge_finance_upsert_budget_line", permission: "finance.write" },
  finance_set_budget_amount: { rpc: "service_bridge_finance_set_budget_amount", permission: "finance.write" },
};

function currentMuseoProjectRef() {
  const explicit = Deno.env.get("MUSEO_PROJECT_REF");
  if (explicit) return explicit;
  const url = new URL(Deno.env.get("SUPABASE_URL") || "https://invalid.local");
  return url.hostname.split(".")[0];
}

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
    if (!instituvaUrl || !instituvaServiceKey) {
      return json({ error: "Puente Instituva no configurado en el servidor." }, 503);
    }

    const financeAction = FINANCE_RPC[kind];
    if (financeAction) {
      const { profile, user } = await requirePermission(req, financeAction.permission);
      const instituva = createClient(instituvaUrl, instituvaServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      const args: Record<string, unknown> = {
        p_museo_project_ref: currentMuseoProjectRef(),
        p_museum_id: profile.museum_id,
        p_museo_user_id: user.id,
      };
      if (kind === "finance_budget_snapshot") {
        args.p_budget_version_id = payload.p_budget_version_id ?? null;
      } else if (kind === "finance_create_budget_draft") {
        args.p_request_key = payload.p_request_key;
        args.p_title = payload.p_title;
      } else if (kind === "finance_upsert_budget_line") {
        Object.assign(args, payload);
      } else if (kind === "finance_set_budget_amount") {
        Object.assign(args, payload);
      }
      const { data, error } = await instituva.rpc(financeAction.rpc, args);
      if (error) return json({ error: error.message || "Instituva rechazó la operación." }, 400);
      return json(data);
    }

    if (!organizationId) {
      return json({ error: "Puente Instituva no configurado en el servidor." }, 503);
    }

    const permission = "rentals.manage";
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
