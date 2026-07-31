"use strict";

const museoEnvironments = Object.freeze({
  production: Object.freeze({
    name: "production",
    supabaseUrl: "https://kfokfjngozgcwjpzxcsu.supabase.co",
    supabasePublishableKey: "sb_publishable_wBGL3o2YcfbR_dvhT3mTnw_OXuHB0y3",
    institutionalData: Object.freeze({
      enabled: false,
      organizationId: "4d505200-0000-4000-8000-000000000001"
    })
  }),
  staging: Object.freeze({
    name: "staging",
    supabaseUrl: "https://lonpdmxdvbxuagqxztig.supabase.co",
    supabasePublishableKey: "sb_publishable_M6ByE4TQKwaQIuLfyHdHhQ_HOxWqebX",
    institutionalData: Object.freeze({
      enabled: true,
      organizationId: "4d505200-0000-4000-8000-000000000001"
    })
  })
});

const MUSEO_ENV_SESSION_KEY = "museo-admin-environment";
/** Survives tab close for non-production test sessions; cleared only by explicit production. */
const MUSEO_ENV_STICKY_KEY = "museo-admin-environment-sticky";
const DEMO_MUSEO_HOSTNAME = "demo.instituva.com";
const DEMO_INSTITUVA_APP_ORIGIN = "https://demo-app.instituva.com";

const requestedMuseoEnvironment = new URLSearchParams(window.location.search).get("environment");

function isHostnameLockedDemoMuseoHost(host = window.location.hostname) {
  return String(host || "").toLowerCase() === DEMO_MUSEO_HOSTNAME;
}

function isLocalMuseoHost(host = window.location.hostname) {
  return host === "localhost" || host === "127.0.0.1" || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host);
}

function clearMuseoEnvironmentSticky() {
  sessionStorage.removeItem(MUSEO_ENV_SESSION_KEY);
  try {
    localStorage.removeItem(MUSEO_ENV_STICKY_KEY);
  } catch {
    // ignore
  }
}

function rememberMuseoEnvironment(name) {
  if (isHostnameLockedDemoMuseoHost()) return;
  if (!museoEnvironments[name]) return;
  sessionStorage.setItem(MUSEO_ENV_SESSION_KEY, name);
  try {
    if (name === "production") {
      localStorage.removeItem(MUSEO_ENV_STICKY_KEY);
    } else {
      localStorage.setItem(MUSEO_ENV_STICKY_KEY, name);
    }
  } catch {
    // ignore
  }
}

function resolveMuseoEnvironmentName() {
  // Host-locked demo: always Museo staging. Query/session/sticky cannot switch to production.
  if (isHostnameLockedDemoMuseoHost()) {
    return "staging";
  }

  if (requestedMuseoEnvironment === "production") {
    clearMuseoEnvironmentSticky();
    return "production";
  }

  if (requestedMuseoEnvironment && museoEnvironments[requestedMuseoEnvironment]) {
    rememberMuseoEnvironment(requestedMuseoEnvironment);
    return requestedMuseoEnvironment;
  }

  // No explicit ?environment= — preserve the active session/sticky environment.
  const fromSession = sessionStorage.getItem(MUSEO_ENV_SESSION_KEY);
  if (fromSession && museoEnvironments[fromSession]) {
    return fromSession;
  }

  try {
    const fromSticky = localStorage.getItem(MUSEO_ENV_STICKY_KEY);
    if (fromSticky && museoEnvironments[fromSticky] && fromSticky !== "production") {
      sessionStorage.setItem(MUSEO_ENV_SESSION_KEY, fromSticky);
      return fromSticky;
    }
  } catch {
    // ignore
  }

  // Client default: production only when nothing active is remembered.
  return "production";
}

const museoEnvironmentName = resolveMuseoEnvironmentName();
const museoEnvironment = museoEnvironments[museoEnvironmentName] || museoEnvironments.production;

const institutionalDataQuery = new URLSearchParams(window.location.search).get("institutionalData");
if (institutionalDataQuery === "1") {
  sessionStorage.setItem("museo-institutional-data-backend", "1");
} else if (institutionalDataQuery === "0") {
  sessionStorage.removeItem("museo-institutional-data-backend");
}

function isInstitutionalDataBackendEnabled() {
  const sessionOn = sessionStorage.getItem("museo-institutional-data-backend") === "1";
  const envOn = Boolean(museoEnvironment.institutionalData?.enabled);
  return sessionOn || envOn;
}

function normalizeInstituvaDevBaseUrl(raw) {
  if (!raw) return raw;
  let base = String(raw).trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  try {
    const url = new URL(base);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (local && !url.port) url.port = "5173";
    return url.origin;
  } catch {
    return base;
  }
}

function storedInstituvaBaseLooksInvalid(storedBase) {
  try {
    const url = new URL(storedBase);
    if (url.hostname !== window.location.hostname) return false;
    if (url.port === "5173") return false;
    if (/instituva_app/i.test(url.pathname)) return false;
    return true;
  } catch {
    return true;
  }
}

/** Instituva_App — misma app en PC y celular; un mismo backend (instituva-development). */
function resolveInstituvaAppBaseUrl() {
  const host = window.location.hostname;
  if (isHostnameLockedDemoMuseoHost(host)) {
    return DEMO_INSTITUVA_APP_ORIGIN;
  }

  const params = new URLSearchParams(window.location.search);
  const queryOverride = params.get("instituvaApp");
  if (queryOverride) {
    const normalized = normalizeInstituvaDevBaseUrl(queryOverride);
    sessionStorage.setItem("instituva-app-base", normalized);
    return normalized;
  }

  if (isLocalMuseoHost(host)) {
    sessionStorage.removeItem("instituva-app-base");
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5173";
    }
    return `http://${host}:5173`;
  }

  const stored = sessionStorage.getItem("instituva-app-base");
  if (stored) {
    const normalized = normalizeInstituvaDevBaseUrl(stored);
    if (!storedInstituvaBaseLooksInvalid(normalized)) return normalized;
    sessionStorage.removeItem("instituva-app-base");
  }

  if (host === "app.instituva.com") return "https://app.instituva.com";
  return "https://guillermotorresproductor.github.io/Instituva_App";
}

const instituvaAppBaseUrl = resolveInstituvaAppBaseUrl();

function instituvaAppUrl(path = "/") {
  const segment = path.startsWith("/") ? path : `/${path}`;
  return `${instituvaAppBaseUrl}${segment}`;
}

/**
 * Build an internal Museo page URL.
 * On demo.instituva.com, omit the technical ?environment= query.
 * Elsewhere, always carry the active environment to prevent silent production fallback.
 */
function museoPageUrl(page, extraParams = {}) {
  const raw = String(page || "dashboard.html");
  let url;
  try {
    url = new URL(raw, window.location.href);
  } catch {
    return raw;
  }
  if (url.origin !== window.location.origin) return raw;
  const params = new URLSearchParams(url.search);
  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  });
  if (isHostnameLockedDemoMuseoHost()) {
    params.delete("environment");
  } else {
    params.set("environment", museoEnvironment.name);
  }
  const file = url.pathname.split("/").pop() || raw.split("?")[0];
  const query = params.toString();
  return query ? `${file}?${query}` : file;
}
