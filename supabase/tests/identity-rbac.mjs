const url = process.env.SUPABASE_TEST_URL;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const service = process.env.SUPABASE_TEST_SERVICE_KEY;
if (!url || !anon || !service) throw new Error("Missing staging test environment.");
const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const createdUsers = [];
const createdEmployees = [];
const createdTimeEntries = [];
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
  await createEmployee(employee,"Employee"); await createEmployee(finance,"Finance"); await createEmployee(admin,"Admin"); await createEmployee(hr,"HR");
  const employeeToken=await signIn(employee), financeToken=await signIn(finance), adminToken=await signIn(admin), hrToken=await signIn(hr);
  assert(await permission(employeeToken,"employees.read.self")===true,"Employee self permission missing");
  assert(await permission(employeeToken,"time.clock")===true,"Employee time.clock permission missing");
  assert(await permission(employeeToken,"employees.read.all")===false,"Employee received read.all");
  assert(await permission(financeToken,"finance.read")===true,"Finance permission missing");
  assert(await permission(hrToken,"time.read.all")===true,"HR time.read.all permission missing");
  assert(await permission(financeToken,"employees.medical.read")===false,"Finance received medical access");
  assert(await permission(adminToken,"roles.assign")===true,"Admin role assignment missing");
  assert(await permission(adminToken,"finance.read")===false,"Admin inherited finance access");
  assert(await permission(adminToken,"employees.medical.read")===false,"Admin inherited medical access");
  const own=await api("/rest/v1/employees?select=id",{headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`}}); assert(own.response.ok&&own.data.length===1,"Employee isolation failed");
  const forbiddenInsert=await api("/rest/v1/employees",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`,"Content-Type":"application/json"},body:{museum_id:(await profile(employee.id)).museum_id,first_name:"No",last_name:"Permission",position:"QA",department:"QA",email:"blocked@example.invalid"}}); assert(forbiddenInsert.response.status===403,"Employee insert was not blocked");
  const deniedEdge=await invoke("assign-sensitive-role",employeeToken,{user_id:employee.id,role_code:"supervisor"}); assert(deniedEdge.response.status===403,"Unauthorized Edge Function call was not blocked");
  const deniedInvite=await invoke("invite-employee",employeeToken,{employee_id:createdEmployees[0]}); assert(deniedInvite.response.status===403,"Unauthorized employee invitation was not blocked");
  const directTimeInsert=await api("/rest/v1/employee_time_entries",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`,"Content-Type":"application/json"},body:{museum_id:(await profile(employee.id)).museum_id,employee_id:createdEmployees[0],clock_in:new Date().toISOString(),created_by:employee.id}}); assert(directTimeInsert.response.status===403,"Direct time entry insert was not blocked");
  const clockIn=await invoke("clock-employee-time",employeeToken,{action:"clock_in"}); assert(clockIn.response.ok&&clockIn.data.entry?.clock_in&&!clockIn.data.entry?.clock_out,"Employee clock in failed"); createdTimeEntries.push(clockIn.data.entry.id);
  const duplicateClockIn=await invoke("clock-employee-time",employeeToken,{action:"clock_in"}); assert(duplicateClockIn.response.status===409,"Duplicate clock in was not blocked");
  const ownTime=await api(`/rest/v1/employee_time_entries?select=id,clock_in,clock_out&id=eq.${clockIn.data.entry.id}`,{headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`}}); assert(ownTime.response.ok&&ownTime.data.length===1,"Employee could not read own time entry");
  const isolatedTime=await api(`/rest/v1/employee_time_entries?select=id&id=eq.${clockIn.data.entry.id}`,{headers:{apikey:anon,Authorization:`Bearer ${financeToken}`}}); assert(isolatedTime.response.ok&&isolatedTime.data.length===0,"Another employee could read the time entry");
  const hrTime=await api(`/rest/v1/employee_time_entries?select=id&id=eq.${clockIn.data.entry.id}`,{headers:{apikey:anon,Authorization:`Bearer ${hrToken}`}}); assert(hrTime.response.ok&&hrTime.data.length===1,"HR could not read museum attendance");
  const clockOut=await invoke("clock-employee-time",employeeToken,{action:"clock_out"}); assert(clockOut.response.ok&&clockOut.data.entry?.clock_out,"Employee clock out failed");
  const timeAudits=await api(`/rest/v1/audit_logs?select=id&record_id=eq.${clockIn.data.entry.id}`,{headers:serviceHeaders}); assert(timeAudits.response.ok&&timeAudits.data.length===2,"Time clock audit trail is incomplete");
  const allowedEdge=await invoke("assign-sensitive-role",adminToken,{user_id:employee.id,role_code:"supervisor"}); assert(allowedEdge.response.ok,"Authorized role assignment failed");
  const statusEdge=await invoke("set-employee-status",adminToken,{employee_id:createdEmployees[0],status:"inactivo"}); assert(statusEdge.response.ok&&statusEdge.data.employee.status==="inactivo","Authorized employee deactivation failed");
  await api(`/rest/v1/employees?id=eq.${createdEmployees[0]}`,{method:"DELETE",headers:{apikey:anon,Authorization:`Bearer ${adminToken}`}});
  const stillPresent=await api(`/rest/v1/employees?select=id&id=eq.${createdEmployees[0]}`,{headers:serviceHeaders}); assert(stillPresent.response.ok&&stillPresent.data.length===1,"Physical employee delete was not blocked");
  console.log(JSON.stringify({passed:true,checks:24}));
} catch (error) { failure=error; }
finally {
  if (createdTimeEntries.length) await api(`/rest/v1/audit_logs?record_id=in.(${createdTimeEntries.join(",")})`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdTimeEntries) await api(`/rest/v1/employee_time_entries?id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  if (createdEmployees.length) await api(`/rest/v1/audit_logs?record_id=in.(${createdEmployees.join(",")})`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdEmployees) await api(`/rest/v1/employees?id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdUsers) await api(`/rest/v1/audit_logs?actor_user_id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdUsers) await api(`/auth/v1/admin/users/${id}`,{method:"DELETE",headers:serviceHeaders});
}
if (failure) throw failure;