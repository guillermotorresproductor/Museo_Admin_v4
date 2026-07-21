"use strict";

const museoEnvironments = Object.freeze({
  production: Object.freeze({
    name: "production",
    supabaseUrl: "https://kfokfjngozgcwjpzxcsu.supabase.co",
    supabasePublishableKey: "sb_publishable_wBGL3o2YcfbR_dvhT3mTnw_OXuHB0y3"
  }),
  staging: Object.freeze({
    name: "staging",
    supabaseUrl: "https://lonpdmxdvbxuagqxztig.supabase.co",
    supabasePublishableKey: "sb_publishable_M6ByE4TQKwaQIuLfyHdHhQ_HOxWqebX"
  })
});

const requestedMuseoEnvironment = new URLSearchParams(window.location.search).get("environment");
if (requestedMuseoEnvironment && museoEnvironments[requestedMuseoEnvironment]) {
  sessionStorage.setItem("museo-admin-environment", requestedMuseoEnvironment);
}

const museoEnvironmentName = sessionStorage.getItem("museo-admin-environment") || "production";
const museoEnvironment = museoEnvironments[museoEnvironmentName] || museoEnvironments.production;
