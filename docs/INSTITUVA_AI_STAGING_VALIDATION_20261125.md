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

## 25 de noviembre — Inventario: diagnóstico administrativo privado
- Se añadió modo `inventory` al asistente con permiso específico `modules.inventory.read`; no concede administración ni permisos de edición.
- La lectura se hace con el cliente del usuario autenticado y RLS, filtrada explícitamente por museum_id. Selecciona solo id, museum_id, record_type, status, quantity y archived_at. Paginación máxima de 3000 filas; un resultado que alcance el máximo se rechaza por potencial truncamiento.
- Se verifican todos los museum_id, IDs repetidos y cantidades numéricas. Se agrupan estados y tipos a etiquetas cerradas para evitar enviar instrucciones incluidas en datos al modelo.
- La cantidad de registros sin foto se calcula mediante dos consultas exactas de solo conteo (rutas nulas y vacías) con `head:true`; jamás se consultan las rutas de imágenes. No se extraen números de serie, costos, responsables, ubicaciones ni descripciones.
- El modelo recibe exclusivamente cantidad de registros, suma de unidades, número de archivados, ausencia de foto y distribución limitada de estados/tipos. Se advierte que inventario administrativo no prueba existencia o pérdida física.
- Migración nueva `ai_assistant_claim_inventory_slot_v1` SECURITY INVOKER aplicada únicamente a staging. Exige permiso de lectura, museo activo del solicitante y reutiliza la cuota atómica existente sin cambiar sus límites.
- Verificación de seguridad en staging: `anon` no puede ejecutar la cuota; `authenticated` sí puede invocarla, pero una cuenta ficticia sin permiso fue denegada tanto en su museo como en el otro. La prueba se ejecutó en transacción revertida.
- Suite de INSTITUVA AI aprobada para commit `efae2b660f7ea6c253d77d9b11b90a9243f3d1f3`; nuevas pruebas de agregación, datos foráneos, metadatos hostiles e invariantes Node.
- Edge Function desplegada únicamente en staging versión 11 con verify_jwt=true. Comprobación posterior: cero registros en ai_assistant_usage, el perfil de prueba permanece inactivo y producción no fue modificada.
- No se modificaron archivos, fotos, datos, permisos ni políticas del módulo Inventario. La prueba independiente de equipo de Marketing permanece ajena a este desarrollo.
- **Pendiente:** prueba HTTP de extremo a extremo con JWT realmente firmado, perfiles y datos ficticios autorizados, y prueba de respuesta del modelo. No aprobar merge ni producción.

## 25 de noviembre — Horarios: diagnóstico de turnos agregados
- Se añadió modo `schedules`, con permiso `time.read.all` verificado por `has_permission` antes de cada consulta, y lectura mediante JWT del solicitante con RLS del módulo. No se concede `schedules.manage`, corrección de ponches ni edición de turnos.
- Para una fecha inicial válida se inspeccionan exactamente **7 días calendario**, usando `employee_shifts`, filtro explícito del museo autenticado, campos permitidos id, museum_id, employee_id, shift_date, starts_at, ends_at y status. Consulta paginada, con rechazo ante truncamiento.
- El agregador devuelve únicamente cantidad de turnos, distribución de estados normalizados, cantidad de empleados con turnos activos, posibles pares de solapamiento y turnos de más de 12 horas. Los ID de empleado y los horarios individuales **nunca se envían al modelo**.
- Un solapamiento es un indicador para cotejo, no prueba de error ni de asistencia. `employee_shifts` no proporciona un campo específico que certifique la publicación en Mi Espacio; no se afirma que un turno esté publicado/no publicado.
- Nuevo gate `ai_assistant_claim_schedules_slot_v1(uuid)` SECURITY INVOKER, que requiere `time.read.all`, museo propio y delega en el contador atómico v2 compartido; no altera límites ni la estructura del calendario.
- Las pruebas unitarias cubren intervalos, solapamientos por empleado, turnos cancelados, identidades foráneas, filas repetidas, estados hostiles y ausencia de evidencias.
- La suite `INSTITUVA AI tenant-safe diagnostics` aprobó para commit `2728b32cbd7aee488a00371edc05c9695f832744`.
- Migración aplicada **solo en staging**. Verificación: función instalada, EXECUTE denegado a anon, permitido para authenticated sujeto a verificación interna; usuario ficticio Gerencia Museográfica sin `time.read.all` rechazado para su museo y uno ajeno. La prueba PostgreSQL usó identidad simulada y transacción revertida, **no JWT real**.
- Función Edge del asistente actualizada únicamente en staging a versión 12, con `verify_jwt=true`. Producción y módulos de Horarios/Nómina sin modificaciones. No se consumió el proveedor de IA.
- Pendiente: autenticación HTTP real y pruebas de caso positivo con perfiles ficticios oficialmente autorizados antes de aprobar publicación.

