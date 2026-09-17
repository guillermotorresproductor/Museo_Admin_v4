import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const read = p => fs.readFileSync(new URL(p,import.meta.url),'utf8');
const helpers = stripTypeScriptTypes(read('../functions/_shared/employee-access.ts').replace(/^export /gm,''));
const app = read('../../js/app.js');
function fixture({email=null,level=null,account=null,linked=false,attempt=false,duplicate=false,failAudit=false}={}) {
  const employee={id:'employee',museum_id:'m',profile_id:linked?'user':null,email,access_level:level};
  const tables={employees:[employee,...(duplicate?[{...employee,id:'duplicate'}]:[])],profiles:linked?[{id:'user',museum_id:'m',email}]:[],audit_logs:attempt?[{id:'attempt',museum_id:'m',action:'USER_INVITATION_REQUESTED',new_value:{employee_id:'employee'}}]:[]};
  const admin={auth:{admin:{listUsers:async()=>({data:{users:account?[account]:[]}}),getUserById:async()=>({data:{user:account}})}},from(table){
    let filters=[],single=false;
    const q={select:()=>q,eq:(k,v)=>(filters.push(r=>r[k]===v),q),ilike:(k,v)=>(filters.push(r=>r[k]===v),q),in:(k,v)=>(filters.push(r=>v.includes(r[k])),q),contains:(k,v)=>(filters.push(r=>Object.entries(v).every(([a,b])=>r[k]?.[a]===b)),q),limit:()=>q,order:()=>q,single:()=>(single=true,q),then(resolve){
      const rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));
      return Promise.resolve(table==='audit_logs'&&failAudit?{error:{code:'42501'}}:{data:single?rows[0]:rows}).then(resolve);
    }};return q;
  }};
  const c=vm.createContext({Date});vm.runInContext(helpers,c);
  return {c,admin,employee};
}
test('NULL is an unset requested level, never an effective permission',async()=>{
 const {c,admin}=fixture();const r=await c.employeeLevelState(admin,'m','employee');
 assert.equal(r.role,null);assert.equal(r.profile,null);
});
test('unknown non-null access levels still fail closed',async()=>{
 const {c,admin}=fixture({level:'owner'});await assert.rejects(()=>c.employeeLevelState(admin,'m','employee'),/INVALID_ACCESS_LEVEL/);
});
for (const [name,options,status,canInvite] of [
 ['empty draft',{},'incomplete_record',false],
 ['missing level',{email:'test@example.invalid'},'incomplete_record',false],
 ['ready',{email:'test@example.invalid',level:'empleado'},'no_account',true],
 ['uncertain previous send',{email:'test@example.invalid',level:'empleado',attempt:true},'verification_required',false],
 ['duplicate email',{email:'test@example.invalid',level:'empleado',duplicate:true},'review_required',false],
 ['Auth exists but link missing',{email:'test@example.invalid',level:'empleado',account:{id:'user',email:'test@example.invalid',invited_at:'2026-09-01'}},'link_pending',false],
 ['non-invited Auth exists',{email:'test@example.invalid',level:'empleado',account:{id:'user',email:'test@example.invalid'}},'review_required',false],
 ['linked active',{email:'test@example.invalid',level:'empleado',linked:true,account:{id:'user',email:'test@example.invalid',email_confirmed_at:'2026-09-01'}},'active',false]
]) test(`access status: ${name}`,async()=>{
 const {c,admin}=fixture(options);const r=await c.employeeInvitationState(admin,'m','employee');
 assert.equal(r.status,status);assert.equal(r.can_invite,canInvite);
});
test('audit lookup failure cannot be presented as never invited',async()=>{
 const {c,admin}=fixture({email:'test@example.invalid',level:'empleado',failAudit:true});
 await assert.rejects(()=>c.employeeInvitationState(admin,'m','employee'));
 await assert.rejects(()=>c.latestInvitationAt(admin,'m','employee'));
});
function panel(state,permissions=['users.invite']) {
 const c=vm.createContext({accessState:state,profile:{source:'supabase'},hasPermission:p=>permissions.includes(p),formatAccessDate:()=>'',invitationRepairOnly:false,invitationLinkVerified:false});
 for(const name of ['accessCard','accessEmail','accessStatus','accessLastInvitation','accessLastSignIn','accessInviteButton','accessRecoveryButton','accessDeactivateButton','accessReactivateButton','accessResendButton']) c[name]={};
 const start=app.indexOf('  const renderAccessState = () =>');
 vm.runInContext(app.slice(start,app.indexOf('  const loadAccessState',start))+'\nrenderAccessState();',c);return c;
}
test('draft panel exposes disabled invitation with an explicit status',()=>{
 const c=panel({status:'incomplete_record',can_invite:false});
 assert.equal(c.accessInviteButton.hidden,false);assert.equal(c.accessInviteButton.disabled,true);
 assert.match(c.accessStatus.textContent,/pendiente de completar/);
});
test('ready panel restores the existing invitation action',()=>{
 const c=panel({status:'no_account',can_invite:true});assert.equal(c.accessInviteButton.hidden,false);assert.equal(c.accessInviteButton.disabled,false);
 assert.equal(c.accessInviteButton.textContent,'Enviar invitación');
});
test('unlinked existing Auth exposes repair and never resend',()=>{
 const c=panel({status:'link_pending'});assert.equal(c.accessInviteButton.textContent,'Verificar / reparar vinculación');assert.equal(c.accessResendButton.hidden,true);
});
test('no users.invite permission exposes no invitation',()=>{
 const c=panel({status:'no_account',can_invite:true},['users.deactivate']);assert.equal(c.accessInviteButton.hidden,true);
});

test('Ver perfil saves an unset draft and refreshes invitation readiness without role writes',async()=>{
 const start=app.indexOf('  saveButton?.addEventListener("click"',app.indexOf('async function bindEmployeeProfile()'));
 const callback=app.slice(start,app.indexOf('\n  });',start)+6);
 let handler;const calls=[],messages=[];
 const c=vm.createContext({saveButton:{addEventListener:(_,fn)=>handler=fn},profileSaving:false,profilePhotoReading:false,profilePhotoReadError:false,
 profile:{id:'employee',source:'supabase',acceso:'',correo:''},pendingPhoto:'',document:{querySelectorAll:()=>[]},employeeInitials:()=>'',getSupabaseSession:()=>({access_token:'fixture'}),
 fetchSupabaseProfile:async()=>({museum_id:'m'}),serverLevel:null,serverLevelConflict:false,hasPermission:()=>false,canManageEmployees:()=>true,
 updateSupabaseEmployee:async()=>calls.push('save'),assignSupabaseEmployeeLevel:()=>assert.fail('no role assignment'),
 fetchSupabaseEmployees:async()=>[{id:'employee',source:'supabase',acceso:'',correo:'',foto:''}],getEmployeeRecords:()=>[],saveEmployeeRecords:()=>{},
 updateCurrentUserFromEmployeeCache:()=>{},renderHeader:()=>{},renderInlineIcons:()=>{},bindHeaderActions:()=>{},bindNotificationMenu:()=>{},avatar:null,name:null,position:null,
 loadAccessState:async()=>calls.push('refresh access'),setProfileMessage:(text,type)=>messages.push({text,type})});
 vm.runInContext(callback,c);await handler();
 assert.deepEqual(calls,['save','refresh access']);assert.equal(messages.at(-1).type,'success');
});
