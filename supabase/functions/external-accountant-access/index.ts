import { corsHeaders, json, requirePermission } from "../_shared/security.ts";

// Isolated invitation path: NEVER creates an employee or assigns a privileged role.
// Fail closed for museum URLs not explicitly approved in this deployment.
const portals: Record<string, Record<string, string>> = {
  "https://kfokfjngozgcwjpzxcsu.supabase.co": {
    "a1f597f7-44a2-44b2-9214-93364c2a12ff": "https://mmdpr.org/login"
  },
  "https://lonpdmxdvbxuagqxztig.supabase.co": {
    // Staging uses the institutional test portal, never the production login.
    "*": "https://demo.instituva.com/login.html"
  }
};
const safeEmail = (value: unknown) => {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("INVALID_EMAIL");
  return email;
};
const safeName = (value: unknown) => {
  const name = String(value || "").trim();
  if (name.length < 3 || name.length > 120 || /[<>]/.test(name)) throw Error("INVALID_NAME");
  return name;
};
function deny(error: unknown) {
  const message = String((error as Error)?.message || "");
  if (["AUTH_REQUIRED","FORBIDDEN","PROFILE_REQUIRED"].includes(message)) return json({ error:"No tiene autorización." },403);
  if (["INVALID_EMAIL","INVALID_NAME","INVALID_ACTION"].includes(message)) return json({ error:"Verifique los datos de la solicitud." },400);
  if (["ACCOUNT_CONFLICT","PROFILE_CONFLICT","EMPLOYEE_EMAIL_CONFLICT"].includes(message)) return json({ error:"El correo ya está registrado. Se requiere revisión antes de vincularlo." },409);
  if (message === "ACCOUNT_INCOMPLETE") return json({ error:"La invitación requiere revisión de Administración. No se enviará nuevamente automáticamente." },409);
  if (message === "PORTAL_NOT_CONFIGURED") return json({ error:"El museo aún no tiene un portal de invitación aprobado." },409);
  return json({ error:"No se pudo completar la operación. Verifique el estado antes de repetirla." },500);
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  if (req.method !== "POST") return json({error:"Método no permitido."},405);
  try {
    const body = await req.json();
    const action = String(body.action || "list");
    if (!["list","invite","revoke","verify"].includes(action)) throw Error("INVALID_ACTION");
    const { admin, user, profile } = await requirePermission(req,
      action === "verify" ? "finance.read" : action === "revoke" ? "users.deactivate" : "users.invite");
    if (action !== "list") await requirePermission(req, "roles.assign");
    if (!["active","activo"].includes(profile.status) || !profile.museum_id) throw Error("FORBIDDEN");
    const museum = profile.museum_id;
    const isStaging = (Deno.env.get("SUPABASE_URL") || "").includes("lonpdmxdvbxuagqxztig");
    const activeProfileStatus = isStaging ? "active" : "activo";
    const inactiveProfileStatus = isStaging ? "inactive" : "inactivo";
    if (action === "verify") {
      const member = await admin.from("external_accountant_access")
        .select("id,email,status").eq("user_id",user.id).eq("museum_id",museum)
        .eq("status","active").maybeSingle();
      if (member.error) throw member.error;
      if (!member.data || String(member.data.email).toLowerCase() !== String(user.email).toLowerCase()) {
        throw Error("FORBIDDEN");
      }
      const linked = await admin.from("employees").select("id").eq("profile_id",user.id).limit(1);
      if (linked.error || linked.data?.length) throw Error("FORBIDDEN");
      return json({ verified:true,accountant:true });
    }
    if (action === "list") {
      const result = await admin.from("external_accountant_access")
        .select("id,email,full_name,status,invited_at,revoked_at")
        .eq("museum_id",museum).order("invited_at",{ascending:false});
      if (result.error) throw result.error;
      return json({ accountants: result.data || [] });
    }
    if (action === "revoke") {
      if (body.confirmed !== true) throw Error("INVALID_ACTION");
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error("INVALID_ACTION");
      const current = await admin.from("external_accountant_access")
        .select("id,user_id,status,museum_id").eq("id",id).eq("museum_id",museum).single();
      if (current.error || !current.data || current.data.status !== "active") throw Error("ACCOUNT_CONFLICT");
      // Deny permissions first; a live JWT will not bypass this database guard.
      const revoked = await admin.from("external_accountant_access").update({
        status:"revoked",revoked_at:new Date().toISOString(),revoked_by:user.id
      }).eq("id",id).eq("museum_id",museum).eq("status","active").select("id").maybeSingle();
      if (revoked.error || !revoked.data) throw revoked.error || Error("ACCOUNT_CONFLICT");
      const disabled = await admin.from("profiles").update({status:inactiveProfileStatus})
        .eq("id",current.data.user_id).eq("museum_id",museum).eq("role","empleado");
      if (disabled.error) throw disabled.error; // Revocation remains effective even if profile update fails.
      return json({ revoked:true });
    }
    const email = safeEmail(body.email);
    const fullName = safeName(body.full_name);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const redirect = portals[url]?.[museum] || portals[url]?.["*"];
    if (!redirect) throw Error("PORTAL_NOT_CONFIGURED");
    const existingMember = await admin.from("external_accountant_access")
      .select("id,status").eq("museum_id",museum).eq("email",email).maybeSingle();
    if (existingMember.error) throw existingMember.error;
    if (existingMember.data) throw Error("ACCOUNT_CONFLICT");
    // Reject global identity reuse instead of reassigning an identity to a second museum.
    // Independent museum memberships can later be enabled with an explicitly audited tenant switch.
    for (let page = 1; page < 1000; page++) {
      const { data, error } = await admin.auth.admin.listUsers({page,perPage:1000});
      if (error) throw error;
      if (data.users.some((u) => String(u.email || "").toLowerCase() === email)) throw Error("ACCOUNT_CONFLICT");
      if (data.users.length < 1000) break;
    }
    const employees = await admin.from("employees").select("id").ilike("email",
      email.replace(/[\\%_]/g,"\\$&")).limit(1);
    if (employees.error) throw employees.error;
    if (employees.data?.length) throw Error("EMPLOYEE_EMAIL_CONFLICT");
    const profiles = await admin.from("profiles").select("id").ilike("email",
      email.replace(/[\\%_]/g,"\\$&")).limit(1);
    if (profiles.error) throw profiles.error;
    if (profiles.data?.length) throw Error("PROFILE_CONFLICT");
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo:redirect,data:{full_name:fullName}
    });
    if (invited.error || !invited.data?.user) throw invited.error || Error("ACCOUNT_INCOMPLETE");
    const uid = invited.data.user.id;
    // A revoked membership is inserted BEFORE grants. Any provisioning failure
    // leaves the identity denied and flagged for explicit administrative review.
    const membership = await admin.from("external_accountant_access").insert({
      museum_id:museum,user_id:uid,email,full_name:fullName,
      status:"revoked",invited_by:user.id
    }).select("id").single();
    if (membership.error) throw membership.error;
    const created = await admin.from("profiles").insert({
      id:uid,museum_id:museum,email,full_name:fullName,role:"empleado",status:activeProfileStatus
    });
    if (created.error) throw created.error;
    const permissions = await admin.from("permissions").select("id,code")
      .in("code",["finance.read","finance.export","finance.write"]);
    if (permissions.error || permissions.data?.length !== 3) throw permissions.error || Error("ACCOUNT_INCOMPLETE");
    const grants = permissions.data.map((item) => ({
      museum_id:museum,user_id:uid,permission_id:item.id,
      effect:item.code === "finance.write" ? "deny" : "allow",assigned_by:user.id
    }));
    const granted = await admin.from("user_permissions").insert(grants);
    if (granted.error) throw granted.error;
    const enabled = await admin.from("external_accountant_access").update({status:"active"})
      .eq("id",membership.data.id).eq("museum_id",museum).eq("status","revoked")
      .is("revoked_at",null).select("id").maybeSingle();
    if (enabled.error || !enabled.data) throw enabled.error || Error("ACCOUNT_INCOMPLETE");
    return json({ invited:true,email,portal:redirect });
  } catch (error) {
    // No credentials, PII, tokens or privileged SQL errors in logs.
    console.error("external-accountant-access", { code: "REQUEST_FAILED" });
    return deny(error);
  }
});
