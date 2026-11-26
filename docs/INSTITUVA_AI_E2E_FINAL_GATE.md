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
