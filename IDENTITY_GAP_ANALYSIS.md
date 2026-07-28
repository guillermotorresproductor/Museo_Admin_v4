# Analisis de brechas de identidad

Fecha del analisis: 2026-07-20  
Rama analizada: `docs/identity-architecture-phase-1`  
Commit base: `696db23` (`docs(architecture): add identity architecture`)

## 1. Objetivo y alcance

Este documento compara la implementacion actual del repositorio con:

- `docs/architecture/09_IDENTITY_ARCHITECTURE.md`;
- `docs/architecture/identity-access-model.md`;
- `docs/architecture/roles-permissions-matrix.md`;
- `docs/architecture/phase-1-implementation-plan.md`.

La revision cubre los 23 archivos HTML, `js/app.js`, `css/main.css`, los scripts SQL de `docs/`, el workflow de GitHub Pages y la documentacion tecnica del repositorio.

El analisis distingue entre:

- **implementado en el repositorio**: existe codigo o SQL verificable;
- **parcial**: existe una aproximacion, pero no satisface el modelo objetivo;
- **no implementado en el repositorio**: no hay migracion, funcion o codigo que lo materialice;
- **no verificable**: podria existir en el proyecto Supabase remoto, pero el repositorio no contiene un dump completo del esquema.

No se consulto ni modifico el proyecto Supabase remoto. Por ello, las tablas y politicas enumeradas como faltantes significan **faltantes en el repositorio y necesarias para reconstruir la arquitectura objetivo**, no una afirmacion definitiva sobre el estado remoto.

## 2. Resumen ejecutivo

La implementacion ya usa Supabase Auth como mecanismo real de inicio de sesion y consulta `profiles` para obtener `museum_id`, nombre y rol. Tambien usa JWT en llamadas REST, mantiene sesiones con renovacion y aplica aislamiento por museo en `app_records` y en las politicas financieras incluidas.

Sin embargo, la arquitectura `AUTH -> PROFILE -> EMPLOYEE` y el modelo RBAC aun no estan materializados. El frontend toma decisiones sensibles desde `localStorage` y desde `profiles.role`; Finanzas incluye una segunda lista de usuarios y contrasenas embebida; `employees` mezcla expediente, datos medicos y nivel de acceso; las fotos se convierten a base64 y se guardan en `photo_url`; no existe vinculo verificable `employees.auth_user_id`; y la interfaz permite borrar fisicamente empleados.

La brecha mas importante no es visual: falta trasladar la autoridad de acceso a tablas RBAC, RLS granular y Edge Functions. El orden seguro es inventariar Supabase, establecer migraciones, crear RBAC y el vinculo Auth/Profile/Employee, implementar RLS y funciones privilegiadas, y solo despues retirar las compatibilidades inseguras del navegador.

## 3. Estado de cumplimiento

| Capacidad objetivo | Estado | Evidencia actual | Brecha |
|---|---|---|---|
| Supabase Auth como autenticacion oficial | Implementado | `signInWithSupabase()`, renovacion de token y logout en `js/app.js` | Falta recuperacion, invitacion, suspension y administracion segura |
| `profiles.id = auth.users.id` | Parcial/no verificable | El frontend consulta `profiles?id=eq.<session.user.id>` | No hay migracion ni constraint versionado que garantice 1:1 |
| Aislamiento multi-museo | Parcial | `museum_id` se obtiene de `profiles`; SQL de `app_records` y Finanzas filtra por museo | No existe cobertura versionada para todas las tablas y Storage |
| Separacion Profile/Employee | Parcial | `profiles` se usa para sesion; `employees` para directorio | `employees.access_level`, usuario y condicion medica siguen mezclando acceso/expediente |
| Empleado sin cuenta de acceso | Parcial | Crear empleado no crea Auth; la UI lo explica | No hay `auth_user_id` nullable ni flujo posterior de vinculacion |
| Usuario sin expediente | Parcial/no verificable | Login funciona con `profiles` aunque no encuentre empleado | No hay reglas y pruebas formales para este caso |
| RBAC explicito | No implementado | Solo `profiles.role`, `employees.access_level` y comprobaciones locales | Faltan tablas, contexto de permisos, RLS y administracion de asignaciones |
| Finanzas como permiso independiente | No implementado | Finanzas acepta `administrador` o `ejecutivo` | Contradice `finance.read/write/export` separado y concede acceso por rol general |
| Acceso propio/equipo/todo | No implementado | `fetchSupabaseEmployees()` solicita todos los empleados | No hay self/team/all ni supervision en frontend/RLS versionada |
| Operaciones sensibles en backend | No implementado | CRUD y auditoria se realizan directamente desde el navegador | Faltan Edge Functions y validacion privilegiada |
| Storage privado de fotos/documentos | No implementado | `FileReader.readAsDataURL()` y `photo_url` reciben base64 | Faltan bucket privado, rutas, policies y URLs firmadas |
| Auditoria de acciones sensibles | Parcial | Finanzas inserta en `audit_logs` desde el cliente | No cubre identidad/RRHH/RBAC y el cliente puede omitir o falsificar eventos |
| Ciclo de vida sin borrado fisico | No implementado | RRHH ejecuta `DELETE /employees?id=...` | Debe sustituirse por desactivacion/soft delete y preservacion historica |
| Identidades no humanas | No implementado | No hay catalogo ni entidad conceptual para IA, procesos, integraciones o cuentas de servicio | Requiere diseño posterior; no esta definido como tabla en Fase 1 |
| Migraciones versionadas | No implementado | Solo hay dos scripts SQL manuales en `docs/` | Falta `supabase/migrations/` y esquema reproducible |
| Pruebas de autorizacion | No implementado | No hay suite de pruebas | Faltan pruebas por rol, museo, recurso y operacion |

