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

const requestedMuseoEnvironment = new URLSearchParams(window.location.search).get("environment");
if (requestedMuseoEnvironment && museoEnvironments[requestedMuseoEnvironment]) {
  sessionStorage.setItem("museo-admin-environment", requestedMuseoEnvironment);
}

const museoEnvironmentName = sessionStorage.getItem("museo-admin-environment") || "production";
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
  const params = new URLSearchParams(window.location.search);
  const queryOverride = params.get("instituvaApp");
  if (queryOverride) {
    const normalized = normalizeInstituvaDevBaseUrl(queryOverride);
    sessionStorage.setItem("instituva-app-base", normalized);
    return normalized;
  }
  const stored = sessionStorage.getItem("instituva-app-base");
  if (stored) {
    const normalized = normalizeInstituvaDevBaseUrl(stored);
    if (!storedInstituvaBaseLooksInvalid(normalized)) return normalized;
    sessionStorage.removeItem("instituva-app-base");
  }

  const host = window.location.hostname;
  if (host === "app.instituva.com") return "https://app.instituva.com";
  if (host === "localhost" || host === "127.0.0.1") {
    return `http://${host}:5173`;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return `http://${host}:5173`;
  }
  return "https://guillermotorresproductor.github.io/Instituva_App";
}

const instituvaAppBaseUrl = resolveInstituvaAppBaseUrl();

function instituvaAppUrl(path = "/") {
  const segment = path.startsWith("/") ? path : `/${path}`;
  return `${instituvaAppBaseUrl}${segment}`;
}
