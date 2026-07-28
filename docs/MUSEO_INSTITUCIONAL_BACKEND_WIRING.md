# Museo HTML → Instituva (renta / membresías)

Backend only: misma UI; datos y reglas en Instituva vía **Edge Function** en el proyecto Museo.

## Activación

| Entorno Museo | Por defecto |
|---------------|-------------|
| `staging` (`?environment=staging`) | Puente **activo** (`institutionalData.enabled: true`) |
| `production` | Puente **off** |

Forzar en sesión: `?institutionalData=1` (off: `?institutionalData=0`).

Archivos: `js/config.js`, `js/app.js` → `callInstitutionalDataBridge` / `callRentalApprovalControl`.

## Requisitos

1. **Misma cuenta de correo** en Museo Auth e Instituva (`organization_memberships` activa en MAG).
2. Permisos Instituva: `spaces.rental.*`, `memberships.manage` (p. ej. rol admin org).
3. Secrets en **Supabase Museo** (staging/prod cuando aplique):

| Secret | Valor |
|--------|--------|
| `INSTITUVA_SUPABASE_URL` | `https://hjbwgxoboobxhrbxbuzb.supabase.co` |
| `INSTITUVA_SERVICE_ROLE_KEY` | service role Instituva (solo servidor) |
| `INSTITUVA_ORGANIZATION_ID` | `4d505200-0000-4000-8000-000000000001` |

4. Desplegar función:

```powershell
cd C:\DEV\Museo_Admin_v4
supabase functions deploy institutional-data-bridge --project-ref lonpdmxdvbxuagqxztig
```

5. Instituva: migración `0049_instituva_museo_service_bridge.sql` (`supabase db push` en Instituva_App).

### Cuenta de prueba (puente)

1. Mismo correo en **Instituva Auth** y **Museo staging Auth** (p. ej. cuenta temporal dedicada).
2. Instituva — membresía activa en MAG + rol `organization_admin`:

```powershell
cd C:\DEV\Instituva_App
.\scripts\bootstrap-mag-bridge-actor.ps1 -Email "tu-correo@ejemplo.com"
```

3. Museo staging — rol `administrador` (`rentals.manage`):

```powershell
cd C:\DEV\Museo_Admin_v4
.\scripts\bootstrap-museo-bridge-admin.ps1 -Email "tu-correo@ejemplo.com"
.\scripts\setup-institutional-bridge-secrets.ps1
```

4. Secrets + deploy (si cambiaste la función): ver pasos 3–4 en **Requisitos** arriba.

### Enlaces locales (ERR_CONNECTION_REFUSED en 127.0.0.1)

Vite usa **puerto 5173**. Si el navegador abre solo `http://127.0.0.1` (sin puerto), fallará.

- Museo en local: añade una vez `?instituvaApp=http://localhost:5173` o borra en DevTools → Application → Session storage la clave `instituva-app-base`.
- Invitaciones Supabase Auth: en **Authentication → URL configuration** (Instituva dev y Museo staging), **Site URL** = `http://localhost:5173` y **Redirect URLs** incluyen `http://localhost:5173/**` y `http://127.0.0.1:5173/**`.

## Qué enruta el puente

- Renta: `record_rental_municipal_receipt`, `set_rental_approval`, `log_rental_blocked_event`
- Membresías: listado + upsert (`museum_members` / asistencia por `organization_id`)

DE y recibos MAG se aplican en Instituva (`0048`).

## Producción

No activar en prod hasta identidad unificada y secrets revisados. Prod sigue en Supabase museo legacy.

Ver también: `Instituva_App/docs/BACKEND_EXECUTIVE_RENTAL_MEMBERSHIP.md`.
