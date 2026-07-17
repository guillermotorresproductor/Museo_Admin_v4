# Modelo de identidad, acceso y expediente

## 1. Proposito

Este documento define la arquitectura oficial de Fase 1 para separar identidad de acceso, perfil del usuario y expediente laboral en Museo_Admin_v4.

## 2. Alcance

Aplica a Supabase Auth, `profiles`, `employees`, roles, permisos, operaciones sensibles y migracion futura. No implementa tablas, politicas, Edge Functions ni cambios funcionales.

## 3. Principios de diseno

- Supabase Auth sera el unico sistema oficial de autenticacion.
- `auth.users` representa identidad y acceso.
- `profiles` representa el perfil de acceso dentro del sistema.
- `employees` representa el expediente laboral.
- La arquitectura sera multi-museo.
- Las entidades operacionales deben usar `museum_id` cuando corresponda.
- Los permisos no dependeran exclusivamente de un campo simple de rol.
- RBAC con roles y permisos explicitos sera el modelo objetivo.
- Las operaciones sensibles se ejecutaran mediante backend seguro o Supabase Edge Functions.

## 4. Modelo conceptual

```text
auth.users
    |
    v
profiles
    |
    v
employees
```

La relacion `profiles -> employees` puede ser opcional. Un usuario administrativo puede tener acceso al sistema sin expediente laboral si el negocio lo requiere. Un empleado puede existir sin acceso al sistema.

## 5. Responsabilidad de auth.users

`auth.users` debe manejar:

- identidad de acceso;
- correo de autenticacion;
- credenciales;
- estado de acceso;
- invitaciones;
- recuperacion de acceso;
- sesiones.

No debe duplicarse innecesariamente en otras tablas:

- password hash;
- refresh tokens;
- access tokens;
- historial completo de sesiones;
- secretos de autenticacion.

## 6. Responsabilidad de profiles

`profiles` debe representar el perfil de acceso dentro del sistema.

Campos minimos:

| Campo | Proposito |
|---|---|
| `id` | Debe relacionarse 1:1 con `auth.users.id`. |
| `museum_id` | Aislamiento multi-museo. |
| `full_name` | Nombre visible del usuario en la interfaz. |
| `status` | Estado de acceso al portal. |
| permisos/roles relacionados | No necesariamente como campo unico; debe conectarse con RBAC. |
| metadatos de acceso | Preferencias no laborales, configuracion de usuario. |

`profiles` no debe reemplazar el expediente laboral.

## 7. Responsabilidad de employees

`employees` representa el expediente laboral y directorio administrativo.

Campos recomendados:

| Campo | Clasificacion | Nota |
|---|---|---|
| `id` | interno | Identificador del expediente. |
| `museum_id` | restringido | Obligatorio para multi-museo. |
| `auth_user_id` | restringido | Opcional; vincula con `auth.users.id`. |
| `employee_number` | interno | Numero administrativo. |
| `first_name` | publico interno | Nombre. |
| `last_name` | publico interno | Apellidos. |
| `work_email` | privado | Correo laboral. |
| `personal_email` | sensible | Solo si es necesario. |
| `phone` | privado | Telefono. |
| `address` | sensible | Direccion fisica. |
| `photo_path` | privado | Ruta en Storage, no binario. |
| `position` | publico interno | Puesto laboral visible. |
| `department` | publico interno | Departamento. |
| `supervisor_employee_id` | restringido | Supervisor laboral. |
| `hire_date` | privado | Fecha de contratacion. |
| `employment_status` | privado | Activo, inactivo, terminado. |
| `employment_type` | privado | Empleado, contratista, parcial, etc. |
| `compensation_type` | altamente restringido | Horario, salario, contrato. |
| `hourly_rate` | altamente restringido | Dato compensatorio. |
| `exempt_status` | restringido | Clasificacion laboral. |
| `work_schedule` | privado | Horario asignado. |
| `active` | privado | Estado operativo. |

## 8. Datos que no deben vivir en employees

- contrasenas;
- tokens;
- credenciales;
- secretos;
- permisos completos;
- historial de sesiones;
- documentos binarios;
- informacion medica detallada sin separacion;
- archivos de foto como base64;
- autorizaciones financieras.

## 9. Relaciones

| Relacion | Cardinalidad | Nota |
|---|---:|---|
| `auth.users -> profiles` | 1:1 | `profiles.id = auth.users.id`. |
| `profiles -> employees` | 0:1 | Opcional segun tipo de usuario. |
| `employees -> auth.users` | 0:1 | `employees.auth_user_id` nullable. |
| `employees -> schedules` | 0:N | Horarios. |
| `employees -> time_events` | 0:N | Ponches. |
| `employees -> documents` | 0:N | Documentos laborales. |
| `employees -> employees` | 0:N | Relaciones supervisor/equipo. |

## 10. Ciclos de vida

Crear empleado sin acceso:

- se crea `employees`;
- `auth_user_id` queda nulo;
- no se crea usuario Auth.

Invitar empleado al sistema:

- Edge Function crea/invita usuario en Supabase Auth;
- se crea `profiles`;
- se vincula `employees.auth_user_id`.

Vincular usuario existente:

- validar mismo `museum_id`;
- auditar vinculacion;
- no duplicar expediente.

Cambiar correo:

- se ejecuta en Auth mediante backend seguro;
- se sincroniza dato visible si aplica.

Suspender acceso:

- se desactiva acceso Auth/profile;
- el expediente laboral permanece.

Terminar empleo:

- `employment_status` cambia;
- acceso puede retirarse;
- historial se conserva.

Reactivar empleo:

- requiere autorizacion;
- no debe perder historial.

Eliminar acceso sin eliminar expediente:

- se mantiene `employees`;
- se invalida acceso Auth/profile.

Conservar historial:

- ponches, timesheets, auditoria y documentos deben permanecer segun politica de retencion.

## 11. Fuente de verdad por dato

| Dato | Fuente de verdad | Responsable | Puede editarlo | Auditoria |
|---|---|---|---|---|
| Credenciales | Supabase Auth | Sistema/Auth | Usuario o backend seguro | Si |
| Rol/permiso | RBAC | Administracion autorizada | Edge Function | Si |
| Nombre visible | `profiles` | Usuario/RH segun regla | Limitado | Si |
| Expediente laboral | `employees` | Recursos Humanos | RH autorizado | Si |
| Puesto/departamento | `employees` | Recursos Humanos | RH autorizado | Si |
| Datos medicos | tabla separada futura | RH autorizado con permiso medico | Muy restringido | Si |
| Foto | Storage privado | RH/Empleado autorizado | Segun permiso | Si |
| Horario | `employee_schedules` futuro | Supervisor/RH | Autorizado | Si |
| Ponche | `time_events` futuro | Empleado/Sistema | Correccion por autorizados | Si |
| Finanzas | QuickBooks futuro / `finance_records` operacional | Finanzas | Finanzas autorizado | Si |

## 12. Riesgos

- mantener permisos sensibles en frontend;
- usar un solo campo de rol para decisiones complejas;
- no vincular claramente `employees` con `auth.users`;
- guardar fotos o documentos como datos publicos;
- mezclar datos medicos con expediente basico;
- permitir acceso financiero por rol administrativo general.

## 13. Decisiones pendientes

- detalle final de permisos por modulo;
- retencion documental;
- formato final de invitaciones;
- reglas de supervisores por equipo;
- alcance exacto del rol Ejecutivo;
- separacion final entre datos medicos basicos y documentos medicos.
