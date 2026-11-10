const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync("js/employee-leave-requests.js", "utf8");
const page = fs.readFileSync("employee-portal.html", "utf8");
const employee = id => ({ id, nombreCompleto: "Empleado " + id, accessProfile: "guia" });
const request = (id, employee_id) => ({
  id, employee_id, requested_by: "author-" + employee_id, start_date: "2026-12-01",
  end_date: "2026-12-02", leave_type: "personal", reason: "Día personal", status: "pending"
});
async function setup(profile, choice = true) {
  const dom = new JSDOM(page, { url: "https://example.test/employee-portal.html" });
  const person = { ...employee("own-employee"), accessProfile: profile };
  const records = [request("own-request", "own-employee"), request("other-request", "other-employee")];
  const posts = [];
  const browser = dom.window;
  browser.confirm = () => choice;
  const context = vm.createContext({
    window: browser,
    document: browser.document,
    FormData: browser.FormData,
    employeeDisplayName: p => p.nombreCompleto,
    fetchSupabaseEmployees: async () => [person, employee("other-employee")],
    supabaseGet: async () => records,
    supabasePost: async (_path, body) => { posts.push(body); },
    supabaseAuthHeaders: async () => ({ Authorization: "Bearer fake" }),
    supabaseUrl: "https://invalid.example.test",
    fetch: async (_url, request) => {
      posts.push(JSON.parse(request.body));
      return { ok: true };
    }
  });
  vm.runInContext(source, context);
  await context.bindEmployeeLeaveRequests(person);
  return { dom, person, posts, section: browser.document.querySelector("[data-administrative-leave]") };
}

test("ordinary employee sees own form and no approval buttons", async () => {
  const f = await setup("tecnico_produccion");
  assert.equal(f.section.hidden, false);
  assert.equal(f.section.querySelector('select[name="employeeId"]').value, "own-employee");
  assert.equal(f.section.querySelector('select[name="employeeId"]').disabled, true);
  assert.equal(f.section.querySelectorAll("[data-admin-leave-list] button").length, 0);
  assert.match(f.section.querySelector("[data-admin-leave-list]").textContent, /Mi solicitud/);
  assert.doesNotMatch(f.section.querySelector("[data-admin-leave-list]").textContent, /Empleado other-employee/);
  f.dom.window.close();
});

for (const role of ["gerente_administrativo", "director_ejecutivo", "administrador_general"]) {
  test(role + " sees two controls for others, none for own request", async () => {
    const f = await setup(role);
    const list = f.section.querySelector("[data-admin-leave-list]");
    assert.equal(list.querySelectorAll("button").length, 2);
    const ownArticle = [...list.querySelectorAll("article")].find(x => x.textContent.includes("Mi solicitud"));
    assert.equal(ownArticle.querySelectorAll("button").length, 0);
    f.dom.window.close();
  });
}

test("approved review submits only request ID and decision", async () => {
  const f = await setup("gerente_administrativo");
  const btn = f.section.querySelector("[data-admin-leave-list] button");
  btn.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(f.posts)), [{ p_request_id: "other-request", p_decision: "approved" }]);
  f.dom.window.close();
});

test("self-service form cannot choose a different employee", async () => {
  const f = await setup("tecnico_produccion");
  const form = f.section.querySelector("[data-admin-leave-form]");
  form.elements.startDate.value = "2026-12-01";
  form.elements.endDate.value = "2026-12-02";
  form.elements.reason.value = "Vacaciones";
  form.dispatchEvent(new f.dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].employee_id, "own-employee");
  f.dom.window.close();
});
