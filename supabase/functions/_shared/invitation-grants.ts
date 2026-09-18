export async function invitationTokenHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function prepareInvitationGrant(admin: any, employeeId: string, museumId: string, actorId: string, requestId: string, redirect: string) {
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const token_hash=await invitationTokenHash(token);
  const inserted=await admin.from('employee_invitation_grants').insert({employee_id:employeeId,museum_id:museumId,issued_by:actorId,request_id:requestId,token_hash}).select('id').single();
  if(inserted.error) throw new Error('INVITATION_PREPARE_FAILED');
  const destination=new URL(redirect);
  destination.hash='invitation_token='+token;
  return {id:inserted.data.id,redirect:destination.href};
}
export async function activateInvitationGrant(admin: any, employeeId: string, userId: string) {
  const r=await admin.rpc('activate_employee_invitation',{p_employee:employeeId,p_user:userId});
  if(r.error) throw new Error('INVITATION_LINK_INVALID');
}
