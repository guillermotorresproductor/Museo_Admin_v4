# Política: experiencia de usuario congelada

**Vigencia:** a partir del 28 de julio de 2026  
**Aprobación:** Dirección / producto (documento de gobernanza interna)

## Qué no se cambia sin autorización expresa

- **Estética:** colores, tipografía, iconografía, tarjetas, densidad visual, logos.
- **Montaje:** disposición de pantallas, grillas del portal, sidebar, headers, orden de tarjetas en `/mi-portal` y en el dashboard web HTML.
- **Funcionalidad visible:** flujos que el empleado regular, ejecutivo y administrador ya usan (login, módulos visibles por categoría, ponchar, calendarios, Dirección Ejecutiva, renta, membresías, reglamento).
- **Nombres y posiciones de módulos** en `portalCatalog.tsx`, paquetes por categoría en `12_EMPLOYEE_PORTAL.md`, y tarjetas equivalentes en la app móvil depurada por el equipo.

La logística depurada (quién ve qué según categoría funcional + permisos) es **intencional** y no se “simplifica” moviendo botones ni fusionando pantallas.

## Qué sí se permite (backend y datos)

- Supabase: migraciones, RLS, RPC, Edge Functions, índices, unificación de `organization_id` / tenant.
- Publicar el **mismo PDF** del reglamento en storage versionado (sin cambiar cómo se abre en app/web).
- Replicar reglas ya existentes (recibos MAG, aprobaciones) en servidor Instituva **sin alterar** textos ni pasos que ve el usuario.
- Rendimiento: caché server-side, consultas optimizadas, menos round-trips — **sin cambiar respuestas** que la UI ya espera.
- Infraestructura: un proyecto Supabase por entorno, despliegue, secrets, auditoría append-only.

## Revisión de PR / Codex / Cursor

Antes de merge, preguntar:

1. ¿Este diff toca HTML/CSS/React de layout o orden de módulos? → Requiere autorización explícita.
2. ¿Solo backend/SQL/config? → Permitido si trazado a reglamento (`REGLAMENTO_ARTICULO_A_REGLAS.md`).

Referencias: `REGULAMENTO_TRAZABILIDAD_Y_PLAN_CAMBIOS.md`, `Instituva_App/docs/REGULAMENTO_Y_GOBERNANZA_REFERENCIA.md`.
