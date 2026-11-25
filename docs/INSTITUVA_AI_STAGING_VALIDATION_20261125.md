# INSTITUVA AI — staging: validación de aislamiento
Fecha: 2026-11-25. PR #125. Proyecto: instituva staging (lonpdmxdvbxuagqxztig).
**Resultado: verificaciones de base de datos aprobadas; ensayo integral con JWT real pendiente. No autoriza producción.**

## Hallazgo y corrección
- finance_records.month es TEXT con meses fiscales en español, no entero. Se corrigió la validación y el tipado en el PR, sin cambiar datos ni esquema.
- Despliegue de Edge Function versión 5 únicamente en staging, verify_jwt=true, con validación explícita de tenant y cuota v2.
- CI INSTITUVA AI: éxito para e43c1d88eba309362772e4a8c51f0bf244122b9e.

## Verificaciones ejecutadas
- Dos museos y perfiles de prueba preexistentes, todos originalmente inactivos.
- Contexto de rol authenticated y request.jwt.claim.sub SIMULADO en transacción PostgreSQL: comprueba RLS/SQL, no login HTTP real.
- Activación transitoria exclusivamente de perfiles ficticios dentro de BEGIN/ROLLBACK.
- Museo A: museo resuelto, sin acceso a registros financieros de otro museo y sin acceso a perfiles del museo B.
- Museo B: solo perfil propio; cuota de modo product aceptada; finance.read y attendance.history.read denegados.
- La función de cuota rechazó museo extranjero y modos privados sin autorización; acceso directo a tabla de cuota denegado.
- Post verificación: ai_assistant_usage en 0 registros y dos perfiles ficticios siguieron inactivos.
- Sin cambios persistentes en museos, empleados, finanzas, ponches, documentos, ni fotografías.

## Pruebas todavía pendientes
1. Login Supabase Auth con JWT real de cuentas ficticias activas de dos museos.
2. Solicitudes HTTP autenticadas a Edge Function desde la interfaz y revisión del flujo completo.
3. Casos positivos de permisos finance.read / Asistencia con registros únicamente sintéticos.
4. Verificación de respuesta del proveedor de IA, presentación del diagnóstico y ausencia de datos sensibles.
5. Confirmar feature flag y allowlist efectiva sin exponer secretos, antes de activar IA.

## Condición para aprobar despliegue
Completar los cinco pasos pendientes. No realizar merge ni habilitar producción con estas pruebas parciales.

