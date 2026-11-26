# INSTITUVA — Arquitectura objetivo del asistente integral de IA
**Estado:** arquitectura aprobada. Etapa A parcial implementada en rama PR #125 y staging. Etapa B: piloto de cruce de conteos Colecciones + Inventario en rama y staging v33, pendiente de prueba positiva con JWT real y ambos permisos; el acceso privado integral continúa pendiente. Etapa C: guía humana paso a paso incorporada al código (frontend en rama, backend en staging v33), pendiente de validación manual de interfaz. Etapa D pendiente. **NO habilitada en producción**.
**Fecha:** 2026-11-25.

## 1. Propósito y propiedad
El asistente es un **servicio de INSTITUVA**, compartido entre museos pero aislado por `museum_id`. Su función es explicar cómo opera la aplicación completa (módulos, permisos, procesos, gobernanza, limitaciones, problemas técnicos, logística y documentación operativa), diagnosticar hechos **mediante consultas de solo lectura autorizadas** y orientar al usuario sobre acciones manuales dentro de la interfaz. No escribe ni corrige información del museo.

Dos universos deliberadamente distintos:
- **Conocimiento global del producto:** código **revisado** del repositorio de INSTITUVA, migraciones vigentes, funciones Edge, documentación técnica, manuales, gobernanza aprobada, flujos de trabajo, mensajes de error y procedimientos. Disponible como conocimiento de consulta, no como credenciales ni herramientas para desplegar o modificar código.
- **Conocimiento privado de un museo:** sus datos reales de asistencia, nómina, colecciones, inventario, finanzas, documentos, calendarios y auditorías, siempre **únicamente** dentro de los permisos que posee la persona autenticada. No se comparte entre museos ni se incorpora a un índice global.

El repositorio GitHub de **programación** es un producto compartido, no un depósito segregado de información personal de cada museo. Si cada museo dispone de un repositorio documental propio, debe registrarse como fuente separada y autorizarse individualmente; no se debe inferir que todos utilizan un repositorio GitHub propio.

## 2. Plano de conocimiento global de INSTITUVA
- Construir un **índice de lectura versionado** a partir de un commit o release aprobado en `main`, nunca del contenido mutable de una rama de trabajo.
- Fuentes autorizadas: `docs/`, especificaciones vigentes, catálogo de módulos, páginas/servicios, migraciones y Edge Functions; excluir `.env`, claves, tokens, credenciales históricas, cadenas de conexión, secretos, datos de clientes, fotografías y archivos subidos a Storage.
- **No indexar automáticamente todo el repositorio**: seleccionar rutas, extraer reglas y dependencias, resolver documentos desactualizados, anotar nivel de confianza y fuente exacta (`ruta, commit, sección`).
- Generar un catálogo de capacidades, permisos, estados y errores con revisión técnica. No inferir que un módulo está en producción solo por aparecer en una especificación antigua.
- El asistente recuperará los pasajes relevantes mediante búsqueda semántica y lexical sobre el índice **global**. Responderá con citas al origen, versión y advertencia cuando haya contradicción entre documentación y código vigente.
- Actualización **solo después de revisiones/aprobaciones de código** y pruebas del índice. Jamás otorgar al modelo acceso directo para hacer commits, merges, SQL, despliegues o cambios de configuración.

