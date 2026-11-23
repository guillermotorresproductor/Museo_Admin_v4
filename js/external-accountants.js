"use strict";
// Admin-only external accountant management. No employees or HR records.
function bindExternalAccountants() {
  const root = document.querySelector("[data-external-accountants]");
  if (!root) return;
  const form = root.querySelector("[data-accountant-invite]");
  const message = root.querySelector("[data-accountant-message]");
  const list = root.querySelector("[data-accountant-list]");
  const canManage = hasPermission("users.invite") && hasPermission("roles.assign");
  const canRevoke = hasPermission("users.deactivate") && hasPermission("roles.assign");
  if (!canManage) {
    root.innerHTML = "<p class=\"form-message error\">Su perfil no autoriza las invitaciones de usuarios externos.</p>";
    return;
  }
  const escape = (value) => safeHtml(String(value ?? ""));
  const setMessage = (value, error = false) => {
    message.textContent = value;
    message.className = "form-message" + (error ? " error" : "");
  };
  let busy = false;
  async function request(action, payload = {}) {
    const response = await fetch(`${supabaseUrl}/functions/v1/external-accountant-access`, {
      method: "POST", headers: await supabaseAuthHeaders(),
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "La solicitud no pudo completarse.");
    return data;
  }
  async function refresh() {
    const data = await request("list");
    const accountants = Array.isArray(data.accountants) ? data.accountants : [];
    list.innerHTML = accountants.length ? accountants.map((accountant) => `<tr>
      <td>${escape(accountant.full_name)}</td>
      <td>${escape(accountant.email)}</td>
      <td>${accountant.status === "active" ? "Invitado / autorizado" : "Revocado"}</td>
      <td>${escape(String(accountant.invited_at || "").slice(0,10))}</td>
      <td>${accountant.status === "active" && canRevoke
        ? `<button type="button" class="button secondary" data-accountant-revoke="${escape(accountant.id)}">Revocar acceso</button>`
        : "—"}</td>
    </tr>`).join("") : "<tr><td colspan=\"5\">No hay contables externos invitados para este museo.</td></tr>";
    list.querySelectorAll("[data-accountant-revoke]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (busy || !canRevoke) return;
        const id = button.dataset.accountantRevoke;
        const email = button.closest("tr")?.children[1]?.textContent || "este contable";
        if (!window.confirm(`¿Revocar el acceso de ${email}? La cuenta dejará de consultar las finanzas de este museo.`)) return;
        busy = true; button.disabled = true; setMessage("Revocando acceso...");
        try {
          await request("revoke",{ id,confirmed:true });
          setMessage("Acceso revocado.");
          await refresh();
        } catch (error) { setMessage(error.message,true); }
        finally { busy=false;button.disabled=false; }
      });
    });
  }
  form?.addEventListener("submit",async (event)=>{
    event.preventDefault();
    if (busy) return;
    const email = String(form.elements.email.value || "").trim();
    const full_name = String(form.elements.full_name.value || "").trim();
    if (!window.confirm(`¿Invitar a ${email} como contable externo, exclusivamente para consultar y exportar Finanzas?`)) return;
    busy = true;
    form.querySelector("[type=submit]").disabled = true;
    setMessage("Verificando identidad e invitación...");
    try {
      await request("invite",{ email,full_name });
      setMessage("Invitación solicitada y permisos de solo lectura configurados.");
      form.reset();
      await refresh();
    } catch (error) {
      setMessage(error.message + " Verifique el estado antes de intentar nuevamente.",true);
    } finally {
      busy=false;
      form.querySelector("[type=submit]").disabled=false;
    }
  });
  refresh().catch(error=>setMessage(error.message,true));
}