## 4. Lo que ya esta implementado

### 4.1 Autenticacion y sesion

- Inicio de sesion por correo y contrasena contra Supabase Auth.
- Almacenamiento de la sesion devuelta por Supabase.
- Renovacion del `access_token` mediante `refresh_token` antes de expirar.
- Envio del JWT como `Authorization: Bearer` en llamadas REST.
- Cierre de sesion local y cierre automatico tras ocho minutos de inactividad.
- Rechazo del login historico por nombre de usuario: `login.html` exige correo para Supabase.
- Consulta del perfil usando el UUID de `session.user.id`.

### 4.2 Perfil y contexto multi-museo

- `fetchSupabaseProfile()` trata `profiles.id` como el mismo UUID de Auth.
- `currentMuseumContext()` exige que el perfil tenga `museum_id`.
- Las escrituras de `app_records`, empleados y finanzas incluyen el museo del perfil actual.
- El nombre visible proviene primero de `profiles.full_name`.

### 4.3 Expediente laboral

- Existe CRUD REST de `employees` para lectura, alta y actualizacion.
- El alta de empleado no crea automaticamente un usuario Auth.
- La UI diferencia verbalmente el expediente laboral de la cuenta de acceso.
- Empleados locales/demo funcionan como respaldo de visualizacion cuando no hay sincronizacion.
- Existe estado activo/inactivo y la opcion de activar/desactivar el expediente.
- Notificaciones excluye empleados inactivos y registros locales al configurar preferencias.

### 4.4 Seguridad de datos ya documentada en SQL

- `docs/supabase-system-records.sql` crea `app_records`, activa RLS y limita CRUD a usuarios autenticados cuyo perfil pertenece al mismo museo.
- `docs/supabase-finance-security.sql` activa RLS condicional para `finance_records` y `audit_logs`.
- Las politicas financieras incluidas verifican `auth.uid()`, `museum_id` y un rol de perfil.
- Las llamadas usan una clave publicable; no existe una clave `service_role` en el frontend.

### 4.5 Auditoria parcial

- Cada cambio de celda financiera intenta insertar actor, museo, accion, tabla, registro, valor anterior y valor nuevo en `audit_logs`.
- La arquitectura de auditoria e identidad esta documentada y reconoce que el actor debe mantenerse separado del expediente.

## 5. Brechas de implementacion

### 5.1 Credenciales y decisiones sensibles en el navegador — riesgo critico

`bindFinanceModule()` contiene `allowedUsers` con tres nombres y la misma contrasena literal. `finanzas.html` presenta ese segundo login aunque el modulo tambien requiere una sesion Supabase. Estas credenciales son visibles para cualquiera que descargue `js/app.js` y no representan autenticacion ni autorizacion valida.

Ademas, `museo-admin-access-level` se guarda en `localStorage`. Funciones como `canManageEmployees()` y `canDeleteEmployees()` confian en ese valor para habilitar alta, edicion, desactivacion y borrado. El usuario puede modificarlo desde las herramientas del navegador.