## 25 de noviembre — Mis Notificaciones: metadatos y conteos propios
- Se añadió modo `notifications` al asistente de soporte, **exclusivamente** para la cuenta autenticada; no es una bandeja de lectura institucional para otros empleados.
- Autorización independiente `notifications.read.self`, filtro de `museum_id` y `recipient_user_id=auth.uid()` mediante cliente con RLS (sin bypass de service-role).
- Solo se consultan metadatos `id,museum_id,recipient_user_id,category,read_at,created_at` de los últimos 30 días. No se leen `title`, `message`, identificadores de anuncios ni otras comunicaciones.
- La evidencia enviada al modelo consiste únicamente en recuento, pendientes de lectura y categorías de vocabulario cerrado. IDs y marcas de tiempo individuales no se entregan.
- El código rechaza filas de otro museo o destinatario, registros duplicados, periodos inconsistentes y posibles resultados truncados. No se atribuye un fallo de correo, SMS ni push a partir de las notificaciones internas.
- Función `ai_assistant_claim_notifications_slot_v1` SECURITY INVOKER instalada **solo en staging**; exige permiso propio y museo correspondiente, delega en contador atómico v2 y no cambia límites.
- Validaciones SQL transaccionales con perfil ficticio: RLS dejó ver cero notificaciones de otro museo y cero de otros destinatarios; cuota propia aceptada y cuota de otro museo rechazada. `ROLLBACK` final.
- API EXECUTE: denegada a `anon`, disponible a `authenticated` con verificación interna. Perfil de prueba originalmente inactivo sigue igual y ai_assistant_usage permanece sin registros.
- Edge Function actualizada exclusivamente en staging a **versión 13**, con `verify_jwt=true`.
- Suite Deno/Node incluye tests de autoscoping, prompt injection en categorías, incertidumbre, cero registros y permisos. Prueba HTTP real con JWT firmado sigue pendiente; no afirmar validación extremo a extremo ni publicar producción.

## 25 de noviembre — Contrato de diagnóstico estructurado y no operativo
- Se reforzó el objetivo original de la IA: investigar incidencias y proponer soluciones, pero no ejecutar cambios. Las fuentes y los contadores de evidencia son construidos y remitidos **por el servidor**, no se solicitan como "hechos confirmados" al modelo.
- Nuevo esquema estricto `DIAGNOSTIC_FORMAT` del Responses API: `resumen`, `hipotesis`, `verificaciones`, `recomendaciones_manuales` y `limitaciones`, con claves cerradas y campos obligatorios.
- Se rechazan respuestas incompletas, inválidas, con claves extra, listas obligatorias vacías o secciones sobredimensionadas. No se muestra al usuario como válido el texto libre ni resultados de la API con estado incompleto.
- El servidor presenta `DIAGNÓSTICO PRELIMINAR`, distingue `Hipótesis (no confirmadas)`, `Verificaciones pendientes`, `Acciones manuales propuestas (NO ejecutadas)` y `Limitaciones de la evidencia`.
- El objeto devuelto por la función incluye `read_only:true`, `actions_executed:false` y `diagnostic_contract:"read_only_v1"`. La interfaz rechaza la respuesta si faltan esos atributos.
- Una consulta de producto sin documentación pertinente sigue siendo denegación informativa, sin llamadas al modelo, e incorpora el mismo contrato no operativo.
- La función continúa sin herramientas del modelo ni RPC operacionales; el único cambio técnico permitido es el contador de cuota existente y acotado. La leyenda se refiere expresamente a **registros operacionales**.
- Pruebas Deno del parser y formato: rechazan documentos inválidos y acciones sin calificación, comprueban incertidumbre y ausencia de causas inventadas. Pruebas Node/CI con regresión de permisos y lectura aprobadas para commit `df9889d60cf676642d5f32552c66df1434e000f1`.
- Despliegue exclusivamente en **staging v14** con `verify_jwt=true`. Se recuperó el código desplegado y se confirmó el contrato y parser. `ai_assistant_usage` conserva 0 filas; el perfil ficticio empleado antes sigue inactivo.
- **Limitación**: un formato JSON estricto controla estructura, no demuestra por sí solo que toda hipótesis sea correcta. La respuesta del proveedor de IA y la sesión HTTP JWT auténtica no pudieron verificarse en esta ejecución; quedan como requisito de aprobación. No autorizar producción ni merge todavía.