Nota: Marketing equipment inventory guard sigue fallando por pruebas independientes de caché de fotos y formulario; no se modificó Inventario.
## Extensión: ensayo HTTP Auth genuino preparado (no ejecutado)
- Nuevo arnés: supabase/tests/instituva-ai-auth-staging.mjs.
- Crea **dos museos y dos usuarios desechables** por la API Admin de Supabase Auth únicamente en el proyecto staging fijado; usa contraseñas aleatorias, correos example.invalid, sin correo saliente.
- Obtiene JWT firmados mediante Auth password grant, verifica endpoint /auth/v1/user, aislamiento RLS vía PostgREST, permisos financieros/laborales, denegación de RPC de cuota de otro museo y denegación de la Edge Function en modos privados.
- Evita llamadas al modelo, consultas positivas de datos de empleados y cualquier escritura operacional.
- Borra exclusivamente sus cuotas de prueba, permisos, registros de auditoría generados por sus museos, usuarios y museos desechables; registra IDs para recuperación manual si la limpieza falla.
- Requiere INSTITUVA_AI_TEST_SERVICE_KEY y INSTITUVA_AI_TEST_ANON_KEY de **staging**. No hay credenciales administrativas de prueba disponibles mediante los conectores para ejecutarlo en esta sesión, por lo que **no se afirma prueba HTTP Auth completada**.
- Validación de sintaxis incluida en CI del PR. Para ejecutarlo en entorno autorizado: `node supabase/tests/instituva-ai-auth-staging.mjs` con las dos variables secretas establecidas en el entorno (no en archivos ni en Git).
- Los escenarios positivos de Finance/Asistencia con usuarios autorizados y la respuesta IA siguen pendientes.
## 25 de noviembre — Refuerzo de evidencia laboral (PR #125)
- Protección del servicio: cada fila de employee_shifts, attendance_events, attendance_operational_alerts y employee_time_entries incluye museo y empleado para comprobar ambas identidades antes de construir evidencia para el modelo.
- La respuesta se rechaza si un registro pertenece a otro museo o a otro empleado, si falta alguno de los identificadores, o si una consulta alcanza el máximo establecido y pudiera estar truncada.
- Se añadieron pruebas Deno sintéticas de registros propios, registros foráneos y falta de identificadores, además de inspecciones estáticas Node.
- CI de INSTITUVA AI y regresiones de los módulos vecinos: aprobados en commit 0586bc6c1ca44a38ce7050bb71dee94e480d6163 (Inventario de Marketing conserva fallo histórico independiente).
- Edge Function versión 6 desplegada solamente en staging, con verify_jwt=true. Producción sin cambios.
- En staging se ensayó autorización positiva mediante permisos temporalmente asignados a una cuenta ficticia de perfil Gerencia Museográfica; el sistema negó Finanzas/Asistencia porque también aplica la barrera del perfil departamental. Intento de cambiar temporalmente el perfil a Director Ejecutivo fue rechazado por el control existente MODULE_PROFILE_ASSIGNMENT_REQUIRED. No se intentó eludirlo.
- Las operaciones se revirtieron: la cuenta ficticia mantiene status inactive, perfil gerente_museografica, cero permisos adicionales y cero registros de cuota.
- **Continúa pendiente** la prueba E2E con sesiones Auth reales y perfiles de Director Ejecutivo, Administrador General y Gerente Administrativo otorgados mediante los flujos oficiales. No afirmar que está validada.

## 25 de noviembre — Recuperación de evidencia diagnóstica y ensayo JWT
- Se identificó un sombreado de variable en la rama Asistencia: el servicio construía una instantánea local y el modelo recibía el contexto externo vacío, aunque el recuento de evidencia sí se mostraba. Se corrigió asignando al contexto compartido y se incorporó una prueba Node para impedir regresión.
- Se amplió el arnés HTTP JWT de staging con tres casos negativos adicionales: museo ficticio no incluido en la allowlist (503), modo de operación inválido (400) y perfil ficticio desactivado que conserva JWT válido (403).
- Los tres casos están **preparados pero no ejecutados con JWT genuino**: siguen sin estar disponibles las credenciales API administrativas de staging a través de las herramientas actuales.
- Pruebas automáticas de IA completadas con éxito en commit d7078399b2713c2257e6a3e9bad71771d001f96a. La versión 7 de Edge Function quedó desplegada únicamente en staging con verify_jwt=true.
- Confirmación posterior: 0 consumos en la tabla de cuota de IA. No se ejecutaron peticiones al proveedor de IA ni se activaron museos nuevos.
- El fallo independiente en el control CI de Inventario de equipos de Marketing no fue alterado.
- Sigue prohibido fusionar o activar el producto antes del flujo HTTP real con dos museos y cuentas ficticias y los casos positivos autorizados de Finanzas/Asistencia.

## 25 de noviembre — Jornadas abiertas anteriores y evidencia completa
- Se agregó una segunda lectura **únicamente de employee_time_entries abiertos con clock_in previo al día consultado**, siempre filtrando por el museum_id autenticado y employee_id resuelto. Se devuelven solo clock_in, clock_out, excluded_at e identificadores de ámbito para verificación, sin acceder a otros empleados.
- El contexto de Asistencia ahora distingue time_entries del día solicitado de previous_open_entries anteriores y proporciona ambos recuentos. Evita descartar un registro abierto que bloquea nuevos ponches solo por ser de otro día.
- El máximo de la consulta histórica abierta es 10 filas; al alcanzarlo, la solicitud se rechaza por evidencia posiblemente incompleta. Se mantienen límites de las consultas existentes y el control de museo/empleado en todas las filas.
- También se rechaza buscar un empleado en un listado que alcance las 300 filas máximas; el listado truncado no garantiza unicidad ni ausencia del nombre.
- Nueva validación de días calendario, incluidos años bisiestos, con tests unitarios independientes.
- Suite de INSTITUVA AI aprobada en commit fc094d065c447810a1cf5a45835f04d9cd603154. Edge Function versión 8 desplegada solo en staging con verify_jwt=true; producción sin cambios.
- No se activaron museos, se hicieron llamadas al modelo, se ejecutaron correcciones de ponches ni se modificaron documentos, nómina o Finanzas.
- Falta la ejecución HTTP con usuarios ficticios reales, bajo credenciales administrativas exclusivas de staging; no constituye aprobación de publicación.

