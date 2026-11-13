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


async function simulateEdge({ ip, config, submitted, permission = true }) {
  let handler;
  const calls = [];
  const admin = {
    from: (table) => {
      assert.equal(table, "attendance_settings");
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: config, error: null }) }) }) };
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { ok: true, event: { event_type: args.requested_event } }, error: null };
    }
  };
  const raw = edge
    .replace(/^import .*?;\\s*/m, "")
    .replace("input: string | null): string | null", "input)")
    .replace("museumId: string, ip: string): Promise<string>", "museumId, ip)")
    .replace("let verifiedPresence: Record<string, unknown>;", "let verifiedPresence;")
    .replace("const messages: Record<string, [string, number]> =", "const messages =");
  const ctx = vm.createContext({
    Deno: { serve: (fn) => { handler = fn; } },
    corsHeaders: {},
    Response: class { constructor(body, options) { this.body = body; this.status = options.status || 200; } },
    json: (body, status = 200) => ({ body, status }),
    errorResponse: (error) => ({ body: { error: String(error) }, status: 500 }),
    requirePermission: async (_req, requested) => {
      assert.equal(requested, "time.clock");
      if (!permission) throw new Error("FORBIDDEN");
      return { admin, user: { id: "user-1" }, profile: { museum_id: "museum-a" } };
    },
    crypto: webcrypto, TextEncoder, Uint8Array, Number, Array, String
  });
  vm.runInContext(raw, ctx);
  assert.equal(typeof handler, "function");
  const response = await handler({
    method: "POST",
    headers: { get: (name) => name === "cf-connecting-ip" ? ip : null },
    json: async () => ({ action: "clock_in", presence: submitted })
  });
  return { response, calls };
}

test("Wi-Fi is fail-closed when mode is geolocation even from an allowlisted IP", async () => {
  const digest = await ctx.museumWifiHash("museum-a", "70.45.85.15");
  const { response, calls } = await simulateEdge({
    ip: "70.45.85.15",
    config: { presence_required: true, presence_validation_mode: "geolocation", allowed_wifi_hashes: [digest] },
    submitted: { method: "wifi", network_hash: digest }
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "WIFI_NOT_AVAILABLE");
  assert.equal(calls.length, 0);
});

test("Wi-Fi authorizes only a verified gateway IP, ignores client hash spoofing", async () => {
  const digest = await ctx.museumWifiHash("museum-a", "70.45.85.15");
  const config = { presence_required: true, presence_validation_mode: "any", allowed_wifi_hashes: [digest] };
  const legitimate = await simulateEdge({
    ip: "70.45.85.15", config,
    submitted: { method: "wifi", network_hash: "forged", ip: "1.2.3.4", ssid: "museum" }
  });
  assert.equal(legitimate.response.status, 200);
  assert.equal(legitimate.calls.length, 1);
  assert.equal(legitimate.calls[0].args.presence.method, "wifi");
  assert.equal(legitimate.calls[0].args.presence.network_hash, digest);
  assert.equal(legitimate.calls[0].args.presence.ip, undefined);
  const outsider = await simulateEdge({
    ip: "70.45.85.16", config, submitted: { method: "wifi", network_hash: digest }
  });
  assert.equal(outsider.response.body.code, "WIFI_NOT_AVAILABLE");
  assert.equal(outsider.calls.length, 0);
});

test("GPS path remains a single call to the existing attendance RPC", async () => {
  const { response, calls } = await simulateEdge({
    ip: "70.45.85.16",
    config: { presence_required: true, presence_validation_mode: "geolocation", allowed_wifi_hashes: [] },
    submitted: { method: "geolocation", latitude: 18.34, longitude: -66.11, accuracy_meters: 15, network_hash: "forged" }
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.presence.method, "geolocation");
  assert.equal(calls[0].args.presence.network_hash, undefined);
});