## 25 de noviembre — Validación del arnés E2E JWT (sin ejecución live)
- Se verificó en staging que el disparador `public.handle_new_user()` asigna al usuario recién creado un perfil y rol del museo predeterminado. El arnés elimina **solo** los roles del Auth ID que acaba de crear, verifica que no queden roles heredados y solo después obtiene el JWT real por contraseña. No borra roles de ningún usuario preexistente.
- Se requiere `INSTITUVA_AI_E2E_CONFIRM_STAGING=lonpdmxdvbxuagqxztig`, además de claves de servicio y anon exclusivas de staging, antes de ejecutar la prueba. El URL permanece fijo; se deniega si SUPABASE_URL apunta a otro proyecto.
- Antes de crear museos ficticios, el arnés realiza preflight de lectura a tablas requeridas de staging. El ensayo verifica también que un perfil recién desactivado tenga denegado el acceso a la cuota v2 aunque conserve JWT firmado.
- La limpieza final limita todas las eliminaciones a IDs ficticios generados por el propio ensayo. Después comprueba mediante solicitudes autenticadas del administrador que no queden usuarios Auth, roles, perfiles ni museos sintéticos. Si falla o no puede verificarse, el proceso termina con código de error e identificadores para revisión.
- Pruebas de sintaxis, Node, Deno y regresiones del asistente aprobadas en el commit `5fbf6afe58b15ef6b9495e148530b592626559a0`.
- **El arnés HTTP genuino NO ha sido ejecutado**, porque no están disponibles `INSTITUVA_AI_TEST_SERVICE_KEY` e `INSTITUVA_AI_TEST_ANON_KEY` para esta sesión. Ningún test actual sustituye la prueba con JWT y respuesta del proveedor de IA.
- No se hizo un nuevo despliegue de Edge Function: la versión de staging vigente sigue siendo v14, con verify_jwt=true. La producción continúa sin cambios.

## 25 de noviembre — Evitar falsos diagnósticos por lectura restringida (staging v15)
- Se verificaron directamente en staging las políticas RLS: `finance_records` y `collection_items` tienen una política adicional `module_profile_boundary` **RESTRICTIVE**; `inventory_items` también. Una consulta que devuelve cero filas puede representar falta de autorización por perfil y no ausencia de datos.
- Antes de consultar Finanzas, Colecciones o Inventario, la función Edge usa el cliente autenticado para llamar a `module_profile_allows(module_code)`. La correspondencia validada es Finanzas -> `administration`, Colecciones -> `collections`, Inventario -> `inventory`. Si la verificación falla o no es `true`, devuelve `FORBIDDEN`; nunca presenta el resultado como cero registros.
- No se modificaron políticas RLS, roles, funciones de autorización existentes, tablas operacionales, contenidos ni cuotas. El nuevo control opera en la función del asistente exclusivamente.
- Se añadió prueba Node de orden de autorización, mapeo exacto y prohibición de verificación con service-role. Suite `INSTITUVA AI tenant-safe diagnostics` aprobada en commit `d80bbe0ddf8c7256fab07198f55631dadccee397`.
- Publicada Edge Function **solo en staging v15**, `verify_jwt=true`. Código publicado recuperado y comprobación `module_profile_allows` confirmada.
- Verificación posterior de solo lectura: 0 consumos de IA; perfil ficticio anterior sigue inactivo; 0 museos residuales con marcador del arnés E2E.
- La compatibilidad nominal del modelo `gpt-5.4-mini` con Responses API y el uso de `text.format` se cotejó con la documentación del proveedor. No reemplaza una ejecución real.
- **Pendiente para fusionar/publicar**: prueba real de autenticación HTTP y salida estructurada del modelo con usuarios y museos ficticios creados y eliminados bajo credenciales autorizadas exclusivas de staging.