## 3. Plano de datos privados por museo
- Autenticar token de sesión con Supabase Auth y resolver en servidor `user_id`, `museum_id`, estado del perfil y permisos vigentes; nunca confiar en `museum_id`, `role` o nombre de museo del navegador.
- **Catálogo explícito de consultas de solo lectura** por dominio: asistencia, nómina, finanzas, colecciones, inventario, calendario, documentos, mantenimientos, seguridad/bitácora según rol. Cada consulta tiene identificador y esquema de parámetros fijados.
- Para cada dominio se aplica autorización **antes de leer**; una persona con solo `finance.read` nunca obtendrá registros laborales o personales de otros empleados. Usuarios de múltiples museos necesitan selección de museo autorizada y sesión contextual segura.
- Limitar campos y periodos por tipo de consulta; evitar datos médicos, dirección, identificación personal, cuentas bancarias, fotografías y contenido documental sensible salvo permisos y finalidad explícitos.
- Preferir RPC/funciones de lectura restringidas y auditadas, con políticas RLS comprobadas. Un cliente con credencial de servicio, cuando sea estrictamente necesario, solo puede ejecutar consultas de lista blanca tras autorización del usuario; no transmitir esa credencial al modelo.
- En el caso de un **repositorio documental del museo** (Drive, biblioteca o NAS), integrarlo por conector autorizado, identidad/ACL del usuario y filtros de museo. No recorrer todo NAS/Storage por defecto ni aceptar URLs de usuario como origen de lectura privilegiada.
- Nunca agregar contenido privado de museos al índice global de producto. Los índices privados, si se autorizan en una fase posterior, usarán namespaces, políticas de lectura, retención y eliminación por museo.
- Toda respuesta sobre registros debe precisar fecha de consulta, período, fuente y ausencias de evidencia. Un turno programado no prueba presencia; una alerta no demuestra causa de error de geocerca.

## 4. Orquestación segura
```
Usuario del Museo A
  -> portal autenticado INSTITUVA (sin credenciales de administrador)
  -> API de asistencia IA (JWT, permisos, límites, auditoría)
  -> clasificador de intención CON REGLAS (producto / datos de museo / mixto)
      -> producto: índice global versionado de código + documentación
      -> datos: catálogo de consultas de solo lectura autorizado al museo A
      -> mixto: ambos, con fuentes separadas
  -> modelo de IA sin herramientas de escritura
  -> respuesta clara con evidencia, instrucciones UI y límites
```

**Prohibido:** SQL libre del modelo; ejecución de código proporcionado por usuarios; `service_role` en navegador/modelo; herramientas que escriban datos reales; cross-tenant joins; mostrar excepciones SQL internas; que documentos recuperados puedan ordenar al modelo revelar datos o ignorar permisos.

**Salida estructurada:** Resumen, **Qué dicen los registros**, **Por qué podría pasar**, **Cómo revisarlo**, **Qué no está demostrado**, fuentes consultadas. Advertir ante incertidumbre y separar hipótesis de hechos.

## 5. Roles y despliegue
- No existe permiso universal de IA para ver todo. La IA **hereda el menor privilegio del usuario** en cada dominio.
- El Administrador General puede formular preguntas amplias **solo** dentro del museo al que está autorizado.
- El contable externo solo lectura puede consultar conocimiento de INSTITUVA y, si se habilita esa experiencia, datos de finanzas bajo `finance.read`, nunca asistencia de terceros por herencia.
- La habilitación es por museo (flag off por defecto) y, posteriormente, por módulo; claves API solo como secretos del servidor, cuota/monitoreo por museo y usuario.
- Antes del primer dato real enviado al proveedor externo: evaluación de privacidad, aviso contractual, minimización de campos, `store:false`, presupuesto con alertas y validación manual de diagnósticos.

## 6. Etapas de implementación sin romper módulos
**Etapa A — Conocimiento institucional global:** catálogo del repositorio, extractos técnicos y procedimientos versionados; índice no sensible; probar preguntas de soporte general. No toca base operativa.
**Etapa B — Lectura privada por museo:** integrar asistencia/nómina con consultas de solo lectura autorizadas y pruebas de aislamiento cruzado; extender progresivamente a finanzas, colecciones, inventario y demás dominios.
**Etapa C — Experiencia integral:** chat de consulta general sin necesidad de indicar de antemano empleado/fecha; solicitar precisiones solo cuando sea necesario; respuesta con fuentes y vínculo a pantallas permitidas.
**Etapa D — Observabilidad, costos y expansión:** monitorizar precisión, auditoría mínima, cuotas, cambios versionados y habilitación por institución.