## 25 de noviembre — Verificación adicional del vínculo de categorías financieras
- Auditoría de **solo lectura** en staging de las FK de finance_records y finance_budget_lines: la relación budget_line_id referencia el id de la línea, pero NO tiene una restricción compuesta que obligue igualdad de museum_id.
- Se verificaron 648 registros presupuestarios en staging: cero líneas vinculadas ausentes, cero líneas de otro museo. Esto no prueba que sea imposible una anomalía futura.
- El asistente ahora solicita explícitamente finance_budget_lines.museum_id y rechaza cualquier línea embebida cuyo museo difiera del autorizado; no utiliza el modelo ni calcula importes ante ese error.
- Se actualizaron las aserciones de regresión para evitar la pérdida de este control y la suite de INSTITUVA AI aprobó en commit b9a9fe15987fd99ccf8559571018b96e4005d1b6.
- La Edge Function del asistente se desplegó solo en **staging v9**, con verify_jwt=true y guardia de línea verificada desde su código recuperado.
- Comprobación posterior: tabla ai_assistant_usage sin registros; no se cambiaron datos financieros, FK, RLS, permisos ni producción.
- Las pruebas HTTP E2E con JWT firmados de los perfiles institucionales continúan **pendientes** de credenciales exclusivas de staging. No habilitar ni fusionar hasta completarlas.

## 25 de noviembre — Colecciones: primer diagnóstico privado real
- Se incorpora modo **collections** al asistente, con autorización collections.read, museos habilitados explícitamente y consultas exclusivamente a través del cliente autenticado con RLS. Sin service-role para las colecciones.
- Lecturas limitadas y paginadas de tres fuentes: collection_items (id, museum_id, status), collection_photos (id, museum_id, item_id) y collection_history (id, museum_id, item_id). No se consultan títulos, descripciones, propietarios, JSON patrimonial, nombres de actores, rutas, ni imágenes.
- La función de resumen rechaza filas de museo extranjero, fotos/historial vinculados a piezas no visibles, IDs duplicados y datasets posiblemente truncados. Solo se envían al modelo conteos, estados resumidos y advertencias explícitas de incertidumbre.
- Nueva función de base de datos ai_assistant_claim_collections_slot_v1(uuid) SECURITY INVOKER, aislada; requiere collections.read y collection_can_read, verifica museo y delega en la cuota atómica v2 existente. No modifica los límites ni los módulos de la aplicación.
- Migración nueva aplicada **solo en staging**, sin DML sobre Colecciones; execute autorizado a authenticated y denegado a anon.
- Prueba transaccional (SQL, JWT simulado) de usuario ficticio Gerencia Museográfica: collections.read=true, collection_can_read=true, cuota propia autorizada; cuota de otro museo rechazada. RLS: una pieza propia visible y cero piezas, fotos o historial del museo ajeno. ROLLBACK aplicado.
- La Edge Function se desplegó **solo en staging v10** con verify_jwt=true. Aún falta E2E real con dos JWT genuinos y pruebas positivas de la generación de diagnóstico.
- Verificación posterior: ai_assistant_usage=0; perfil ficticio utilizado permanece inactive. Producción sin cambios. No se tocó el módulo original de Colecciones.
- Se añadieron pruebas sintéticas de aislamiento y conteo, verificaciones estáticas del endpoint y casos negativos en el futuro ensayo HTTP con Auth real.
