// Staging ONLY. Disposable Supabase Auth sessions and two disposable museums.
// All requests are HTTP using real signed access tokens; never use production keys.
// Required: INSTITUVA_AI_TEST_SERVICE_KEY, INSTITUVA_AI_TEST_ANON_KEY,
// and INSTITUVA_AI_E2E_CONFIRM_STAGING=<exact staging project ref>.
// No model calls, no finance/attendance business-record writes.
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";

const REF="lonpdmxdvbxuagqxztig";
const URL="https://"+REF+".supabase.co";
if(process.env.INSTITUVA_AI_E2E_CONFIRM_STAGING!==REF)
  throw Error("STAGING_EXPLICIT_OPT_IN_REQUIRED: set INSTITUVA_AI_E2E_CONFIRM_STAGING="+REF);
const service=process.env.INSTITUVA_AI_TEST_SERVICE_KEY;
const anon=process.env.INSTITUVA_AI_TEST_ANON_KEY;
if (!service || !anon || service===anon)
  throw Error("STAGING_KEYS_REQUIRED: use separate staging service and anon keys");
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL!==URL)
  throw Error("NOT_STAGING: refused non-staging URL");

const marker="instituva-ai-e2e-"+randomBytes(7).toString("hex");
// Validate staging API surface before creating any disposable organization.
async function preflight(){
  for(const path of [
    "/rest/v1/museums?select=id&limit=0",
    "/rest/v1/profiles?select=id,museum_id,role,status&limit=0",
    "/rest/v1/user_roles?select=user_id,museum_id,role_id&limit=0",
    "/rest/v1/ai_assistant_usage?select=museum_id&limit=0"
  ]){
    const r=await api(path);
    assert.equal(r.status,200,"staging API preflight failed: "+path.split("?")[0]);
  }
}
const museums=[];
const users=[];
const checks=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
async function api(path,{method="GET",token=service,key=token===service?service:anon,body,allowError=false}={}){
  const res=await fetch(URL+path,{
    method,signal:AbortSignal.timeout(25000),
    headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json",
      Prefer:"return=representation"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const value=await res.json().catch(()=>null);
  if (!allowError&&!res.ok)throw Error("STAGING_HTTP_"+res.status+" "+path.split("?")[0]);
  return {status:res.status,data:value};
}
async function setupMuseum(suffix){
  const {data}=await api("/rest/v1/museums",{method:"POST",body:{
    name:marker+"-"+suffix,slug:marker+"-"+suffix,active:true
  }});
  assert.ok(Array.isArray(data)&&data[0]?.id,"fixture museum creation missing");
  museums.push(data[0].id);
  return data[0].id;
}
async function createActor(museum,suffix){
  const email=marker+"-"+suffix+"@example.invalid";
  const password="A9!"+randomBytes(24).toString("base64url");
  const {data:user}=await api("/auth/v1/admin/users",{method:"POST",body:{
    email,password,email_confirm:true,user_metadata:{full_name:"INSTITUVA AI synthetic "+suffix}
  }});
  assert.ok(user?.id,"fixture user creation missing");
  users.push(user.id);
  // Auth's existing on_auth_user_created trigger assigns a baseline role
  // to the DEFAULT museum before any test JWT exists. Remove ONLY the role
  // rows for this newly created synthetic user, before password sign-in.
  const inheritedRoles=await api("/rest/v1/user_roles?user_id=eq."+user.id,{
    method:"DELETE"
  });
  check("synthetic user's default-museum roles removed before sign-in",
    Array.isArray(inheritedRoles.data));
  const noRoles=await api("/rest/v1/user_roles?select=user_id,museum_id&user_id=eq."+user.id);
  check("synthetic user has no inherited role in any museum",
    Array.isArray(noRoles.data)&&noRoles.data.length===0);
  // The new user receives a profile through the existing Auth trigger;
  // updating zero rows must never silently produce a false positive.
  const profileUpdate=await api("/rest/v1/profiles?id=eq."+user.id,{
    method:"PATCH",body:{
      museum_id:museum,role:"empleado",status:"active",
      full_name:"INSTITUVA AI synthetic "+suffix
    }
  });
  check("exactly one synthetic profile reassigned",
    Array.isArray(profileUpdate.data)&&profileUpdate.data.length===1&&
    profileUpdate.data[0].id===user.id&&
    profileUpdate.data[0].museum_id===museum);
  const session=await api("/auth/v1/token?grant_type=password",{
    method:"POST",body:{email,password},token:anon,key:anon
  });
  assert.ok(session.data?.access_token,"signed JWT session missing");
  return {id:user.id,museum,token:session.data.access_token};
}
const post=(path,token,body)=>api(path,{method:"POST",token,key:anon,body,allowError:true});
let failed=false;
try {
  await preflight();
  const a=await setupMuseum("a"),b=await setupMuseum("b");
  const alice=await createActor(a,"alice"),bob=await createActor(b,"bob");
  for(const actor of [alice,bob]){
    const who=await api("/auth/v1/user",{token:actor.token,key:anon});
    check("signed Auth JWT identifies correct user",who.data?.id===actor.id);
    const self=await api("/rest/v1/profiles?select=id,museum_id&id=eq."+actor.id,{
      token:actor.token,key:anon
    });
    check("own profile is visible",self.data?.length===1&&self.data[0]?.museum_id===actor.museum);
    const otherMuseum=actor.museum===a?b:a;
    const foreign=await api("/rest/v1/profiles?select=id&museum_id=eq."+otherMuseum,{
      token:actor.token,key:anon
    });
    check("cross-museum profile invisible",foreign.data?.length===0);
    for(const perm of ["finance.read","attendance.history.read","collections.read","modules.inventory.read","time.read.all","notifications.read.self"]){
      const result=await post("/rest/v1/rpc/has_permission",actor.token,{requested_permission:perm});
      check("ordinary test profile lacks "+perm,result.status===200&&result.data===false);
    }
    const ownProduct=await post("/rest/v1/rpc/ai_assistant_claim_slot_v2",actor.token,{
      p_museum_id:actor.museum,p_mode:"product"
    });
    check("own product quota accepted",ownProduct.status===200&&ownProduct.data===true);
    const forbiddenMuseum=await post("/rest/v1/rpc/ai_assistant_claim_slot_v2",actor.token,{
      p_museum_id:otherMuseum,p_mode:"product"
    });
    check("foreign museum quota denied",forbiddenMuseum.status===403);
    for(const mode of ["finance","attendance"]){
      const permissionDenied=await post("/rest/v1/rpc/ai_assistant_claim_slot_v2",actor.token,{
        p_museum_id:actor.museum,p_mode:mode
      });
      check(mode+" quota denied without permission",permissionDenied.status===403);
      const edgeDenied=await post("/functions/v1/instituva-ai-assistant",actor.token,{
        mode,question:"Verificar una incidencia ficticia sin consultar registros reales",year:2026,
        employee_name:"Prueba Ficticia",day:"2026-11-24"
      });
      check(mode+" Edge HTTP denied before data retrieval",edgeDenied.status===403);
    }
    // Newly-created random museum IDs cannot be on an existing explicit allowlist.
    // Even a valid JWT must fail closed before product knowledge or model invocation.
    const disabledProduct=await post("/functions/v1/instituva-ai-assistant",actor.token,{
      mode:"product",question:"¿Cómo podemos investigar una incidencia en INSTITUVA?"
    });
    check("new museum is denied when absent from AI allowlist",disabledProduct.status===503);
    const wrongMode=await post("/functions/v1/instituva-ai-assistant",actor.token,{
      mode:"delete",question:"Intento de modo no autorizado"
    });
    check("unsupported AI mode is rejected",wrongMode.status===400);
    const collectionsQuotaDenied=await post("/rest/v1/rpc/ai_assistant_claim_collections_slot_v1",actor.token,{
      p_museum_id:actor.museum
    });
    check("collection quota denied without collections.read",collectionsQuotaDenied.status===403);
    const collectionsEdgeDenied=await post("/functions/v1/instituva-ai-assistant",actor.token,{
      mode:"collections",question:"Revisar el conteo de piezas y fotografías ficticias"
    });
    check("collections Edge rejected without collection permission",collectionsEdgeDenied.status===403);
    const inventoryQuotaDenied=await post("/rest/v1/rpc/ai_assistant_claim_inventory_slot_v1",actor.token,{
      p_museum_id:actor.museum
    });
    check("inventory quota denied without modules.inventory.read",inventoryQuotaDenied.status===403);
    const inventoryEdgeDenied=await post("/functions/v1/instituva-ai-assistant",actor.token,{
      mode:"inventory",question:"Revisar cantidad de equipos ficticios en inventario"
    });
    check("inventory Edge rejected without inventory read permission",inventoryEdgeDenied.status===403);
    const schedulesQuotaDenied=await post("/rest/v1/rpc/ai_assistant_claim_schedules_slot_v1",actor.token,{
      p_museum_id:actor.museum
    });
    check("schedules quota denied without time.read.all",schedulesQuotaDenied.status===403);
    const schedulesEdgeDenied=await post("/functions/v1/instituva-ai-assistant",actor.token,{
      mode:"schedules",question:"Diagnóstico de turnos de prueba",start_day:"2026-11-25"
    });
    check("schedules Edge rejected without time.read.all",schedulesEdgeDenied.status===403);
    const notificationsQuotaDenied=await post("/rest/v1/rpc/ai_assistant_claim_notifications_slot_v1",actor.token,{
      p_museum_id:actor.museum
    });
    check("self notifications quota denied without notifications.read.self",notificationsQuotaDenied.status===403);
    const notificationsEdgeDenied=await post("/functions/v1/instituva-ai-assistant",actor.token,{
      mode:"notifications",question:"Investigar notificaciones ficticias no recibidas"
    });
    check("self notifications Edge rejected without permission",notificationsEdgeDenied.status===403);
    const directUsage=await api("/rest/v1/ai_assistant_usage?select=museum_id",{
      token:actor.token,key:anon,allowError:true
    });
    check("usage counter unavailable through client API",directUsage.status===401||directUsage.status===403);
  }
  // Deactivate only one of our own disposable accounts and prove immediate
  // server-side denial; no existing identity or role is touched.
  await api("/rest/v1/profiles?id=eq."+bob.id,{
    method:"PATCH",body:{status:"inactive"}
  });
  const inactiveProduct=await post("/functions/v1/instituva-ai-assistant",bob.token,{
    mode:"product",question:"¿Cómo funciona el diagnóstico institucional?"
  });
  check("inactive fixture denied despite still-signed JWT",inactiveProduct.status===403);
  const inactiveQuota=await post("/rest/v1/rpc/ai_assistant_claim_slot_v2",bob.token,{
    p_museum_id:bob.museum,p_mode:"product"
  });
  check("inactive fixture denied from quota despite still-signed JWT",inactiveQuota.status===403);
  const noAuth=await api("/functions/v1/instituva-ai-assistant",{
    method:"POST",token:anon,key:anon,body:{mode:"product",question:"¿Qué es INSTITUVA?"},
    allowError:true
  });
  check("no signed user JWT is rejected",noAuth.status===401||noAuth.status===403);
  console.log(JSON.stringify({result:"PASS",checks:checks.length,staging:REF,
    auth_sessions:2,museums:2,model_calls:0,operational_writes:0}));
} catch(error){
  failed=true;
  console.error("INSTITUVA AI E2E FAILED:",error instanceof Error?error.message:"unknown");
} finally {
  const cleanupErrors=[];
  const cleanup=async(path,method="DELETE")=>{
    try{await api(path,{method});}catch(e){cleanupErrors.push(path.split("?")[0]+": "+String(e));}
  };
  for(const museum of museums){
    await cleanup("/rest/v1/ai_assistant_usage?museum_id=eq."+museum);
    await cleanup("/rest/v1/user_permissions?museum_id=eq."+museum);
    await cleanup("/rest/v1/audit_logs?museum_id=eq."+museum);
  }
  for(const id of users){
    // Clean only role rows owned by the synthetic Auth IDs created above.
    // They may have been created by existing user-registration triggers.
    await cleanup("/rest/v1/user_roles?user_id=eq."+id);
    await cleanup("/auth/v1/admin/users/"+id);
  }
  for(const museum of museums){
    await cleanup("/rest/v1/museums?id=eq."+museum);
  }
  // Server responses must confirm cleanup; HTTP 204 alone cannot prove
  // a scoped DELETE affected a row. Verify every disposable identity.
  for(const id of users){
    try{
      const authLookup=await api("/auth/v1/admin/users/"+id,{allowError:true});
      if(authLookup.status!==404)cleanupErrors.push("auth user still present or unverified: "+id);
      const roleLookup=await api("/rest/v1/user_roles?select=user_id&user_id=eq."+id);
      if(!Array.isArray(roleLookup.data)||roleLookup.data.length)
        cleanupErrors.push("synthetic role still present or unverified: "+id);
    }catch(e){cleanupErrors.push("user cleanup check failed: "+id+": "+String(e));}
  }
  for(const museum of museums){
    try{
      const profileLookup=await api("/rest/v1/profiles?select=id&museum_id=eq."+museum);
      const museumLookup=await api("/rest/v1/museums?select=id&id=eq."+museum);
      if(!Array.isArray(profileLookup.data)||profileLookup.data.length||
         !Array.isArray(museumLookup.data)||museumLookup.data.length)
        cleanupErrors.push("synthetic museum/profile still present or unverified: "+museum);
    }catch(e){cleanupErrors.push("museum cleanup check failed: "+museum+": "+String(e));}
  }
  if(cleanupErrors.length){
    console.error("TEST-FIXTURE CLEANUP INCOMPLETE",JSON.stringify({
      marker,museums,users,errors:cleanupErrors
    }));
    process.exitCode=1;
  }else{
    console.log("PASS disposable staging fixtures cleaned");
    if(failed)process.exitCode=1;
  }
}
