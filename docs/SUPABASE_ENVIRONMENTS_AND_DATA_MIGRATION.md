# Supabase por entorno (§I.3) — vista Museo HTML

La app Instituva y la convergencia de datos se documentan en:

**`C:\DEV\Instituva_App\docs\SUPABASE_ENVIRONMENTS_AND_DATA_MIGRATION.md`**

Registro compartido (sin secretos): **`Instituva_App/config/supabase-environments.json`**

## Hoy

| Componente | Supabase |
|------------|----------|
| Museo HTML (`js/config.js`) | **production** `kfokfjngozgcwjpzxcsu` · **staging** `lonpdmxdvbxuagqxztig` |
| Instituva_App | **instituva-development** `hjbwgxoboobxhrbxbuzb` |
| Enlaces a la app | `instituvaAppUrl()` — no sustituye el backend de renta/membresías hasta cutover por módulo |

## Cutover (solo backend, UI congelada)

Cuando un módulo esté listo en Instituva, se cambiará **únicamente** la URL/clave Supabase o las rutas RPC en `config.js` / servicios — **sin** retirar `dashboard.html`, `membresias.html`, etc.

**Implementado (staging):** puente `institutional-data-bridge` + flag `institutionalData` — ver `docs/MUSEO_INSTITUCIONAL_BACKEND_WIRING.md`.

Orden recomendado: ver `convergenceModules` en el JSON de entornos.

## No hacer

- Mezclar datos operativos de museo prod en `instituva-development` sin `data_migration_runs`.
- Apuntar Instituva_App a `kfokfjngozgcwjpzxcsu` en producción futura (modelo `organization_id` distinto).
