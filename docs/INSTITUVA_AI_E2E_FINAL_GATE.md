# INSTITUVA AI — Puerta final de aceptación (solo staging)

**Estado:** preparado, **no aprobado**. PR #125 sin fusionar. Producción fuera de alcance.

## Condiciones innegociables

- Proyecto permitido: `lonpdmxdvbxuagqxztig`, y solamente ese.
- `INSTITUVA_AI_E2E_CONFIRM_STAGING=lonpdmxdvbxuagqxztig`.
- No introducir JWT, service_role, claves OpenAI ni contraseñas en Git, en comentarios del PR, en el chat o en logs.
- Ejecutar únicamente desde un equipo/runner confiable con variables temporales y acceso restringido; **no inyectar secretos en el workflow público de PR**.
- No crear permisos adicionales, cambiar el allowlist, activar producción ni modificar registros operacionales para superar una prueba.

## 1. Autenticación y aislamiento HTTP real

Script: `node supabase/tests/instituva-ai-auth-staging.mjs`

Variables seguras para ese proceso:
`INSTITUVA_AI_E2E_CONFIRM_STAGING`,
`INSTITUVA_AI_TEST_ANON_KEY` y
`INSTITUVA_AI_TEST_SERVICE_KEY`.

Se requieren dos claves **JWT legacy del mismo proyecto de staging**, con roles respectivos `anon` y `service_role`. El filtro local bloquea claves de otro proyecto, expiradas o con roles equivocados antes de cualquier llamada HTTP. La API de staging comprueba después las firmas. El script crea únicamente dos usuarios/museos sintéticos; verifica JWT, perfil, RLS, permisos, cuotas y bloqueo de otros museos y perfiles inactivos. Revierte/elimina exclusivamente esas identidades y comprueba la limpieza. La función de producción no se utiliza. El propio test declara `model_calls:0`; su aprobación **no prueba el modelo**.

**No ejecutar** si no se dispone de la clave administrativa exclusiva de staging por un canal seguro. No recuperarla de un proyecto productivo ni de un documento.

## 2. Respuesta real del proveedor con consulta sin datos operacionales

Script: `node supabase/tests/instituva-ai-model-smoke-staging.mjs`

Variables seguras:
`INSTITUVA_AI_E2E_CONFIRM_STAGING`,
`INSTITUVA_AI_TEST_ANON_KEY`,
`INSTITUVA_AI_TEST_USER_JWT`.

El JWT debe corresponder a una **cuenta activa autorizada exclusivamente en staging**, en un museo ya admitido en el allowlist de INSTITUVA AI. El script comprueba emisor, rol y vencimiento localmente y verifica la sesión en el servicio Auth remoto. Hace **una** consulta `product` sobre el procedimiento documental de jornadas abiertas; no solicita datos privados de Asistencia, Finanzas ni Colecciones. Exige respuesta real HTTP 200 del proveedor, fuentes documentales, límites de evidencia, hipótesis no confirmadas, pasos manuales y `actions_executed:false`. Produce un único consumo técnico de cuota del museo de prueba; **no modifica datos operacionales**. No imprime JWT, respuestas ni identidades.

Una prueba del proveedor en `product` no prueba la calidad diagnóstica de todos los demás módulos: todavía deben aceptarse los escenarios institucionales autorizados con datos sintéticos controlados antes de publicar.

## 3. Verificación posterior y autorización

Tras ejecutar, confirmar solo mediante SELECT en staging: ausencia de museos `instituva-ai-e2e-%` y de cuentas ficticias, auditoría y consumo de cuota esperado. Registrar el resultado de cada prueba por separado; no confundir pruebas sintéticas, gateway 401, JWT firmado y respuesta real del proveedor.

Para aprobar: ambos ensayos reales completados, no hay errores de limpieza ni fugas entre museos, hipótesis y recomendaciones se mantienen provisionales, sin operaciones automáticas, y aprobación explícita de despliegue. **No fusionar ni activar producción por el simple hecho de pasar CI.**

## Estado de acceso (25 noviembre 2026)

Con la conexión disponible se pudo obtener la clave **pública** de staging y confirmar sus claims `anon` y referencia del proyecto, pero no una clave privada `service_role` ni un JWT de usuario autorizado. Estos ensayos quedan preparados **sin ser ejecutados**; en ningún caso deben figurar como aprobados hasta correr con credenciales exclusivas de staging.


## Auditoría de preparación de producción — 26 noviembre 2026 (SIN DESPLIEGUE)

