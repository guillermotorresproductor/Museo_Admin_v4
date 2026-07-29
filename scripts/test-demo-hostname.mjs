#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition) });
  if (!condition) console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  else console.log(`PASS ${name}`);
}

function mockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(String(k), String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function loadConfig({ hostname, search = "", session = {}, sticky = {} }) {
  const code = fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8");
  const sessionStorage = mockStorage();
  const localStorage = mockStorage();
  Object.entries(session).forEach(([k, v]) => sessionStorage.setItem(k, v));
  Object.entries(sticky).forEach(([k, v]) => localStorage.setItem(k, v));
  const href = `https://${hostname}/login.html${search}`;
  const context = {
    window: {
      location: {
        hostname,
        host: hostname,
        search,
        href,
        origin: `https://${hostname}`,
        pathname: "/login.html",
      },
    },
    sessionStorage,
    localStorage,
    URL,
    URLSearchParams,
    Object,
    console,
  };
  vm.createContext(context);
  vm.runInContext(
    `${code}\n;globalThis.__museoDemoTest = { museoEnvironment, instituvaAppBaseUrl, museoPageUrl, isHostnameLockedDemoMuseoHost };`,
    context,
  );
  return context.__museoDemoTest;
}

const demo = loadConfig({
  hostname: "demo.instituva.com",
  search: "?environment=production",
  session: { "museo-admin-environment": "production" },
  sticky: { "museo-admin-environment-sticky": "production" },
});
assert("demo forces staging despite production query/storage", demo.museoEnvironment.name === "staging");
assert(
  "demo uses staging supabase host",
  String(demo.museoEnvironment.supabaseUrl).includes("lonpdmxdvbxuagqxztig"),
);
assert("demo Instituva base is demo-app", demo.instituvaAppBaseUrl === "https://demo-app.instituva.com");
assert(
  "demo museoPageUrl omits environment",
  demo.museoPageUrl("dashboard.html") === "dashboard.html",
);
assert(
  "demo museoPageUrl keeps next without environment",
  demo.museoPageUrl("login.html", { next: "finanzas.html" }) === "login.html?next=finanzas.html",
);
assert("demo host lock helper", demo.isHostnameLockedDemoMuseoHost() === true);

const local = loadConfig({ hostname: "localhost", search: "" });
assert("localhost defaults to production", local.museoEnvironment.name === "production");
assert("localhost Instituva is :5173", local.instituvaAppBaseUrl === "http://localhost:5173");
assert(
  "localhost museoPageUrl includes environment",
  local.museoPageUrl("dashboard.html") === "dashboard.html?environment=production",
);

const localStaging = loadConfig({ hostname: "127.0.0.1", search: "?environment=staging" });
assert("127.0.0.1 honors ?environment=staging", localStaging.museoEnvironment.name === "staging");
assert(
  "local staging page urls keep environment",
  localStaging.museoPageUrl("dashboard.html") === "dashboard.html?environment=staging",
);

const gh = loadConfig({ hostname: "guillermotorresproductor.github.io", search: "" });
assert("github pages defaults production", gh.museoEnvironment.name === "production");
assert(
  "github pages Instituva fallback",
  gh.instituvaAppBaseUrl === "https://guillermotorresproductor.github.io/Instituva_App",
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} demo-hostname checks passed.`);