**Objetivo:** eliminar `allowedUsers`, el segundo login financiero y toda decision autoritativa basada en `localStorage`. El frontend solo debe usar permisos obtenidos de Supabase para experiencia visual; RLS/Edge Functions deben decidir realmente.

### 5.2 Roles actuales incompatibles con la matriz — riesgo critico

- El login reduce cualquier rol distinto de `administrador` o `ejecutivo` a `Empleado`.
- No existen Supervisor, Recursos Humanos ni Finanzas como asignaciones efectivas.
- `canManageEmployees()` permite RRHH a Administrador/Ejecutivo, no al rol Recursos Humanos.
- `canDeleteEmployees()` concede borrado a Administrador.
- Finanzas permite `administrador` y `ejecutivo`, tanto en JavaScript como en el SQL incluido.
- La matriz obliga a que Administrador y Ejecutivo no obtengan Finanzas automaticamente.

**Objetivo:** evaluar permisos atomicos como `employees.read.all`, `employees.update.basic`, `finance.read`, `finance.write` y `finance.export`.

### 5.3 Separacion incompleta entre perfil y expediente — riesgo alto

El adaptador de `employees` lee/escribe `access_level`, y las pantallas de RRHH y Perfil permiten editar "Nivel de acceso" dentro del expediente. `perfil-empleado.html` tambien muestra "Nombre de usuario". Esto mantiene autorizacion y acceso dentro del expediente laboral.

No existe codigo que lea o escriba `employees.auth_user_id`, ni un flujo para:

- invitar a un empleado;
- vincular una cuenta existente;
- validar que cuenta y empleado sean del mismo museo;
- desvincular acceso conservando expediente;
- suspender Auth sin terminar el empleo.

**Objetivo:** `profiles` y RBAC controlan acceso; `employees` conserva exclusivamente datos laborales y un enlace opcional `auth_user_id`.

### 5.4 Datos medicos dentro de `employees` — riesgo critico

`medical_condition` se obtiene y actualiza con el resto del expediente. Ambas pantallas de RRHH lo muestran a todo usuario que supere el control general Administrador/Ejecutivo. No existe permiso `employees.medical.read/write`, tabla separada ni auditoria especifica.

**Objetivo:** retirar ese campo de las consultas generales y mover cualquier dato medico necesario a una tabla separada con permisos explicitamente asignados, RLS muy restrictiva y auditoria.

### 5.5 Fotos base64 y almacenamiento no privado — riesgo alto

RRHH y Perfil convierten archivos con `FileReader.readAsDataURL()` y envian el resultado a `employees.photo_url`. Esto contradice la decision de usar Storage privado, `photo_path` y URLs firmadas. Tambien aumenta el tamaño de las filas y puede exponer datos personales.

**Objetivo:** bucket privado, columna `photo_path`, carga autorizada y URL firmada de corta duracion mediante Edge Function o politica controlada.

### 5.6 Borrado fisico e historial — riesgo critico

La UI permite a quien se presente localmente como Administrador ejecutar `DELETE` sobre `employees`. Esto contradice el principio de que la identidad y su historial no se eliminan fisicamente. Puede romper referencias de auditoria, documentos, horarios o procesos.

**Objetivo:** eliminar la operacion DELETE del flujo normal; usar `employment_status`, `active`, `terminated_at` u otro estado aprobado, conservar relaciones y auditar la transicion.

### 5.7 Lectura y edicion demasiado amplias — riesgo critico

`fetchSupabaseEmployees()` solicita `select=*` sin limitar empleado propio, equipo, campos sensibles o permiso. Las pantallas de RRHH permiten editar el objeto completo mediante una sola capacidad local. No existe separacion entre:

- `employees.read.self`;
- `employees.read.team`;
- `employees.read.all`;
- actualizacion basica, laboral, medica o compensatoria.

**Objetivo:** vistas/consultas de campos minimos y RLS por permiso, relacion con empleado y supervision.

### 5.8 `app_records` concede CRUD general por museo — riesgo alto

Las politicas actuales permiten a cualquier usuario autenticado del museo leer, insertar, actualizar y borrar cualquier modulo/clave en `app_records`. No comprueban permisos como `notifications.manage` ni distinguen datos propios. Como almacenamiento temporal es funcional, pero no cumple autorizacion granular.