- Entornos comprobados directamente: staging `lonpdmxdvbxuagqxztig`; producción `kfokfjngozgcwjpzxcsu`. **No intercambiar proyectos ni claves.**
- Producción registra 68 migraciones y staging 91; sus historiales divergen en Asistencia, Finanzas y otros módulos. **Prohibido usar `supabase db push` o sincronización general** para instalar IA.
- La producción carece de `public.ai_assistant_usage`, `public.ai_assistant_claim_internal_v1(uuid,uuid)` y la Edge Function `instituva-ai-assistant`: la publicación requiere instalación inicial aislada.
- Dependencias de autorización en producción confirmadas (solo SELECT): `public.museums`, `public.profiles`, `current_user_museum_id()`, `has_permission(text)`, `collection_can_read()` y `module_profile_allows(text)`. También existen las tablas de evidencia de los módulos.
- Se observaron diferencias de esquema entre staging y producción en `employees`, `employee_shifts`, `employee_notifications`, `finance_records` y restricciones de `profiles`. Las columnas verificadas de las lecturas IA de Finanzas, Inventario, Notificaciones y perfil existen en producción; **se requiere validación de comportamiento/RLS antes de activar cada módulo**.
- El botón flotante IA está limitado actualmente a staging en `js/app.js`. Fusionar la rama sin una activación explícita y probada de interfaz no habilita la IA para producción.
- El operador mostró respaldos físicos diarios de Supabase Database del 19 al 26 de noviembre. Estos respaldos **no incluyen objetos Storage**; no se ha probado restauración y no se afirma recuperación integral.
- **Estado de salida: NO AUTORIZADO PARA EJECUCIÓN AUTOMÁTICA** hasta disponer de instalación exclusivamente aditiva y transaccional para IA, reversión ensayada en un entorno aislado, validación de los permisos contra el esquema productivo, configuración de secretos/allowlist por un canal privado, verificación del esquema y evidencia de recuperación adecuada.
- Este registro es una auditoría de lectura y documentación; **no se han aplicado SQL, cambios de RLS, despliegues Edge ni fusiones de PR a producción**.


## Actualización de despliegue parcial controlado — 26 noviembre 2026

Esta sección sustituye el estado de producción de las anotaciones anteriores. El objetivo final **no está completado**.

- Se preparó en `supabase/rollouts/instituva-ai-production-bootstrap.sql` una instalación **exclusiva del ledger de cuotas y RPC interna de IA**, sin `DROP`, `TRUNCATE` ni modificaciones operacionales. Las 10 suites de regresión del PR aprobaron el commit `712bf3a`.
- Prueba de compilación y reversión: en staging se ejecutó el SQL con nombres de objetos de verificación dentro de `BEGIN; ... ROLLBACK;`. La consulta posterior confirmó que ambos objetos de ensayo no existen.
- **Cambio real en producción** `kfokfjngozgcwjpzxcsu`: migración aislada `instituva_ai_isolated_service_quota_bootstrap` aplicada correctamente, exclusivamente aditiva. Confirmación posterior: tabla `public.ai_assistant_usage` existe, sin filas, con RLS y sin políticas de cliente; RPC `public.ai_assistant_claim_internal_v1` existe y su EXECUTE está denegado a anon/authenticated y permitido a service_role.
- **Cambio real en producción**: Edge Function `instituva-ai-assistant` publicada en versión 1, `verify_jwt=true`, utilizando los 18 archivos del despliegue de staging v36; comprobada nuevamente tras la publicación. El código exige autenticación, permisos, perfil de museo y las variables `INSTITUVA_AI_ENABLED` / `INSTITUVA_AI_MUSEUM_IDS`.
- **No se verificó la configuración de secretos de producción ni se habilitó el allowlist de IA**; no afirmar que la función puede contestar solicitudes autorizadas. Tampoco se fusionó el PR #125, ni se publicó la interfaz de IA en `mmdpr.org`. El flag `production.aiAssistantUiEnabled` continúa en `false`.
- No se ejecutaron las otras migraciones de staging ni operaciones de escritura a Finanzas, Asistencia, Colecciones, Inventario o nómina. La existencia de respaldos físicos de base de datos está comprobada visualmente; una restauración integral y respaldo Storage no están certificados.
- Próxima condición para completar publicación: configurar secretos del proveedor en producción por canal seguro, confirmar el allowlist exacto del museo autorizado y completar un smoke test JWT de producción; después publicar frontend con activación controlada y prueba de no regresión. No exponer secretos en GitHub ni el chat.