## 7. Pruebas de aceptación indispensables
1. Preguntas sobre gobernanza, módulos y código vigente responden con fuente y commit; reconocen documentación obsoleta.
2. Usuario del Museo A nunca obtiene filas, documentos ni índice privado del Museo B.
3. Contable externo no consigue registros de asistencia ajenos ni puede usar la IA para modificar Finanzas.
4. El asistente no puede alterar nómina, ponches, cheques, inventario, ni abrir conexiones SQL de escritura.
5. Al revocar permisos o cuenta, cualquier consulta posterior falla incluso con token previo.
6. Documentos maliciosos no convierten instrucciones del usuario ni textos recuperados en llamadas a funciones privilegiadas.
7. Las consultas fallidas no revelan nombres de empleados de otro museo; no hay acceso a claves ni logs sensibles.
8. Pruebas de diagnósticos con datos sintéticos y comparación humana antes de habilitación real.
9. Cuando falta evidencia, la respuesta indica explícitamente lo que no sabe.
10. El costo y la activación se controlan independientemente por museo.

## 8. Estado frente al prototipo v1
`supabase/functions/instituva-ai-assistant/index.ts` en PR #125 solo consulta un empleado, una fecha, turnos, ponches y alertas. **No conoce la programación completa de INSTITUVA ni consulta todos los dominios autorizados**. No considerarlo finalizado, ni activar producción bajo la descripción de "asistente integral", hasta implementar las etapas A–C.

## 9. Avance verificado el 25/nov/2026
- Se añadió `product-knowledge.ts`, catálogo inicial de conocimiento de módulos con referencias al repositorio. Es **curado, parcial y no sensible**; no constituye un índice exhaustivo del código ni autorización para leer repositorios privados.
- La función ahora distingue consultas de producto (`mode=product`) de diagnósticos privados (`mode=attendance`). Preguntas de producto no consultan tablas de empleados; diagnósticos laborales requieren ambos permisos de lectura existentes.
- Se modificó la interfaz para que la consulta de producto no exija nombre de empleado ni fecha, y para mostrar fuentes recuperadas.
- Si no se encuentra una fuente, responde que la documentación disponible es insuficiente en vez de inventar.
- Se mantuvieron las cuotas y el indicador de habilitación por museo apagado por defecto.
- Suite CI: Node.js y comprobación de tipos Deno. Función instalada en staging, sin activación del proveedor de IA.
- La siguiente iteración debe ampliar el índice a código y documentación versionados con referencias exactas a `main` aprobado, construir consultas autorizadas adicionales por dominio y pruebas cruzadas de permisos antes de habilitar a clientes.

## 10. Incremento controlado 26/nov/2026 — piloto de evidencia de dos módulos

- En `asistente-ia.html` se añadió el modo `assets` para contrastar **únicamente conteos visibles** de `collection_items` e `inventory_items`. Es una consulta comparativa limitada, no un expediente de reconciliación entre piezas y equipos.
- El servidor exige conjuntamente `collections.read` y `modules.inventory.read`, verifica `module_profile_allows` de ambos dominios y limita las dos lecturas a `museum_id` obtenido del perfil autenticado, con RLS del usuario. No lee ni devuelve filas individuales, identidades, seriales, fotografías, precios ni rutas.
- La respuesta separa fuentes y advierte que las diferencias entre registros de Colecciones e Inventario **no demuestran faltantes, duplicados, pérdidas ni vínculos pieza-equipo**.
- La cuota del piloto utiliza la función existente `ai_assistant_claim_collections_slot_v1`, después de todas las comprobaciones de los dos dominios. No se añaden RPC ni permisos nuevos; la modalidad no incorpora ninguna ruta de escritura.
- La interfaz conserva errores del proveedor, comprueba el modo y el contrato `read_only_v1`, y muestra fuentes como texto literal. Se añadieron regresiones automáticas.
- **Despliegue exclusivo a staging v33, verify_jwt=true, tras CI de IA aprobada. SIN merge ni despliegue en producción.** Verificada denegación de usuario ficticio sin permisos. También se comprobaron en una única transacción revertida: acceso denegado con un solo permiso, aceptación del par `collections.read` + `modules.inventory.read`, validación de ambas barreras de perfil y conteos RLS de cero registros en museo ficticio. Posverificación: 0 permisos, 0 roles, 0 piezas y 0 equipos; no quedaron concesiones. **Estas comprobaciones SQL con identidad simulada NO sustituyen JWT HTTP real**. Aún faltan solicitudes HTTP de extremo a extremo (una y dos autorizaciones, dos museos), con fixtures sintéticos y limpieza verificada. No utilizar datos operacionales reales para esa validación.
- La investigación integral entre Asistencia, Horarios, Finanzas y otros dominios continúa como etapa posterior. Un modo combinado no otorga acceso universal ni sustituye permisos individuales.