**Objetivo:** agregar policies por modulo/permiso, restringir delete y migrar gradualmente datos sensibles a tablas estructuradas.

### 5.9 Auditoria generada por el cliente — riesgo alto

El navegador inserta directamente `audit_logs` y descarta errores de auditoria con `.catch(() => null)`. Un cliente modificado puede no registrar el evento, cambiar `old_value`, `new_value` o `user_id`, o ejecutar la operacion sin completar el log.

**Objetivo:** triggers o funciones transaccionales/Edge Functions que deriven el actor de `auth.uid()` y no acepten atribucion arbitraria del cliente.

### 5.10 Identidad conceptual limitada a personas autenticadas — riesgo medio/alto

El codigo actual solo reconoce usuarios Auth y empleados. No hay catalogo de tipos de identidad ni representacion para agente de IA, proceso automatico, integracion externa o cuenta de servicio. Tampoco distingue identidad ejecutora, proponente y aprobadora.

`09_IDENTITY_ARCHITECTURE.md` no prescribe tablas y `phase-1-implementation-plan.md` no incluye este modelo entre sus entidades inmediatas. Por eso debe abrirse una decision arquitectonica antes de crear tablas como `identities` o `identity_types`; hacerlo directamente en Fase 1 ampliaria el alcance sin diseño aprobado.

### 5.11 Ausencia de recuperacion, invitacion y gobierno de acceso — riesgo alto

No existen flujos implementados para invitacion, restablecimiento, cambio seguro de correo, suspension de acceso, asignacion de rol sensible o reactivacion. El boton de reset esta oculto y solo muestra un aviso. Tampoco hay interfaz/servicio de gobernanza que detecte duplicados o preserve un historial de vinculaciones.

### 5.12 Esquema y pruebas no reproducibles — riesgo alto

El repositorio no contiene `supabase/migrations/`, dump de esquema, seeds, pruebas de RLS, pruebas de Edge Functions ni fixtures por rol/museo. Solo se pueden verificar `app_records` y politicas parciales de Finanzas. No se conocen constraints, triggers, funciones, buckets ni policies reales del entorno remoto.

## 6. Archivos que habria que modificar o crear

Esta es la superficie prevista para implementar las brechas; no implica que todos deban cambiar en una sola entrega.

| Archivo/ruta | Cambio requerido | Riesgo |
|---|---|---|
| `js/app.js` | Centralizar contexto Auth/permisos; retirar `allowedUsers`, contrasenas demo, `currentAccessLevel` autoritativo y `employees.access_level`; agregar flujos para funciones seguras, campos minimos, Storage privado y manejo de 403 | Critico por alcance monolitico y regresiones transversales |
| `login.html` | Mantener login Auth; agregar recuperacion/invitacion solo cuando exista backend seguro | Medio |
| `finanzas.html` | Eliminar segundo login con usuario/contrasena; mostrar acceso segun `finance.*`; proteger exportaciones | Alto |
| `recursos-humanos.html` | Separar expediente de acceso; retirar usuario, contrasena, nivel de acceso y dato medico general; agregar acciones de invitar/vincular/desactivar seguras | Alto |
| `perfil-empleado.html` | Aplicar vistas self/team/RH; retirar edicion directa de acceso y datos medicos; consumir foto privada | Alto |
| `notificaciones.html` | Exigir `notifications.manage` y separar preferencias propias/administrativas si se formaliza el dominio | Medio |
| `css/main.css` | Solo ajustes de estados, mensajes y nuevos controles; sin cambio de arquitectura | Bajo |
| `docs/supabase-system-records.sql` | Mantener como referencia historica o convertir a migracion; endurecer permisos por modulo y eliminar delete amplio | Alto |
| `docs/supabase-finance-security.sql` | Sustituir comprobaciones de `profiles.role` por permisos RBAC y proteger export/auditoria | Critico |
| `supabase/migrations/*.sql` (nuevo) | Esquema versionado, constraints, indices, seeds de permisos, RLS, triggers y Storage policies | Critico |
| `supabase/functions/invite-employee/` (nuevo) | Invitacion Auth y vinculacion segura | Alto |
| `supabase/functions/deactivate-user-access/` (nuevo) | Suspension de acceso sin borrar expediente | Alto |
| `supabase/functions/reset-employee-password/` (nuevo) | Recuperacion/restablecimiento seguro | Alto |
| `supabase/functions/assign-sensitive-role/` (nuevo) | Asignacion/revocacion de roles y permisos | Critico |
| `supabase/functions/generate-private-file-url/` (nuevo) | URL firmada para foto/documento privado | Alto |
| `supabase/functions/log-sensitive-admin-action/` (nuevo) | Registro confiable si no se resuelve mediante trigger/transaccion | Alto |
| `supabase/functions/export-finance/` (nuevo recomendado) | Exportacion financiera autorizada del lado servidor | Alto |
| pruebas de DB/Functions/frontend (nuevas) | Matriz por rol, permiso, museo, relacion self/team y accion | Alto si se omiten; bajo riesgo de implementacion |

