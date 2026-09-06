import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const service = fs.readFileSync(new URL("../../js/services/supabase.js", import.meta.url), "utf8");

test("password recovery preserves the GitHub Pages project path", () => {
  assert.match(service, /new URL\("login\.html", window\.location\.href\)/);
  assert.match(service, /redirect\.searchParams\.set\("environment", museoEnvironment\.name\)/);

  const publicPage = "https://guillermotorresproductor.github.io/Museo_Admin_v4/login.html";
  const redirect = new URL("login.html", publicPage);
  redirect.searchParams.set("environment", "production");
  assert.equal(
    redirect.href,
    "https://guillermotorresproductor.github.io/Museo_Admin_v4/login.html?environment=production"
  );
});

test("recovery callback accepts session and token-hash responses", () => {
  const app = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
  assert.match(app, /callback\.access_token/);
  assert.match(app, /callback\.token_hash/);
  assert.match(app, /verifySupabaseEmailToken/);
  assert.match(service, /method:\s*"PUT"[\s\S]*body:\s*JSON\.stringify\(\{ password \}\)/);
});
