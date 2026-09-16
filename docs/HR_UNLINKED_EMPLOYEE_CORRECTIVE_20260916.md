# Expediente previo a invitación — correctivo preparado

Base: `2a33ef411035374644a93ee529fa782e310f9ecf`, posterior a PR30 y PR31.
`main` remoto seguía en esa revisión durante la investigación. No se publicó
frontend ni backend en Producción y no se modificó el expediente de Roberto.

## Causa y evidencia de Producción

Consulta REST administrativa y transacción SQL `BEGIN READ ONLY`:

```json
{
  "id": "946adc70-a10b-49a7-8749-182150f83498",
  "first_name": "Roberto",
  "last_name": "Figueroa",
  "profile_id": null,
  "email": null,
  "access_level": null
}
```

La búsqueda de empleados por Roberto devolvió ese único registro. Las auditorías
por `record_id` y por `new_value.employee_id` muestran solamente `INSERT`, del
3 de septiembre de 2026 a las 17:20:03.553967 UTC: no hay evento de invitación
asociado al expediente. Sin correo no es posible afirmar que no exista una
cuenta independiente de Roberto en Auth. No se buscó vincular por nombre.

La función `employeeLevelState` aplicaba `accessLevel(null)`, que lanza
`INVALID_ACCESS_LEVEL`; `errorResponse` lo convertía en HTTP 500 genérico.
RH deshabilitaba Guardar mientras verificaba el nivel y no salía del bloqueo
al fallar. Además, `employeeFromSupabase` presentaba ese NULL como «Empleado».

La consulta `employee-access/status` reutilizaba un resolutor que exige correo
válido incluso para consultar el estado. El correo NULL provocaba HTTP 400;
Ver perfil ocultaba las acciones al no recibir un estado. Son dos fallos
distintos, no una falta de permiso que deba eludirse.

## Reproducción HTTP real en Staging

Proyecto `lonpdmxdvbxuagqxztig`, actor ficticio con sesión Auth real, usando las
mismas funciones JavaScript `fetchSupabaseEmployeeLevel` y
`fetchSupabaseEmployeeAccess` del frontend. Nunca se utilizó la clave de servicio
como sesión del actor para las Edge Functions o el RPC de cambio de nivel.

Staging tenía `email` y `access_level` NOT NULL; Producción ya permite NULL.
La primera prueba detectó `23502` al insertar el fixture. Se aplicó únicamente
la migración `202609160001_employee_draft_fields.sql`, que permite un expediente
previo a su identidad y no cambia RLS, Auth ni permisos. Después se reprodujo
el fallo contra las funciones aún sin corregir:

Ejecución `unlinked-1789559723080`:

| Función / acción | HTTP | Respuesta real |
| --- | --- | --- |
| assign-sensitive-role / read | 500 | `{"error":"No se pudo completar la operación."}` |
| employee-access / status | 400 | `{"error":"El expediente no tiene un correo válido."}` |

La captura HTTP anterior es de Staging, no de una sesión de Roberto o de
Guillermo en Producción. El navegador de mmdpr.org volvió a login al navegar
a RH; queda pendiente capturar allí la respuesta autenticada y la UI original.

## Comportamiento corregido

- Un expediente no vinculado admite `role: null`; el API entrega además
  `requested_role` y `effective_role`. Sin perfil vinculado, el efectivo es NULL.
- RH y Ver perfil permiten guardar datos y fotos con el nivel solicitado sin
  definir. Un error de autenticación, autorización o lectura sigue bloqueando
  el cambio: no se sustituye un error por un nivel supuesto.
- El selector muestra «Sin nivel solicitado» y explica cuándo el nivel solo
  pertenece a una futura invitación. El alta nueva conserva su valor inicial
  existente «Empleado»; no se asigna ese valor a los NULL históricos.
- Elegir un nivel para un expediente vacío usa el RPC transaccional existente,
  con `roles.assign`, museo, bloqueo de filas, auditoría y comparación del valor
  anterior. `expected_role = null` solo se acepta si el expediente sigue sin
  perfil y sin nivel. No se crean perfiles ni cuentas al guardar el expediente.
- Cuenta institucional muestra «Expediente pendiente de completar», el botón
  de invitación deshabilitado y los campos que faltan. Tras guardar correo y
  nivel válidos, vuelve a consultar el servidor y habilita **Enviar invitación**
  mediante el `invite-employee` existente.
- El estado consulta Auth por correo, perfiles, duplicados, vínculos y eventos
  de envío. Una cuenta invitada sin vínculo muestra reparación; una identidad
  ambigua exige revisión; un intento de envío incierto no se trata como nuevo.
- No cambió `invite-employee`, ni su envío único, reparación, reenvío explícito,
  validación de rol, identidad o redirect. Tampoco cambió `_shared/security.ts`,
  la protección de fotos, los buckets ni las políticas de acceso.