`app.js` no debe modularizarse completamente durante Fase 1, de acuerdo con el plan y ADR-008. Si se crean archivos auxiliares, deben limitarse a cambios aprobados y no convertirse en una refactorizacion funcional paralela.

## 7. Tablas y cambios de Supabase faltantes

### 7.1 Tablas RBAC requeridas por Fase 1

| Tabla | Proposito | Elementos minimos |
|---|---|---|
| `roles` | Catalogo de roles de seguridad por sistema/museo | `id`, `museum_id` o alcance global, `code`, `name`, `active` |
| `permissions` | Catalogo estable de permisos atomicos | `id`, `code` unico, `description`, `sensitivity` |
| `user_roles` | Asignacion de roles a perfiles | `museum_id`, `user_id`, `role_id`, vigencia, actor que asigna |
| `role_permissions` | Permisos incluidos por rol | `role_id`, `permission_id` |
| `user_permissions` | Excepciones directas allow/deny | `museum_id`, `user_id`, `permission_id`, efecto, vigencia |
| `employee_supervisors` | Equipos para alcance de supervisor | `museum_id`, `supervisor_employee_id`, `employee_id`, vigencia |

### 7.2 Tablas operacionales requeridas por la matriz, si entran en alcance

| Tabla | Estado/uso objetivo |
|---|---|
| `employee_documents` | Metadatos de documentos en Storage privado; tipos y visibilidad |
| `employee_schedules` | Horarios separados del campo de texto actual |
| `time_events` | Ponches propios y correcciones auditadas; fuera del alcance funcional completo de Fase 1 |
| `timesheets` y `timesheet_entries` | Lectura/aprobacion por empleado/equipo; fuera del alcance funcional completo de Fase 1 |
| `employee_medical_records` | Solo si el negocio conserva datos medicos; separacion estricta y permiso independiente |
| `notifications` / `notification_preferences` | Necesarias cuando Notificaciones deje de ser JSON temporal y exista motor/historial |

### 7.3 Cambios a tablas existentes

- `profiles`: garantizar PK/FK 1:1 con `auth.users.id`; `museum_id` obligatorio; `status`; metadatos no laborales; retirar dependencia futura de `role` simple.
- `employees`: agregar `auth_user_id uuid null` con FK a Auth y unique parcial; garantizar `museum_id`; separar `work_email`/`personal_email`; usar `photo_path`; agregar estado de empleo y marcas de desactivacion; retirar `access_level`, credenciales, base64 y datos medicos generales.
- `audit_logs`: impedir que clientes atribuyan libremente `user_id`; incorporar identidad ejecutora/proponente/aprobadora cuando el modelo conceptual sea aprobado; hacer append-only.
- `finance_records`: conservar `museum_id` y reemplazar autorizacion por rol con permisos `finance.read/write`.
- `app_records`: limitar por modulo/permiso y planificar retiro de datos sensibles.

### 7.4 Modelo conceptual de identidades: decision pendiente

Para cubrir completamente `09_IDENTITY_ARCHITECTURE.md` probablemente se necesitara un modelo como catalogo de tipos, identidades y relaciones. No debe declararse como tabla obligatoria de Fase 1 sin un ADR/esquema aprobado, porque el documento conceptual excluye expresamente tablas e implementacion tecnica.

Posibles entidades a evaluar en una fase posterior:

- `identity_types`;
- `identities`;
- `identity_links` o relaciones con personas, Auth, agentes, procesos e integraciones;
- historial de estado de identidad;
- atribuciones de actor ejecutor, proponente y aprobador.