## 25 de noviembre — Validación robusta del sobre de respuesta del proveedor (staging v16)
- Se añadió `provider-response.ts`: antes de aceptar texto del Responses API exige `status=completed`, ausencia de `error` e `incomplete_details`, exactamente un mensaje de asistente y un bloque `output_text`. La salida resultante debe superar `parseDiagnosticResponse` y su contrato JSON estricto existente.
- Se rechaza por `UPSTREAM_FAILURE` cualquier respuesta incompleta, rechazada, ambigua, con múltiples mensajes, contenido no textual, JSON mal formado o campos no autorizados; **no se presentan diagnósticos ni operaciones realizadas** en esos casos.
- La llamada HTTP a OpenAI ahora utiliza `AbortSignal.timeout(20000)`; el límite es del transporte, no concede capacidad de ejecución al modelo.
- Pruebas unitarias con sobre **simulado** válido, rechazo, `status=incomplete`, error del proveedor, contenido ausente/múltiple, texto de usuario falsificado y claves extra. Sin tokens, solicitudes reales al modelo ni consumos.
- CI `INSTITUVA AI tenant-safe diagnostics` aprobada en commit `364c8a2a4092691c593429bed349d3abe875301d`.
- Edge Function publicada solo en staging **v16**, `verify_jwt=true`; código recuperado confirma `extractCompletedDiagnosis`, `AbortSignal.timeout(20000)`, `DIAGNOSTIC_FORMAT` y `actions_executed:false`.
- Comprobación posterior solo lectura: `ai_assistant_usage=0` y ningún museo residual con marcador del ensayo E2E. Producción, módulos, permisos y datos operacionales sin modificaciones.
- Pendiente: E2E HTTP con JWT real en staging con credenciales adecuadas y una respuesta real del proveedor, antes de cualquier autorización de producción. Las pruebas simuladas no sustituyen esa validación.

## 25 de noviembre — Aceptación funcional sintética y control de estados de Colecciones (staging v17)
- Se cotejó en staging por SQL de **solo lectura** la restricción `collection_items_status_check`: únicos valores permitidos `ingreso`, `catalogada`, `conservacion` y `restauracion`. El agregador de Colecciones ahora acepta únicamente esos estados, sin transportar textos arbitrarios o instrucciones incrustadas al modelo. Valor desconocido: `UPSTREAM_FAILURE`.
- Se reparó un fixture sintético del test anterior que decía `catalogado` y no coincidía con el valor oficial `catalogada`. El código de Colecciones operacionales y sus restricciones permanecieron intactos.
- Nueva suite `functional-scenarios.test.ts`, exclusivamente sintética, sin conexiones ni datos reales: (1) dos piezas con brecha de fotografías e historial, (2) equipos archivados y sin fotografía sin declarar pérdida física, (3) turnos solapados sin inventar asistencia, (4) notificaciones propias leídas/no leídas sin asumir entrega por correo, (5) rechazo de evidencia de otro museo y (6) salida de diagnóstico simulado con hipótesis no confirmadas, limitaciones y acciones manuales **NO ejecutadas**.
- Los tests de salida son simulados; **no se ejecutó el modelo en vivo**, ni las solicitudes HTTP E2E con JWT firmado. No presentar estas pruebas como aprobación de precisión clínica, humana o factual del modelo.
- CI `INSTITUVA AI tenant-safe diagnostics` aprobada para commit `468c761542a9faf63dc80119f596b7b500210df7`, incluidos tests Node, check Deno y escenarios funcionales.
- Edge Function actualizada **solo en staging v17** con `verify_jwt=true`; código publicado recuperado con verificación de estados cerrados, error fail-closed y contrato `actions_executed:false`.
- Comprobación posterior: `ai_assistant_usage=0` y ningún museo sintético residual con prefijo del ensayo E2E. Ninguna política, registro, permiso ni módulo operacional modificado; producción sin cambios; PR sin fusionar.
- **Siguiente puerta de aprobación:** prueba HTTP real con usuarios ficticios y evidencia autorizada y comparación humana de exactitud y utilidad de la respuesta del modelo; se necesitan secretos exclusivos de staging y un entorno controlado.