Para Roberto corresponde **completar primero el correo institucional y elegir
explícitamente el nivel solicitado**, conservando su expediente. Después el
servidor debe decidir si corresponde invitar, reparar o revisar una cuenta ya
existente. Este correctivo no decide que Roberto deba ser Administrador.

## Pruebas del correctivo

45 pruebas locales focalizadas, sumando:

```powershell
node --test supabase/tests/employee-access-wiring.test.mjs
node --test supabase/tests/employee-photo-level.test.mjs supabase/tests/unlinked-employee.test.mjs
```

Se verificaron los callbacks reales de Guardar en RH y Ver perfil con correo
y nivel vacíos, sin asignación de rol, y la selección de acciones del panel.
Las regresiones de guardado/fotos se repitieron porque se modificaron los
callbacks; no se repitieron las cargas de imágenes ni el ciclo visual de fotos
ya acreditados el 8 de septiembre. El SQL previo de rollback y los casos de
cuentas vinculadas no se presentan como nuevas pruebas de esta ejecución.

Integración final real: `unlinked-1789560468829`, 16 de septiembre de 2026,
12:07:50–12:07:57 UTC, PASS:

| Paso | Resultado comprobado |
| --- | --- |
| Abrir expediente con correo/perfil/nivel NULL | Lectura 200: `role:null`, `requested_role:null`, `effective_role:null` |
| Consultar Cuenta institucional | 200: `incomplete_record`, `can_invite:false`, faltan email y access_level |
| Guardar expediente desde el servicio de RH | Datos persistidos, mismo ID, `profile_id:null`, `access_level:null` |
| Elegir explícitamente Empleado para el fixture | RPC 200, `assigned:true`; todavía sin cuenta |
| Repetir cambio con nivel anterior NULL obsoleto | 409, `code:PT409`; no sobrescribe el nivel |
| Guardar correo desde servicio de Ver perfil | Mismo expediente; consulta 200, `no_account`, `can_invite:true` |
| Consultar nivel otra vez | Solicitado empleado, efectivo NULL |
| invite-employee con action repair, sin Auth existente | 409 `invite_status_unknown`, stage verification; cero correos |
| Lectura sin sesión | 401 |
| Cambio tras retirar roles.assign del actor ficticio | 403; nivel conservado |

La primera versión de la comprobación de concurrencia usó SQLSTATE 40001 y
agotó el timeout en Staging. No se consideró ese timeout un rechazo válido.
El nuevo conflicto de expediente NULL se expresa como `PT409`, para devolver
un conflicto HTTP explícito sin clasificarlo como fallo transitorio de
serialización. La comparación, el bloqueo y el rollback siguen intactos.
La semántica PTxyz está documentada por
[PostgREST](https://docs.postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes).
No se alteró el código 40001 de los conflictos preexistentes con nivel no NULL.

Un ensayo intermedio quedó interrumpido por DNS; su único empleado y actor
ficticios se identificaron y eliminaron por ID y marcador exactos. Auditoría
final: **0 empleados sintéticos, 0 cuentas sintéticas y 0 eventos de invitación**.
Solo permanecen museos ficticios como contenedores de auditoría, siguiendo el
criterio previo; no contienen cuentas de acceso. No se enviaron correos de prueba.

## Estado de Staging

- `assign-sensitive-role`: versión 9, `verify_jwt:false`, igual que antes en
  este ajuste; conserva `auth.getUser()` y `has_permission` internos.
- `employee-access`: versión 2, `verify_jwt:true`, igual que antes.
- Migraciones `202609160001` y `202609160002` aplicadas y registradas.
- No se desplegó frontend en demo.instituva.com. Los callbacks de UI se
  verificaron localmente; la integración ejecutó los servicios del frontend
  contra el backend real de Staging.

## Pasos pendientes para Producción

1. Con sesión administrativa disponible en mmdpr.org, capturar el fallo
   autenticado del expediente de Roberto y completar la comprobación visual
   del correctivo con frontend local y Staging. No enviar correos para probar.
2. Revisar/aprobar y publicar el commit del correctivo. Aplicar/registrar las
   dos migraciones explícitas en `kfokfjngozgcwjpzxcsu`; evitar un db push que
   arrastre migraciones ajenas. La primera migración es idempotente y no cambia
   la nulabilidad ya existente en Producción.
3. Desplegar `assign-sensitive-role` y `employee-access` conservando las
   opciones JWT reales de cada función; publicar los dos HTML y scripts con
   versión `hr-draft-access-20260916` y verificar los archivos servidos.
4. Abrir el mismo ID de Roberto. Guardar el expediente y comprobar que no se
   creó otra fila ni cuenta. Guillermo debe aportar el correo correcto y el
   nivel autorizado; no se infieren de nombre o cargo.
5. Consultar Cuenta institucional después de guardar. Si el estado es
   `no_account` y `can_invite:true`, Guillermo puede usar Enviar invitación.
   Si es reparación/revisión, seguir ese estado sin reenviar automáticamente.
   El envío real requiere su instrucción explícita; no se realizó en esta tarea.

No hay despliegue ni mutaciones de negocio en Producción que revertir.