## 8. Politicas RLS faltantes o insuficientes

### 8.1 `profiles`

- SELECT propio: `id = auth.uid()` y museo valido.
- UPDATE propio solo para campos no sensibles; impedir cambiar `museum_id`, estado, roles o permisos.
- Lectura administrativa limitada por permisos autorizados.
- Insercion/desactivacion solo mediante trigger/Edge Function autorizada.

### 8.2 `employees`

- `employees.read.self`: empleado vinculado por `auth_user_id = auth.uid()` y mismo museo.
- `employees.read.team`: supervisor solo para relaciones vigentes en `employee_supervisors`.
- `employees.read.all`: solo perfiles con permiso, excluyendo por defecto datos medicos/compensatorios.
- `employees.create`, `employees.update.basic` y `employees.update.employment` como permisos distintos.
- Desactivacion controlada; DELETE denegado para clientes normales.
- Validacion de que `auth_user_id` vinculado pertenece al mismo `museum_id`.

### 8.3 RBAC

- Lectura del catalogo de permisos sin permitir alterarlo desde el cliente.
- Lectura de asignaciones propias solo cuando sea necesaria para construir contexto.
- Administracion de `user_roles`, `role_permissions` y `user_permissions` exclusivamente por funcion segura/permiso altamente restringido.
- Aislamiento de asignaciones por `museum_id`.
- Proteccion contra autoasignacion y escalamiento de privilegios.

### 8.4 Documentos y Storage

- Acceso propio segun tipo documental.
- Acceso RH a documentos laborales, excluyendo medicos salvo permiso separado.
- Upload/update/delete solo para actores autorizados y rutas del museo correcto.
- Bucket privado; signed URLs; ninguna lectura publica.
- Policies sobre `storage.objects` que validen museo, empleado y permiso.

### 8.5 Datos medicos

- Sin acceso por defecto para ningun rol.
- SELECT/INSERT/UPDATE solo con permisos medicos explicitos.
- Sin DELETE fisico normal.
- Toda lectura y escritura auditada.

### 8.6 Horarios, ponches y timesheets

- Self para lectura/ponche propio.
- Team solo por relacion de supervision vigente.
- Gestion/correccion/aprobacion por permisos distintos.
- Impedir que el cliente altere actor, tiempo original o aprobador.

### 8.7 Notificaciones y `app_records`

- Preferencias propias limitadas al destinatario.
- Configuracion administrativa con `notifications.manage`.
- En `app_records`, policies por `module`/`record_key`; el mismo museo no debe equivaler a acceso total.
- Restringir o eliminar DELETE general.

### 8.8 Finanzas

- Sustituir `profiles.role in ('administrador','ejecutivo')` por `has_permission(auth.uid(), 'finance.read')` para SELECT.
- `finance.write` para INSERT/UPDATE/DELETE operacional.
- DELETE financiero solo si existe un caso aprobado; preferir reversos/estados auditables.
- `finance.export` separado y ejecutado por funcion segura.
- Administrador, Ejecutivo y RH no reciben Finanzas por defecto.

### 8.9 Auditoria

- INSERT derivado de `auth.uid()` o ejecutado por trigger/funcion; no confiar en `user_id` suministrado.
- SELECT con `audit.read`, aislamiento por museo y separacion de auditoria financiera/sensible.
- UPDATE y DELETE denegados para usuarios normales; bitacora append-only.
- Politicas o vistas que oculten valores sensibles no necesarios.

## 9. Edge Functions faltantes

| Funcion | Responsabilidad | Validaciones obligatorias | Riesgo |
|---|---|---|---|
| `invite-employee` | Invitar/crear Auth, crear perfil y vincular empleado opcional | `users.invite`, mismo museo, correo unico, no duplicar empleado, auditoria | Alto |
| `deactivate-user-access` | Suspender acceso Auth/profile sin borrar empleado | `users.deactivate`, evitar auto-bloqueo indebido, conservar historial | Alto |
| `reset-employee-password` | Iniciar recuperacion o reset administrativo aprobado | permiso, identidad objetivo, no devolver contrasena, auditoria | Alto |
| `assign-sensitive-role` | Asignar/revocar roles y permisos | `roles.assign`, mismo museo, impedir escalamiento, vigencia, auditoria | Critico |
| `generate-private-file-url` | Emitir URL firmada de foto/documento | permisos self/RH/medico, ruta/museo, expiracion corta | Alto |
| `log-sensitive-admin-action` | Registrar acciones no cubiertas por trigger | actor desde JWT, payload validado, append-only | Alto |
| `export-finance` | Generar export protegido | `finance.export`, museo, filtros autorizados, auditoria | Alto |

