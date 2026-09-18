import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/security.ts';
import { invitationTokenHash } from '../_shared/invitation-grants.ts';

// New public authentication endpoint: proof is a 256-bit, server-stored-hash,
// single-use invitation, not a pre-existing login session. Existing private
// functions retain JWT verification. Never log request bodies or Auth responses.
Deno.serve(async req=>{
  const reply=(body:unknown,status=200)=>{
    const response=json(body,status);response.headers.set('Cache-Control','no-store');return response;
  };
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return reply({code:'invalid_link'},405);
  let session: any=null;
  let admin: any;
  try {
    if(Number(req.headers.get('content-length')||0)>2048)return reply({code:'invalid_link'},413);
    const rawBody=await req.text();
    if(rawBody.length>2048)return reply({code:'invalid_link'},413);
    const body=JSON.parse(rawBody);
    const url=Deno.env.get('SUPABASE_URL')!;
    admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    if(body.action==='complete') {
      const bearer=req.headers.get('Authorization')||'';
      if(!bearer.startsWith('Bearer ')||(body.invitation_id&&!/^[0-9a-f-]{36}$/.test(body.invitation_id)))return reply({code:'wrong_account'},401);
      const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false},global:{headers:{Authorization:bearer}}});
      const user=await caller.auth.getUser();
      if(user.error||!user.data.user)return reply({code:'wrong_account'},401);
      let invitationId=body.invitation_id;
      if(!invitationId) {
        // Recovery after an interrupted setup can finish the same grant only
        // after a new password and the original identity have been verified.
        const pending=await admin.from('employee_invitation_grants').select('id')
          .eq('auth_user_id',user.data.user.id).is('revoked_at',null).is('accepted_at',null)
          .not('redeemed_at','is',null).order('issued_at',{ascending:false}).limit(1);
        if(pending.error)return reply({code:'acceptance_failed'},409);
        invitationId=pending.data?.[0]?.id;
        if(!invitationId)return reply({accepted:true});
      }
      const completed=await admin.rpc('complete_employee_invitation',{p_id:invitationId,p_user:user.data.user.id});
      if(completed.error)return reply({code:'acceptance_failed'},409);
      return reply({accepted:true});
    }
    if(body.action!=='redeem'||!/^[0-9a-f]{64}$/.test(body.invitation_token||''))return reply({code:'invalid_link'},400);
    const claim=crypto.randomUUID();
    const claimed=await admin.rpc('claim_employee_invitation',{p_hash:await invitationTokenHash(body.invitation_token),p_claim:claim});
    body.invitation_token=null;
    if(claimed.error)return reply({code:'invalid_employee'},409);
    const grant=claimed.data;
    if(grant?.code!=='claimed')return reply({code:grant?.code||'invalid_link'},409);
    const account=await admin.auth.admin.getUserById(grant.user_id);
    if(account.error||!account.data.user)return reply({code:'invalid_employee'},409);
    const type=account.data.user.email_confirmed_at?'recovery':'invite';
    // Mint a fresh short-lived Auth proof only AFTER verifying the 24h grant.
    // This sends no additional email and never changes the account's role.
    const link=await admin.auth.admin.generateLink({type,email:account.data.user.email});
    if(link.error||link.data.user?.id!==grant.user_id)throw new Error('EXCHANGE_FAILED');
    // verifyOtp installs the recipient session in its client. Keep the service
    // client separate so subsequent service-only RPCs retain their identity.
    const verifier=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const verified=await verifier.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type});
    session=verified.data?.session;
    if(verified.error||session?.user?.id!==grant.user_id)throw new Error('EXCHANGE_FAILED');
    // Confirm effective role using the recipient session, including legacy RBAC.
    const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${session.access_token}`}}});
    const permissions=await caller.rpc('current_user_permissions');
    if(permissions.error||!permissions.data?.length)throw new Error('ROLE_INVALID');
    const finished=await admin.rpc('finish_employee_invitation',{p_id:grant.id,p_claim:claim});
    if(finished.error)throw new Error('LINK_CHANGED');
    return reply({access_token:session.access_token,refresh_token:session.refresh_token,user:{id:grant.user_id},setup_type:'invite',invitation_id:grant.id});
  } catch (error) {
    // Only fixed internal stage names; never include provider errors or payloads.
    const stage=error instanceof Error&&['EXCHANGE_FAILED','ROLE_INVALID','LINK_CHANGED'].includes(error.message)?error.message:'INTERNAL';
    console.error(JSON.stringify({event:'invitation_exchange_failed',stage}));
    // A lost/failed exchange is not retried with the same grant. Recovery or a
    // new administrative invitation is required; no silent second session.
    if(session?.access_token&&admin)await admin.auth.admin.signOut(session.access_token,'local').catch(()=>{});
    return reply({code:'request_failed'},503);
  }
});
