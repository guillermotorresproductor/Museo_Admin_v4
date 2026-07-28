# Plan de implementacion futura - Fase 1

Este plan describe la implementacion futura de la arquitectura `AUTH -> PROFILE -> EMPLOYEE`. No ejecuta cambios en esta fase documental.

## Etapa 1 - Inventario real de Supabase

Objetivo: confirmar el estado real de Supabase antes de migrar.

Requiere obtener:

- esquema real;
- tablas reales;
- columnas;
- constraints;
- politicas RLS activas;
- triggers;
- funciones;
- usuarios Auth;
- buckets;
- policies de Storage.

Archivos futuros afectados: documentacion tecnica y futuras migraciones.

Cambios de base de datos: ninguno en esta etapa.

Dependencias: acceso al panel Supabase o dump de esquema.

Riesgos: asumir politicas no verificadas.

Rollback: no aplica.

Criterios de aceptacion:

- inventario confirmado;
- diferencias documentadas;
- decision de migracion aprobada.

Pruebas:

- comparar repo contra Supabase real;
- validar que `profiles`, `employees`, `finance_records`, `audit_logs` y `app_records` existen.

## Etapa 2 - Migraciones versionadas

Objetivo: crear una ruta formal para cambios de base de datos.

Carpeta futura propuesta:

```text
supabase/migrations/
```

No se crea todavia.

Archivos futuros afectados: migraciones SQL versionadas.

Cambios de base de datos: ninguno hasta aprobacion.

Dependencias: inventario real.

Riesgos: aplicar migraciones sobre esquema desconocido.

Rollback: scripts reversibles o migraciones correctivas.

Criterios de aceptacion:

- convencion de nombres aprobada;
- orden de migraciones definido;
- ambiente de prueba listo.

Pruebas:

- aplicar en proyecto Supabase de prueba antes de produccion.

## Etapa 3 - Modelo RBAC

Objetivo: separar roles y permisos.

Entidades futuras:

- `roles`;
- `permissions`;
- `user_roles`;
- `role_permissions`;
- `user_permissions`;
- `employee_supervisors`.

Archivos futuros afectados: migraciones, RLS, app auth context.

Cambios de base de datos: crear tablas RBAC.

Dependencias: `profiles` y `museum_id`.

Riesgos: dar permisos excesivos por defecto.

Rollback: mantener campo `profiles.role` temporalmente.

Criterios de aceptacion:

- roles iniciales creados;
- permisos separados de puesto laboral;
- Finanzas separado de Administrador.

Pruebas:

- usuario Empleado;
- Supervisor;
- Recursos Humanos;
- Finanzas;
- Ejecutivo;
- Administrador.

## Etapa 4 - Vinculo Auth/Profile/Employee

Objetivo: relacionar identidad, perfil y expediente.

Propuesta:

- `profiles.id = auth.users.id`;
- `employees.auth_user_id` nullable;
- constraint unica sobre `employees.auth_user_id` cuando no sea null;
- backfill gradual;
- empleados sin acceso permitidos;
- usuarios sin expediente laboral permitidos si el negocio lo requiere.

Archivos futuros afectados: migraciones, Recursos Humanos, Perfil Empleado.

Cambios de base de datos: agregar `auth_user_id` si no existe.

Dependencias: inventario de `employees`.

Riesgos: duplicar usuarios o vincular museo incorrecto.

Rollback: dejar `auth_user_id` nullable y reversible.

Criterios de aceptacion:

- empleado puede existir sin login;
- login puede vincularse a empleado;
- no se rompe el directorio actual.

Pruebas:

- empleado sin usuario;
- usuario administrativo sin empleado;
- empleado con usuario vinculado.

## Etapa 5 - Seguridad del frontend

Objetivo: retirar controles sensibles del navegador.

Tareas futuras:

- retirar `allowedUsers`;
- retirar contrasenas visibles;
- retirar `passwordTemporal` del expediente;
- centralizar contexto de sesion;
- evitar depender del rol almacenado localmente;
- no confiar en botones ocultos como seguridad.

Archivos futuros afectados: `js/app.js`, login y Finanzas.

Cambios de base de datos: ninguno directo.

Dependencias: RBAC y RLS.

Riesgos: bloquear usuarios validos si se cambia antes de RBAC.

Rollback: mantener compatibilidad temporal controlada.

Criterios de aceptacion:

- permisos vienen de Supabase;
- no hay listas sensibles en frontend;
- Finanzas requiere permiso real.

Pruebas:

- acceso sin login;
- acceso con Empleado;
- acceso con Finanzas;
- acceso con Administrador sin Finanzas.

## Etapa 6 - Edge Functions

Objetivo: mover operaciones sensibles al backend seguro.

Funciones futuras:

- `invite-employee`;
- `deactivate-user-access`;
- `reset-employee-password`;
- `assign-sensitive-role`;
- `generate-private-file-url`;
- `log-sensitive-admin-action`.

Archivos futuros afectados: `supabase/functions/` y llamadas frontend.

Cambios de base de datos: auditoria y tablas RBAC.

Dependencias: Supabase CLI o flujo de deploy.

Riesgos: exponer service role si se implementa mal.

Rollback: desactivar funcion y mantener estado anterior.

Criterios de aceptacion:

- service role nunca en frontend;
- toda accion sensible auditada.

Pruebas:

- usuario no autorizado recibe rechazo;
- usuario autorizado completa accion;
- audit log registra evento.

## Etapa 7 - RLS

Orden de implementacion:

1. `profiles`
2. `employees`
3. roles y permisos
4. documentos
5. horarios
6. ponches
7. timesheets
8. finanzas
9. auditoria

Objetivo: que Supabase sea la autoridad real de acceso.

Archivos futuros afectados: migraciones SQL.

Cambios de base de datos: policies por tabla.

Dependencias: RBAC.

Riesgos: bloquear flujos existentes si se aplica sin pruebas.

Rollback: usar ambiente de prueba y scripts de correccion.

Criterios de aceptacion:

- cada tabla operacional filtra por `museum_id`;
- cada policy usa `auth.uid()` cuando corresponde;
- empleados solo ven lo propio.

Pruebas:

- consultas directas con usuarios distintos;
- intentos de lectura cruzada por museo;
- intentos de editar sin permiso.

## Etapa 8 - Pruebas

Usuarios de prueba:

- empleado;
- supervisor;
- Recursos Humanos;
- Finanzas;
- Ejecutivo;
- Administrador.

Objetivo: validar permisos reales por rol.

Archivos futuros afectados: plan de QA y datos de prueba.

Cambios de base de datos: usuarios/datos de prueba.

Dependencias: RBAC, RLS, Edge Functions.

Riesgos: probar solo con Administrador y no detectar fallas de permisos.

Rollback: limpiar usuarios/datos de prueba.

Criterios de aceptacion:

- cada rol solo ve lo autorizado;
- acciones sensibles quedan auditadas;
- multi-museo no filtra datos cruzados.

Pruebas:

- lectura;
- creacion;
- edicion;
- eliminacion/desactivacion;
- exportacion financiera;
- acceso a documentos privados.

# Lo que no se hara en Fase 1

- ponche completo;
- geofence;
- biometria;
- QuickBooks;
- modularizacion completa de `app.js`;
- rediseno visual;
- migracion total de `app_records`;
- cambios funcionales en HTML, CSS o JavaScript;
- nuevas tablas sin aprobacion posterior.