Funciones adicionales recomendadas para cerrar ciclos de vida:

- `link-employee-account`: vinculo seguro Auth/Profile/Employee con validacion del museo;
- `unlink-employee-account`: retirar acceso sin eliminar expediente;
- `change-user-email`: cambio coordinado en Auth y dato visible;
- `upload-employee-file` o signed upload: carga privada controlada;
- `correct-time-event` y `approve-timesheet` cuando esos dominios se implementen.

Una Edge Function no debe recibir ni exponer `service_role` al navegador. Debe verificar JWT, permiso efectivo, museo, recurso objetivo y registrar auditoria antes de devolver exito.

## 10. Riesgo por cambio

| Cambio | Riesgo | Motivo | Mitigacion principal |
|---|---|---|---|
| Inventariar Supabase real | Bajo | Solo lectura, pero puede descubrir divergencias | Dump controlado y datos sensibles excluidos |
| Introducir migraciones versionadas | Medio | Orden incorrecto sobre esquema existente | Proyecto de prueba, backups y migraciones correctivas |
| Crear RBAC | Alto | Defaults excesivos o usuarios bloqueados | Deny-by-default, matriz aprobada y pruebas por rol |
| Vincular Auth/Profile/Employee | Alto | Duplicados o cruce de museo | Unique parcial, backfill revisado y transaccion segura |
| Reemplazar roles de `localStorage` | Alto | Puede cortar flujos actuales | Hacerlo despues de RBAC/RLS y con compatibilidad temporal |
| Retirar credenciales financieras embebidas | Medio/alto | Usuarios actuales pueden perder el segundo acceso | Activar `finance.*` real antes de retirar gate antiguo |
| Endurecer RLS | Critico | Policies defectuosas bloquean operacion o filtran datos | Matriz automatizada, staging y usuarios no administradores |
| Edge Functions privilegiadas | Critico | Uso incorrecto de service role compromete todo el proyecto | Validacion central, secretos solo servidor y auditoria |
| Migrar fotos a Storage privado | Alto | Enlaces rotos o exposicion temporal | Migracion por lotes, bucket privado y fallback controlado |
| Separar datos medicos | Critico | Informacion sensible y obligaciones de privacidad | Minimizar datos, cifrado/retencion, RLS y auditoria de lectura |
| Sustituir DELETE por soft delete | Medio | Consultas pueden seguir mostrando inactivos | Filtros consistentes, estados definidos y pruebas historicas |
| Auditoria por trigger/funcion | Alto | Doble registro o perdida de trazabilidad durante transicion | Idempotencia y una sola fuente de eventos por operacion |
| Permisos self/team/all | Alto | Relaciones de supervisor incorrectas exponen expedientes | Vigencia, mismo museo y pruebas cruzadas |
| Identidades no humanas | Alto | Modelo prematuro puede duplicar Auth/perfiles | ADR y diseño conceptual antes de migraciones |
| Pruebas por rol/museo | Bajo | Sin riesgo funcional directo | Ejecutarlas en entorno aislado con datos sinteticos |

## 11. Orden recomendado de implementacion

### Etapa 0 — Contencion inmediata

1. Tratar `allowedUsers`, `localStorage` y botones ocultos como no seguros; no ampliar su uso.
2. Confirmar que ninguna clave privilegiada esta expuesta.
3. Evitar nuevas operaciones DELETE o nuevos campos sensibles en `employees`.

No se recomienda retirar todavia los controles existentes si eso deja el sistema sin una ruta funcional; primero debe existir la autoridad de reemplazo.

### Etapa 1 — Inventario real de Supabase

1. Obtener esquema, constraints, funciones, triggers, RLS, usuarios, buckets y Storage policies.
2. Comparar `profiles`, `employees`, `finance_records`, `audit_logs` y `app_records` con el repositorio.
3. Confirmar datos reales de roles, museos, duplicados y fotos base64.
4. Documentar diferencias y aprobar el alcance de migracion.

### Etapa 2 — Base de migraciones y pruebas

