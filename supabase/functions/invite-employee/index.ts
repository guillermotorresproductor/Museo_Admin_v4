import { corsHeaders, json, requirePermission } from "../_shared/security.ts";

const messages = {
  invite_failed: "No se envió una invitación en esta operación. Revise los requisitos con Administración.",
  invite_sent_link_pending: "La invitación fue enviada, pero la vinculación está pendiente. Puede reparar la vinculación sin reenviar el correo.",
  invite_sent_linked: "Invitación enviada y vinculación completada. El destinatario puede activar su cuenta.",
  invite_status_unknown: "No se pudo confirmar el envío. Verifique o repare la vinculación antes de considerar otro envío."
};
function result(code: keyof typeof messages, stage: string, status = 200) {
  return json({ code, stage, message: messages[code] }, status);
}
function logFailure(stage: string, error: unknown) {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  // Only technical fields: never serialize requests, users, sessions or credentials.
  const redact = (value: unknown) => String(value || "").replace(/Bearer\s+\S+|eyJ[A-Za-z0-9_.-]+/gi, "[REDACTED]")
    .replace(/(access_token|refresh_token|token_hash|password|code_verifier)[=:"\s]+[^\s,;&}]+/gi, "$1=[REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]").slice(0, 1500);
  console.error("invite-employee", { stage, code: redact(e?.code || "INTERNAL"), detail: redact(e?.message), details: redact(e?.details), hint: redact(e?.hint) });
}
function invitationRedirect() {
  const project = Deno.env.get("SUPABASE_URL") || "";
  const environments: Record<string, string[]> = {
    "https://kfokfjngozgcwjpzxcsu.supabase.co": ["https://mmdpr.org/login.html"],
    "https://lonpdmxdvbxuagqxztig.supabase.co": ["https://demo.instituva.com/login.html"],
    // 5173 is the documented local Vite port; 3000 is the local Auth site port.
    "http://127.0.0.1:54321": ["http://localhost:3000/login.html", "http://localhost:5173/login.html"],
    "http://localhost:54321": ["http://localhost:3000/login.html", "http://localhost:5173/login.html"],
    "http://kong:8000": ["http://localhost:3000/login.html", "http://localhost:5173/login.html"]
  };
  const allowed = environments[project];
  const destination = Deno.env.get("INVITE_REDIRECT_URL") || allowed?.[0];
  if (!allowed || !destination || !allowed.includes(destination)) throw new Error("REDIRECT_CONFIGURATION");
  return destination;
}
function missingAuditActor(error: { code?: string; message?: string }) {
  return (error.code === "PGRST204" && error.message === "Could not find the 'actor_user_id' column of 'audit_logs' in the schema cache") ||
    (error.code === "42703" && error.message === "column audit_logs.actor_user_id does not exist");
}
async function auditId(userId: string, employeeId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("invite-employee:" + userId + ":" + employeeId)));
  const hex = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-8" + hex.slice(13,16) + "-a" + hex.slice(17,20) + "-" + hex.slice(20,32);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return result("invite_failed", "validation", 405);
  let stage = "authorization";
  let sent = false;
  let dispatching = false;
  try {
    const { admin, user, profile } = await requirePermission(req, "users.invite");
    stage = "validation";
    const body = await req.json();
    const employeeId = String(body.employee_id || "").trim();
    const repairOnly = body.action === "repair";
    if (!employeeId || (body.action && !["invite", "repair"].includes(body.action))) throw new Error("INVALID_REQUEST");
    const redirectTo = invitationRedirect();
    const { data: employee, error: employeeError } = await admin.from("employees")
      .select("id,email,first_name,last_name,profile_id,museum_id").eq("id", employeeId).eq("museum_id", profile.museum_id).single();
    if (employeeError) throw employeeError;
    if (!employee || employee.museum_id !== profile.museum_id) throw new Error("EMPLOYEE_REQUIRED");
    const email = String(employee.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("INVALID_EMAIL");
    const pattern = email.replace(/[\\%_]/g, "\\$&");
    // Global uniqueness prevents linking the same identity to a second museum/employee.
    const { data: duplicates, error: duplicateError } = await admin.from("employees").select("id").ilike("email", pattern);
    if (duplicateError) throw duplicateError;
    if (duplicates?.length !== 1 || duplicates[0].id !== employeeId) throw new Error("EMAIL_CONFLICT");
    const { data: role, error: roleError } = await admin.from("roles").select("id").eq("code", "empleado").single();
    if (roleError || !role) throw roleError || new Error("ROLE_REQUIRED");

    // Read Auth before every attempt, including repairs and repeated initial requests.
    const matches = [];
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const account of data.users) if (String(account.email || "").trim().toLowerCase() === email) matches.push(account);
      if (data.users.length < 1000) break;
    }
    if (matches.length > 1) throw new Error("AUTH_EMAIL_CONFLICT");
    let account = matches[0];
    const { data: profiles, error: profilesError } = await admin.from("profiles")
      .select("id,museum_id,email,role,status").ilike("email", pattern);
    if (profilesError) throw profilesError;
    if (profiles.length > 1 || (profiles.length && profiles[0].id !== account?.id)) throw new Error("PROFILE_CONFLICT");
    if (employee.profile_id && employee.profile_id !== account?.id) throw new Error("EMPLOYEE_IDENTITY_CONFLICT");
    if (account) {
      if (!account.invited_at) throw new Error("EXISTING_NON_INVITED_ACCOUNT");
      sent = true; // Auth records an earlier invitation; never send it again.
      const existing = profiles[0];
      if (!existing || existing.museum_id !== profile.museum_id || existing.role !== "empleado" || existing.status !== "active") throw new Error("INCOMPATIBLE_PROFILE");
      const { data: links, error: linksError } = await admin.from("employees").select("id").eq("profile_id", account.id);
      if (linksError) throw linksError;
      if (links.some(link => link.id !== employeeId)) throw new Error("IDENTITY_ALREADY_LINKED");
    } else if (repairOnly) {
      return result("invite_status_unknown", "verification", 409);
    }

    // Determine the audit schema before sending. No fallback on errors inside an INSERT/trigger.
    let actorColumn = "actor_user_id";
    const probe = await admin.from("audit_logs").select("actor_user_id").limit(0);
    if (probe.error) {
      if (!missingAuditActor(probe.error)) throw probe.error;
      logFailure("audit_schema", probe.error);
      actorColumn = "user_id";
      const fallback = await admin.from("audit_logs").select("user_id").limit(0);
      if (fallback.error) throw fallback.error;
    }
    if (!account) {
      // Durable one-time dispatch claim, using the existing audit primary key.
      // A concurrent/repeated request may repair, but must never dispatch again.
      const claimId = await auditId("dispatch:" + profile.museum_id + ":" + email, employeeId);
      const claim = await admin.from("audit_logs").insert({
        id: claimId, museum_id: profile.museum_id, [actorColumn]: user.id,
        action: "USER_INVITATION_REQUESTED", table_name: "employees", record_id: employeeId,
        new_value: { employee_id: employeeId }
      });
      if (claim.error) {
        logFailure("verification", claim.error);
        if (claim.error.code === "23505") return result("invite_status_unknown", "verification", 409);
        throw claim.error;
      }
      stage = "send";
      dispatching = true;
      const invitation = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo, data: { full_name: [employee.first_name, employee.last_name].filter(Boolean).join(" ") }
      });
      if (invitation.error) {
        logFailure(stage, invitation.error);
        // Only a definite client rejection proves that this attempt did not send.
        if (invitation.error.status >= 400 && invitation.error.status < 500) return result("invite_failed", stage, 400);
        return result("invite_status_unknown", "verification", 502);
      }
      if (!invitation.data?.user) return result("invite_status_unknown", "verification", 502);
      account = invitation.data.user;
      sent = true;
      dispatching = false;
    }
    stage = "link";
    const userId = account.id;
    const { data: savedProfile, error: profileError } = await admin.from("profiles")
      .update({ museum_id: profile.museum_id, full_name: [employee.first_name, employee.last_name].filter(Boolean).join(" "), email, status: "active" })
      .eq("id", userId).select("id,museum_id").single();
    if (profileError || !savedProfile || savedProfile.museum_id !== profile.museum_id) throw profileError || new Error("PROFILE_REQUIRED");
    if (!employee.profile_id) {
      const link = await admin.from("employees").update({ profile_id: userId }).eq("id", employeeId)
        .eq("museum_id", profile.museum_id).is("profile_id", null).select("id").maybeSingle();
      if (link.error) throw link.error;
      if (!link.data) {
        const current = await admin.from("employees").select("profile_id").eq("id", employeeId).eq("museum_id", profile.museum_id).single();
        if (current.error || current.data?.profile_id !== userId) throw current.error || new Error("LINK_CONFLICT");
      }
    }
    const assignment = await admin.from("user_roles").upsert({
      museum_id: profile.museum_id, user_id: userId, role_id: role.id, assigned_by: user.id
    }, { onConflict: "museum_id,user_id,role_id", ignoreDuplicates: true });
    if (assignment.error) throw assignment.error;
    const verifiedRole = await admin.from("user_roles").select("role_id,valid_until")
      .eq("museum_id", profile.museum_id).eq("user_id", userId).eq("role_id", role.id).single();
    if (verifiedRole.error || !verifiedRole.data || (verifiedRole.data.valid_until && Date.parse(verifiedRole.data.valid_until) <= Date.now()))
      throw verifiedRole.error || new Error("ROLE_ASSIGNMENT_INCOMPLETE");

    stage = "audit";
    const id = await auditId(userId, employeeId);
    const audit = { id, museum_id: profile.museum_id, [actorColumn]: user.id, action: "USER_INVITED",
      table_name: "profiles", record_id: userId, new_value: { employee_id: employeeId, role: "empleado" } };
    const existingAudit = await admin.from("audit_logs").select("id,record_id,museum_id,action,new_value").eq("id", id).maybeSingle();
    if (existingAudit.error) throw existingAudit.error;
    if (!existingAudit.data) {
      const written = await admin.from("audit_logs").insert(audit);
      if (written.error) {
        if (written.error.code !== "23505") throw written.error;
        // Concurrent repair may have written the same deterministic event.
        const check = await admin.from("audit_logs").select("record_id,museum_id,action,new_value").eq("id", id).single();
        if (check.error || check.data?.record_id !== userId || check.data?.museum_id !== profile.museum_id ||
            check.data?.action !== "USER_INVITED" || check.data?.new_value?.employee_id !== employeeId) throw written.error;
      }
    } else if (existingAudit.data.record_id !== userId || existingAudit.data.museum_id !== profile.museum_id ||
        existingAudit.data.action !== "USER_INVITED" || existingAudit.data.new_value?.employee_id !== employeeId) throw new Error("AUDIT_CONFLICT");
    return result("invite_sent_linked", "complete", 200);
  } catch (error) {
    logFailure(stage, error);
    if (sent) return result("invite_sent_link_pending", stage === "audit" ? "audit" : "link", 202);
    if (dispatching) return result("invite_status_unknown", "verification", 502);
    return result("invite_failed", stage, stage === "authorization" ? 403 : 400);
  }
});