## 11. 26/nov/2026 — experiencia humana guiada (incremento de PR #125)

- Se documentó `docs/INSTITUVA_AI_HUMAN_SUPPORT_BEHAVIOR_V1.md`: ejemplos generalizados de incidentes y estilo de asistencia derivados de la experiencia de uso. No se incorpora ninguna conversación privada ni registros de clientes al índice global. Es una **guía de diseño provisional**, no prueba factual de una incidencia actual.
- El modelo tiene instrucciones para explicar el síntoma y la evidencia antes de sugerir comprobaciones y soluciones humanas; debe reconocer desconocidos y no repetir información ya suministrada.
- Las verificaciones y recomendaciones manuales se someten al contrato JSON estricto existente y se proyectan en `guide_steps` con longitud limitada. La UI ofrece el botón **Comenzar guía** solamente después del diagnóstico; muestra un paso a la vez, permite Anterior/Siguiente y no realiza una nueva consulta, mutación ni acción.
- Sin cambios en tablas, roles, políticas RLS, funciones de escritura, secretos, cuotas ni operaciones existentes. Backend `instituva-ai-assistant` en staging v33; frontend solo en rama PR #125, no en web de producción.
- La suite de IA y regresiones de consulta/seguridad pasó. Las pruebas funcionales positivas entre dominios con identidades sintéticas aún están pendientes y no autorizan publicación.

## 12. 26/nov/2026 — validación sintética de Asistencia/Horarios y lectura de intentos

- **Staging únicamente:** se creó temporalmente, dentro de una transacción revertida, el caso `Prueba Jornada` con dos turnos programados, una entrada efectiva el día anterior, la jornada correspondiente sin cierre, un intento posterior `invalid_sequence` y una alerta activa. Se autorizó de forma temporal `attendance.history.read`, `finance.read` y `time.read.all` a una cuenta ficticia.
- La primera validación detectó `SHIFT_TIMEZONE_NOT_CONFIGURED`, por lo que la zona horaria sintética se añadió solo dentro de la transacción; otra validación detectó la restricción `employee_time_entries_one_open`, que impide dos jornadas simultáneamente abiertas. No se deshabilitaron controles. La última validación confirmó lectura de turno y marcación con RLS, detección de jornada abierta previa y la separación de permisos personales: el usuario autorizado a Asistencia NO puede consultar directamente `employees` por RLS, aunque la lectura mínima de empleados del asistente sigue pasando por su ruta administrativa existente, después de autorización independiente y verificación de `museum_id`.
- **Resultado final de la transacción:** 0 empleados, 0 turnos, 0 intentos, 0 eventos, 0 jornadas, 0 alertas, 0 ajustes de Asistencia y 0 permisos adicionales. Los 2 registros de bitácora preexistentes permanecieron intactos. Esta es una prueba SQL con JWT simulado en contexto de base, **no** prueba HTTP autenticada del endpoint ni llamada al modelo.
- Se amplió solo el asistente en PR #125 para incluir, tras los controles previos `attendance.history.read` y `finance.read`, una consulta acotada de `attendance_attempts` por museo, empleado y día. Proyecta únicamente códigos cerrados de `result` y `requested_event`, agrupados por cantidad. No lee ni envía `presence_evidence`, `presence_method`, `actor_user_id`, `reason_code`, GPS ni identificadores individuales.
- El código `invalid_sequence` confirma una clasificación registrada, pero **no demuestra por sí solo por qué se rechazó el intento**. La relación con una jornada anterior abierta sigue siendo hipótesis que requiere cotejo. Sin herramientas operacionales ni escritura, y con rechazo de evidencia truncada o de otro museo/empleado.
- **Desplegada únicamente a Supabase staging v34 con `verify_jwt=true` tras CI de IA aprobada.** Se verificaron el nuevo helper y la consulta de intentos en el código desplegado. No se alteraron permisos ni registros operacionales; el museo ficticio sigue con 0 empleados, turnos, intentos, eventos, jornadas, alertas y configuraciones de prueba. El ensayo E2E con JWT auténtico y datos sintéticos desechables sigue pendiente. No se autoriza producción.

