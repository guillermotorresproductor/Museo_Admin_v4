const url = process.env.SUPABASE_TEST_URL;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const service = process.env.SUPABASE_TEST_SERVICE_KEY;
if (!url || !anon || !service) throw new Error("Missing staging test environment.");
const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const createdUsers = [];
const createdEmployees = [];
const createdTimeEntries = [];
const createdShifts = [];
const testPresence = { method: "geolocation", latitude: 18.2001, longitude: -66.5001, accuracy_meters: 5 };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function api(path, { method="GET", headers={}, body }={}) {
  const response = await fetch(`${url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}
async function createUser(label) {
  const email = `security-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.invalid`;
  const password = `T3st!${crypto.randomUUID()}aA`;
  const { response, data } = await api("/auth/v1/admin/users", { method:"POST", headers:serviceHeaders, body:{email,password,email_confirm:true,user_metadata:{full_name:`Test ${label}`}} });
  assert(response.ok, `Create ${label}: ${JSON.stringify(data)}`); createdUsers.push(data.id); return { id:data.id,email,password };
}
async function signIn(user) {
  const { response, data } = await api("/auth/v1/token?grant_type=password", { method:"POST", headers:{apikey:anon,"Content-Type":"application/json"}, body:{email:user.email,password:user.password} });
  assert(response.ok, `Sign in ${user.email}: ${JSON.stringify(data)}`); return data.access_token;
}
async function roleId(code) { const {data}=await api(`/rest/v1/roles?select=id&code=eq.${code}`,{headers:serviceHeaders}); return data[0].id; }
async function profile(id) { const {data}=await api(`/rest/v1/profiles?select=id,museum_id&id=eq.${id}`,{headers:serviceHeaders}); return data[0]; }
async function assign(user, code) { const p=await profile(user.id); const {response,data}=await api("/rest/v1/user_roles",{method:"POST",headers:{...serviceHeaders,Prefer:"resolution=merge-duplicates"},body:{museum_id:p.museum_id,user_id:user.id,role_id:await roleId(code),assigned_by:user.id}}); assert(response.ok,`Assign ${code}: ${JSON.stringify(data)}`); }
async function permission(token, code) { const {response,data}=await api("/rest/v1/rpc/has_permission",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:{requested_permission:code}}); assert(response.ok,`Permission ${code}`); return data; }
async function createEmployee(user,label) { const p=await profile(user.id); const payload={museum_id:p.museum_id,profile_id:user.id,auth_user_id:user.id,first_name:"Test",last_name:label,position:"Prueba",department:"QA",email:user.email,status:"activo"}; const {response,data}=await api("/rest/v1/employees",{method:"POST",headers:{...serviceHeaders,Prefer:"return=representation"},body:payload}); assert(response.ok,`Employee ${label}: ${JSON.stringify(data)}`); createdEmployees.push(data[0].id); return data[0]; }
async function invoke(name,token,body){return api(`/functions/v1/${name}`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body});}
let failure;
try {
  const employee=await createUser("employee"), finance=await createUser("finance"), admin=await createUser("admin"), hr=await createUser("hr");
  await assign(finance,"finanzas"); await assign(admin,"administrador"); await assign(hr,"recursos_humanos");
  const employeeRecord=await createEmployee(employee,"Employee"); await createEmployee(finance,"Finance"); await createEmployee(admin,"Admin"); await createEmployee(hr,"HR");
  const employeeProfile=await profile(employee.id);
  const settingsSave=await api("/rest/v1/attendance_settings",{method:"POST",headers:{...serviceHeaders,Prefer:"resolution=merge-duplicates"},body:{museum_id:employeeProfile.museum_id,latitude:18.2001,longitude:-66.5001,geofence_radius_meters:100,presence_required:true,presence_validation_mode:"geolocation",updated_by:employee.id}}); assert(settingsSave.response.ok,"Attendance settings: "+JSON.stringify(settingsSave.data));
  const shiftStart=new Date(Date.now()-10*60000).toISOString(),shiftEnd=new Date(Date.now()+8*3600000).toISOString();
  const shiftSave=await api("/rest/v1/employee_shifts",{method:"POST",headers:{...serviceHeaders,Prefer:"return=representation"},body:{museum_id:employeeProfile.museum_id,employee_id:employeeRecord.id,starts_at:shiftStart,ends_at:shiftEnd,shift_type:"regular",created_by:employee.id}}); assert(shiftSave.response.ok,"Attendance shift: "+JSON.stringify(shiftSave.data)); createdShifts.push(shiftSave.data[0].id);
  const employeeToken=await signIn(employee), financeToken=await signIn(finance), adminToken=await signIn(admin), hrToken=await signIn(hr);
  assert(await permission(employeeToken,"employees.read.self")===true,"Employee self permission missing");
  assert(await permission(employeeToken,"time.clock")===true,"Employee time.clock permission missing");
  assert(await permission(employeeToken,"employees.read.all")===false,"Employee received read.all");
  assert(await permission(financeToken,"finance.read")===true,"Finance permission missing");
  assert(await permission(hrToken,"time.read.all")===true,"HR time.read.all permission missing");
  assert(await permission(hrToken,"compensation.manage")===true,"HR compensation permission missing");
  assert(await permission(financeToken,"compensation.read")===false,"Finance received compensation access");
  assert(await permission(financeToken,"employees.medical.read")===false,"Finance received medical access");
  assert(await permission(adminToken,"roles.assign")===true,"Admin role assignment missing");
  assert(await permission(adminToken,"finance.read")===false,"Admin inherited finance access");
  assert(await permission(adminToken,"employees.medical.read")===false,"Admin inherited medical access");
  const own=await api("/rest/v1/employees?select=id",{headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`}}); assert(own.response.ok&&own.data.length===1,"Employee isolation failed");
  const forbiddenInsert=await api("/rest/v1/employees",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`,"Content-Type":"application/json"},body:{museum_id:(await profile(employee.id)).museum_id,first_name:"No",last_name:"Permission",position:"QA",department:"QA",email:"blocked@example.invalid"}}); assert(forbiddenInsert.response.status===403,"Employee insert was not blocked");
  const deniedEdge=await invoke("assign-sensitive-role",employeeToken,{user_id:employee.id,role_code:"supervisor"}); assert(deniedEdge.response.status===403,"Unauthorized Edge Function call was not blocked");
  const deniedInvite=await invoke("invite-employee",employeeToken,{employee_id:createdEmployees[0]}); assert(deniedInvite.response.status===403,"Unauthorized employee invitation was not blocked");
  const directTimeInsert=await api("/rest/v1/employee_time_entries",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`,"Content-Type":"application/json"},body:{museum_id:(await profile(employee.id)).museum_id,employee_id:createdEmployees[0],clock_in:new Date().toISOString(),created_by:employee.id}}); assert(directTimeInsert.response.status===403,"Direct time entry insert was not blocked");
  const failedPresence=await invoke("clock-employee-time",employeeToken,{action:"clock_in",presence:{method:"geolocation",latitude:0,longitude:0}}); assert(failedPresence.response.status===403,"Invalid physical presence was not blocked");
  const clockIn=await invoke("clock-employee-time",employeeToken,{action:"clock_in",presence:testPresence}); assert(clockIn.response.ok&&clockIn.data.event?.event_type==="clock_in","Employee clock in failed");
  const projected=await api("/rest/v1/employee_time_entries?select=id,clock_in,clock_out&employee_id=eq."+employeeRecord.id,{headers:serviceHeaders}); assert(projected.response.ok&&projected.data.length===1,"Time projection was not created"); createdTimeEntries.push(projected.data[0].id);
  const duplicateClockIn=await invoke("clock-employee-time",employeeToken,{action:"clock_in",presence:testPresence}); assert(duplicateClockIn.response.status===409,"Duplicate clock in was not blocked");
  const ownTime=await api(`/rest/v1/employee_time_entries?select=id,clock_in,clock_out&id=eq.${projected.data[0].id}`,{headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`}}); assert(ownTime.response.ok&&ownTime.data.length===1,"Employee could not read own time entry");
  const isolatedTime=await api(`/rest/v1/employee_time_entries?select=id&id=eq.${projected.data[0].id}`,{headers:{apikey:anon,Authorization:`Bearer ${financeToken}`}}); assert(isolatedTime.response.ok&&isolatedTime.data.length===0,"Another employee could read the time entry");
  const hrTime=await api(`/rest/v1/employee_time_entries?select=id&id=eq.${projected.data[0].id}`,{headers:{apikey:anon,Authorization:`Bearer ${hrToken}`}}); assert(hrTime.response.ok&&hrTime.data.length===1,"HR could not read museum attendance");
  const directCompensation=await api("/rest/v1/employee_compensation",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${hrToken}`,"Content-Type":"application/json"},body:{employee_id:createdEmployees[0],museum_id:(await profile(hr.id)).museum_id,compensation_type:"hourly",hourly_rate:37.41,updated_by:hr.id}}); assert(directCompensation.response.status===403,"Direct compensation insert was not blocked");
  const sensitiveSave=await api("/rest/v1/rpc/save_employee_sensitive_details",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${hrToken}`,"Content-Type":"application/json"},body:{target_employee_id:createdEmployees[0],compensation:{compensation_type:"hourly",hourly_rate:"37.41",standard_hours_week:"40",overtime_eligible:"true",bonus_type:"none"},emergency_contact:{full_name:"Emergency Test",relationship:"Friend",primary_phone:"7875550101"}}}); assert(sensitiveSave.response.ok&&sensitiveSave.data.saved===true,"Sensitive compensation save failed");
  const hrCompensation=await api(`/rest/v1/employee_compensation?select=employee_id,hourly_rate&employee_id=eq.${createdEmployees[0]}`,{headers:{apikey:anon,Authorization:`Bearer ${hrToken}`}}); assert(hrCompensation.response.ok&&hrCompensation.data.length===1&&Number(hrCompensation.data[0].hourly_rate)===37.41,"HR could not read compensation");
  const financeCompensation=await api(`/rest/v1/employee_compensation?select=employee_id&employee_id=eq.${createdEmployees[0]}`,{headers:{apikey:anon,Authorization:`Bearer ${financeToken}`}}); assert(financeCompensation.response.ok&&financeCompensation.data.length===0,"Finance could read compensation");
  const sensitiveAudit=await api(`/rest/v1/audit_logs?select=old_value,new_value&record_id=eq.${createdEmployees[0]}&action=eq.UPDATE_SENSITIVE_EMPLOYEE_DETAILS`,{headers:serviceHeaders}); assert(sensitiveAudit.response.ok&&sensitiveAudit.data.length===1&&!JSON.stringify(sensitiveAudit.data).includes("37.41"),"Sensitive audit exposed salary");
  const lunchOut=await invoke("clock-employee-time",employeeToken,{action:"lunch_out",presence:testPresence}); assert(lunchOut.response.ok&&lunchOut.data.event?.event_type==="lunch_out","Lunch out failed");
  const lunchIn=await invoke("clock-employee-time",employeeToken,{action:"lunch_in",presence:testPresence}); assert(lunchIn.response.ok&&lunchIn.data.event?.event_type==="lunch_in","Lunch in failed");
  const clockOut=await invoke("clock-employee-time",employeeToken,{action:"clock_out",presence:testPresence}); assert(clockOut.response.ok&&clockOut.data.event?.event_type==="clock_out","Employee clock out failed");
  const timeAudits=await api(`/rest/v1/audit_logs?select=id&actor_user_id=eq.${employee.id}&action=eq.ATTENDANCE_EVENT_RECORDED`,{headers:serviceHeaders}); assert(timeAudits.response.ok&&timeAudits.data.length===4,"Time clock audit trail is incomplete");
  const allowedEdge=await invoke("assign-sensitive-role",adminToken,{user_id:employee.id,role_code:"supervisor"}); assert(allowedEdge.response.ok,"Authorized role assignment failed");
  const statusEdge=await invoke("set-employee-status",adminToken,{employee_id:createdEmployees[0],status:"inactivo"}); assert(statusEdge.response.ok&&statusEdge.data.employee.status==="inactivo","Authorized employee deactivation failed");
  await api(`/rest/v1/employees?id=eq.${createdEmployees[0]}`,{method:"DELETE",headers:{apikey:anon,Authorization:`Bearer ${adminToken}`}});
  const stillPresent=await api(`/rest/v1/employees?select=id&id=eq.${createdEmployees[0]}`,{headers:serviceHeaders}); assert(stillPresent.response.ok&&stillPresent.data.length===1,"Physical employee delete was not blocked");
  console.log(JSON.stringify({passed:true,checks:31}));
} catch (error) { failure=error; }
finally {
  for (const id of createdEmployees) await api(`/rest/v1/employee_compensation?employee_id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdEmployees) await api(`/rest/v1/employee_emergency_contacts?employee_id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  if (createdTimeEntries.length) await api(`/rest/v1/audit_logs?record_id=in.(${createdTimeEntries.join(",")})`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdTimeEntries) await api(`/rest/v1/employee_time_entries?id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  if (createdEmployees.length) await api(`/rest/v1/audit_logs?record_id=in.(${createdEmployees.join(",")})`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdEmployees) await api(`/rest/v1/employees?id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdUsers) await api(`/rest/v1/audit_logs?actor_user_id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdUsers) await api(`/auth/v1/admin/users/${id}`,{method:"DELETE",headers:serviceHeaders});
}
if (failure) throw failure;