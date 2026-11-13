const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { TextEncoder } = require("node:util");

const edge = fs.readFileSync("supabase/functions/clock-employee-time/index.ts", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const cfg = fs.readFileSync("js/config.js", "utf8");
const start = edge.indexOf("function trustworthyPublicIpv4(");
const end = edge.indexOf("Deno.serve(", start);
assert.ok(start >= 0 && end > start);
const functions = edge.slice(start, end)
  .replace("input: string | null): string | null", "input)")
  .replace("museumId: string, ip: string): Promise<string>", "museumId, ip)");
const ctx = vm.createContext({ crypto: webcrypto, TextEncoder, Uint8Array, Number, Array });
vm.runInContext(functions, ctx);

test("public IPv4 is canonical; reject private, malformed, reserved and caller-forged lists", () => {
  assert.equal(ctx.trustworthyPublicIpv4("70.45.85.15"), "70.45.85.15");
  for (const ip of ["", null, "127.0.0.1", "10.0.0.12", "192.168.1.1",
    "172.19.1.1", "169.254.4.4", "100.100.3.4", "0.2.3.4",
    "203.0.113.2", "999.0.0.1", "070.45.85.15",
    "70.45.85.15, 1.1.1.1", "70.45.85.15:443", "192.0.2.1"]) {
    assert.equal(ctx.trustworthyPublicIpv4(ip), null, String(ip));
  }
});

test("museum identity and egress IP both scope the allowlisted digest", async () => {
  const one = await ctx.museumWifiHash("museum-a", "70.45.85.15");
  assert.match(one, /^[a-f0-9]{64}$/);
  assert.equal(await ctx.museumWifiHash("museum-a", "70.45.85.15"), one);
  assert.notEqual(await ctx.museumWifiHash("museum-b", "70.45.85.15"), one);
  assert.notEqual(await ctx.museumWifiHash("museum-a", "70.45.85.16"), one);
});

test("edge enforces permission and never trusts browser-provided Wi-Fi hashes", () => {
  assert.match(edge, /requirePermission\(req, "time.clock"\)/);
  assert.match(edge, /req\.headers\.get\("cf-connecting-ip"\)/);
  assert.doesNotMatch(edge, /req\.headers\.get\("x-forwarded-for"\)/);
  assert.match(edge, /network_hash: hash/);
  assert.doesNotMatch(edge, /network_hash: incomingPresence/);
  assert.match(edge, /allowed_wifi_hashes\.includes\(hash\)/);
  assert.match(edge, /presence: verifiedPresence/);
  assert.match(edge, /WIFI_NOT_AVAILABLE/);
  assert.match(edge, /ATTENDANCE_NOT_REQUIRED/);
  assert.match(edge, /PREVIOUS_SHIFT_OPEN/);
});

test("GPS remains the only enabled path until explicit museum network enrollment", () => {
  assert.equal((cfg.match(/attendanceWifi: Object\.freeze\(\{ enabled: false \}\)/g) || []).length, 2);
  assert.match(app, /museoEnvironment\.attendanceWifi\?\.enabled === true/);
  assert.match(app, /wifiError\?\.code !== "WIFI_NOT_AVAILABLE"/);
  assert.match(app, /if \(!usedMuseumWifi\) \{[\s\S]*requestPresence\(\)/);
  assert.match(app, /punchInFlight = true/);
});