## 13. 26/nov/2026 — resolución de empleados por nombre y aclaración de identidad

- Caso solicitado: `¿Qué pasó con el ponche de ayer de Juan?` Se interpreta como consulta privada de Asistencia, no como pregunta pública de documentación. `ayer` y `hoy` se resuelven en calendario de Puerto Rico; si la fecha o nombre siguen indeterminados, se solicita esa información sin inventarla.
- **Identidad inequívoca antes de leer evidencia.** Tras `attendance.history.read` y `finance.read` y verificar el perfil/museo autenticado, un nombre completo se contrasta exactamente con `first_name + last_name` en ese museo. No se elige automáticamente si no es único.
- **Aclaración por nombre de pila:** se exige adicionalmente `employees.read.all`, la comprobación `module_profile_allows("administration")` y lectura de nombres con el JWT del usuario bajo RLS. Si hay dos Juan, la respuesta HTTP `409 EMPLOYEE_SELECTION_REQUIRED` incluye solo identificadores y nombres de esas coincidencias autorizadas del propio museo. Ejemplo ficticio: `¿Te refieres a Juan Torres o Juan Vélez?`. El botón elegido reenvía una nueva consulta con el ID; el servidor revalida permisos, nombre e institución antes de leer cualquier evidencia específica.
- No se combinan usuarios de museos diferentes; IDs inventados, empleados de otra institución, más de 10 coincidencias, nombres completos repetidos o listados truncados producen rechazo o petición de más datos. Ninguna coincidencia se interpreta como permiso de escritura.
- La interfaz permite preguntar directamente desde «Resolver una incidencia» y solo pasa a Asistencia cuando la pregunta tiene referencia personal. Las respuestas y opciones se muestran mediante `textContent` (sin HTML procedente del servidor). La navegación guiada sigue siendo local y no ejecuta cambios.
- **Validación SQL controlada:** dos Juan en el museo ficticio A y otro Juan en un museo ficticio B; con permiso limitado de Asistencia, la lista de empleados quedó invisible; tras conceder temporalmente `employees.read.all`, el usuario autenticado de A vio exactamente sus dos Juan y cero empleados de B. Se verificaron turno anterior abierto y evidencias sintéticas. **Transacción revertida y comprobado 0 permisos, roles, empleados, turnos, alertas, ponches y museos ficticios adicionales.**
- **Código instalado únicamente en staging v35, JWT obligatorio.** CI de la IA pasó. El guion opcional `supabase/tests/instituva-ai-name-disambiguation-staging.mjs` prepara sesiones reales y registros ficticios desechables para ejecutar el ensayo HTTP positivo; tiene protección por proyecto y limpieza, pero **no se ha ejecutado todavía**. Requiere claves legadas de staging configuradas únicamente en el entorno local del ejecutor, no en el repositorio ni en el chat. No modifica eventos ni intentos de asistencia inmutables.
- **Pendiente:** ejecutar E2E positivo con JWT auténtico y demostrar limpieza, evaluar respuesta del proveedor y bloqueo de selección falsificada. Producción permanece sin modificación ni habilitación.


## 14. 26/nov/2026 — chatbox conversacional temporal en PR #125

