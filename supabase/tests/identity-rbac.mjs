const url = process.env.SUPABASE_TEST_URL;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const service = process.env.SUPABASE_TEST_SERVICE_KEY;
if (!url || !anon || !service) throw new Error("Missing staging test environment.");
const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const createdUsers = [];
const createdEmployees = [];
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
  const employee=await createUser("employee"), finance=await createUser("finance"), admin=await createUser("admin");
  await assign(finance,"finanzas"); await assign(admin,"administrador");
  await createEmployee(employee,"Employee"); await createEmployee(finance,"Finance"); await createEmployee(admin,"Admin");
  const employeeToken=await signIn(employee), financeToken=await signIn(finance), adminToken=await signIn(admin);
  assert(await permission(employeeToken,"employees.read.self")===true,"Employee self permission missing");
  assert(await permission(employeeToken,"employees.read.all")===false,"Employee received read.all");
  assert(await permission(financeToken,"finance.read")===true,"Finance permission missing");
  assert(await permission(financeToken,"employees.medical.read")===false,"Finance received medical access");
  assert(await permission(adminToken,"roles.assign")===true,"Admin role assignment missing");
  assert(await permission(adminToken,"finance.read")===false,"Admin inherited finance access");
  assert(await permission(adminToken,"employees.medical.read")===false,"Admin inherited medical access");
  const own=await api("/rest/v1/employees?select=id",{headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`}}); assert(own.response.ok&&own.data.length===1,"Employee isolation failed");
  const forbiddenInsert=await api("/rest/v1/employees",{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${employeeToken}`,"Content-Type":"application/json"},body:{museum_id:(await profile(employee.id)).museum_id,first_name:"No",last_name:"Permission",position:"QA",department:"QA",email:"blocked@example.invalid"}}); assert(forbiddenInsert.response.status===403,"Employee insert was not blocked");
  const deniedEdge=await invoke("assign-sensitive-role",employeeToken,{user_id:employee.id,role_code:"supervisor"}); assert(deniedEdge.response.status===403,"Unauthorized Edge Function call was not blocked");
  const allowedEdge=await invoke("assign-sensitive-role",adminToken,{user_id:employee.id,role_code:"supervisor"}); assert(allowedEdge.response.ok,"Authorized role assignment failed");
  const statusEdge=await invoke("set-employee-status",adminToken,{employee_id:createdEmployees[0],status:"inactivo"}); assert(statusEdge.response.ok&&statusEdge.data.employee.status==="inactivo","Authorized employee deactivation failed");
  await api(`/rest/v1/employees?id=eq.${createdEmployees[0]}`,{method:"DELETE",headers:{apikey:anon,Authorization:`Bearer ${adminToken}`}});
  const stillPresent=await api(`/rest/v1/employees?select=id&id=eq.${createdEmployees[0]}`,{headers:serviceHeaders}); assert(stillPresent.response.ok&&stillPresent.data.length===1,"Physical employee delete was not blocked");
  console.log(JSON.stringify({passed:true,checks:13}));
} catch (error) { failure=error; }
finally {
  if (createdEmployees.length) await api(`/rest/v1/audit_logs?record_id=in.(${createdEmployees.join(",")})`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdEmployees) await api(`/rest/v1/employees?id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdUsers) await api(`/rest/v1/audit_logs?actor_user_id=eq.${id}`,{method:"DELETE",headers:serviceHeaders});
  for (const id of createdUsers) await api(`/auth/v1/admin/users/${id}`,{method:"DELETE",headers:serviceHeaders});
}
if (failure) throw failure;