1. Crear `supabase/migrations/` con baseline aprobado.
2. Preparar un proyecto Supabase de prueba.
3. Crear seeds sinteticos para seis roles, al menos dos museos y relaciones self/team.
4. Crear harness de pruebas SQL/RLS antes de cambiar produccion.

### Etapa 3 — Modelo RBAC

1. Crear `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions` y `employee_supervisors`.
2. Sembrar codigos de la matriz sin conceder Finanzas/Medico a Administrador.
3. Implementar una funcion SQL estable como `has_permission(user_id, permission_code)` con aislamiento por museo.
4. Mantener `profiles.role` solo como compatibilidad temporal de rollback.

### Etapa 4 — Vinculo Auth/Profile/Employee

1. Garantizar `profiles.id = auth.users.id`.
2. Agregar `employees.auth_user_id` nullable y unique parcial.
3. Realizar backfill manual/revisado por museo.
4. Probar empleado sin login, usuario sin empleado y empleado vinculado.
5. Separar estado de acceso de estado laboral.

### Etapa 5 — RLS fundamental

1. `profiles` self/admin limitada.
2. RBAC y asignaciones.
3. `employees` self/team/all y campos sensibles separados.
4. `app_records` por modulo/permiso.
5. Finanzas por `finance.*`, no por rol.
6. Auditoria append-only.

Aplicar primero en staging y ejecutar pruebas directas con JWT de cada rol y museo.

### Etapa 6 — Edge Functions y Storage privado

1. `invite-employee` y `link-employee-account`.
2. `deactivate-user-access` y reset/cambio de correo.
3. `assign-sensitive-role`.
4. Bucket privado, migracion de fotos y `generate-private-file-url`.
5. Auditoria confiable y exportacion financiera protegida.

### Etapa 7 — Migracion del frontend

1. Crear contexto de sesion/permisos basado en Supabase.
2. Cambiar RRHH a permisos self/team/all y retirar acceso/medico del formulario general.
3. Retirar `allowedUsers` y el segundo login de Finanzas.
4. Retirar `currentAccessLevel` como autoridad y no depender de visibilidad de botones.
5. Sustituir foto base64 por rutas/URLs firmadas.
6. Sustituir delete por desactivacion auditada.
7. Manejar 401/403 de forma consistente y no revelar datos antes de autorizar.

### Etapa 8 — Validacion y retiro de compatibilidad

1. Probar Empleado, Supervisor, RH, Finanzas, Ejecutivo y Administrador.
2. Probar lectura/escritura propia, equipo y total.
3. Probar cruce entre museos y escalamiento de privilegios.
4. Probar documentos/fotos privadas y exportacion financiera.
5. Verificar auditoria de todas las acciones sensibles.
6. Retirar `profiles.role`, `employees.access_level`, contrasenas demo y compatibilidades solo cuando no tengan consumidores.

### Etapa posterior — Identidades institucionales no humanas

Despues de estabilizar Fase 1, aprobar un ADR para catalogo de tipos e identidades de persona, IA, proceso, integracion y cuenta de servicio. Definir entonces continuidad historica, relaciones y atribuciones ejecutora/proponente/aprobadora sin confundirlas con cuentas Auth.

## 12. Criterios de cierre

La brecha de Fase 1 puede considerarse cerrada cuando:

- Supabase Auth es el unico mecanismo de autenticacion y no hay contrasenas embebidas;
- `profiles`, `employees` y Auth estan separados y vinculados de forma opcional/verificable;
- los permisos efectivos provienen de RBAC y no de `localStorage` ni de puesto laboral;
- Administrador no obtiene Finanzas ni datos medicos automaticamente;
- RLS protege cada tabla por usuario, permiso, relacion y museo;
- las operaciones privilegiadas pasan por funciones seguras;
- fotos y documentos laborales estan en Storage privado;
- no se borran fisicamente identidades/expedientes desde la UI;
- la auditoria es append-only y no depende de datos atribuibles enviados por el cliente;
- existen pruebas automatizadas para seis roles, dos museos, self/team/all y acciones sensibles;
- el esquema completo se puede reconstruir desde migraciones versionadas.

La cobertura completa de `09_IDENTITY_ARCHITECTURE.md` requerira posteriormente un modelo aprobado para identidades no humanas y relaciones institucionales; no debe confundirse con el cierre tecnico inicial de Auth/Profile/Employee.