- Transformación **solo de interfaz**: el formulario de diagnóstico se presenta como un hilo de mensajes con bienvenida del asistente, burbujas de preguntas y respuestas, campo de composición al pie, envío con Enter (Shift+Enter inserta una nueva línea), control de «Nueva conversación» y estado accesible de la consulta.
- La selección de empleados con nombres coincidentes aparece dentro del hilo; elegir un empleado agrega una respuesta del usuario y reenvía únicamente la pregunta original más el ID autorizado, sin duplicar la pregunta en pantalla. Se conserva la revalidación de identidad, permisos y museo **en el servidor**.
- Diagnóstico, evidencia autorizada, fuentes y guía manual permanecen visibles en el mensaje más reciente. Al comenzar otra consulta se conserva un resumen **literal y de solo lectura** del diagnóstico anterior con sus fuentes. La guía interactiva corresponde únicamente al diagnóstico vigente. Cambiar de tipo de consulta elimina el historial visual, para evitar el arrastre de respuestas privadas entre áreas.
- El historial es **efímero, solo en la memoria DOM de la pestaña**: no se guarda en Supabase, Storage, localStorage ni sessionStorage; no se remite al modelo ni a la función Edge. Cada pregunta se analiza como solicitud independiente. No se ofrece aún memoria conversacional del modelo. Se aclara al usuario para evitar confundir el historial visual con contexto del razonamiento.
- Toda entrada del usuario, el diagnóstico del servicio, los nombres de empleados y las referencias se muestran mediante textContent. No se usa innerHTML para contenido externo ni se añade ninguna operación de escritura, aprobación o corrección al asistente. Se mantienen los límites y contrato read_only_v1 y las autorizaciones ya probadas.
- Los cambios se limitan a asistente-ia.html, js/instituva-ai.js y tests/instituva-ai-readonly.test.cjs en la rama de PR #125. No hay migraciones, cambios de RLS, actualización de producción ni modificación de módulos ajenos. La suite cubre diálogo efímero, no transmisión de historial, confirmación sin repetición, reseteo entre dominios, Enter/Shift+Enter y renderización de texto seguro. **Validación visual manual de la nueva interfaz pendiente.**


## 15. 26/nov/2026 — panel lateral por módulo (solo staging)

- **Estado:** implementación piloto en la misma rama del PR #125. El cargador se ejecuta únicamente después del control existente de sesión, perfiles y permisos de página (enforceAuthenticatedPageAccess()), en staging, fuera de las páginas de acceso y de asistente. Las páginas de producción no montan el panel aunque el código esté presente; habilitarlo requiere aprobación separada.
- **Componente compartido:** js/instituva-ai-dock.js y css/instituva-ai-dock.css se cargan dinámicamente desde js/app.js; no se modifican formularios ni lógica operacional. Un botón flotante abre un iframe de origen idéntico (asistente-ia.html?dock=1) acoplado a la derecha. Puede cerrarse, reabrirse (conservando la conversación mientras no se abandone la página), ampliarse o abrirse en una ventana independiente.
- **Trabajo simultáneo:** en escritorio amplio, el panel ocupa parte del ancho y la página sigue visible y operativa. En pantallas pequeñas actúa como panel superpuesto que puede cerrarse. No requiere dos monitores.
- **Continuidad real:** el portal usa documentos HTML independientes. El panel acoplado se recrea al navegar a otro módulo, por lo que **no persiste el historial entre páginas**. «Ventana aparte» utiliza una ventana identificada y mantiene el historial solo en la memoria de esa ventana mientras esté abierta, aunque se navegue en el módulo original. Se comunica la restricción y se evita guardar mensajes privados en sessionStorage/localStorage o en el servidor.
- **Contexto limitado:** solamente la etiqueta de la sección actual (lista cerrada de módulos) se pasa en la URL y muestra una nota informativa; nunca contiene IDs, nombres de empleados, registros, permisos, JWT ni texto de conversaciones. No se agrega automáticamente ese contexto a las peticiones a la función Edge. Se conserva la autorización por museo, usuario y permiso en cada consulta.
- **Inactividad y seguridad:** se suprime el temporizador duplicado del iframe incrustado. El iframe envía al contenedor solo señales de interacción humana (teclado/clic), sin datos. El padre verifica origen, ventana remitente y tipo antes de actualizar su temporizador normal. Ni el panel ni la ventana ejecutan modificaciones operacionales.
- **Pruebas:** tests/instituva-ai-dock.test.cjs cubre montaje, URL sin secretos, minimización, modo amplio, ventana separada, ausencia de escrituras y carga posterior al guard. Las pruebas del chat comprueban que el contexto no se envía como argumento privado. La comprobación visual del panel sobre Finanzas/Horarios aún está pendiente.
