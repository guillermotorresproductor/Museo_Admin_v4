# Gerente Administrativo: creación de empleados

## Causa y corrección (2026-09-22)

PR #35 incorporó `202609220001_administrative_manager_employee_management.sql`, pero la función `has_permission(text)` de producción todavía tenía la definición anterior y esa versión no figuraba en `supabase_migrations.schema_migrations`. El resultado efectivo era `employees.read.all=true`, `employees.create=false` y `employees.update.basic=false`.

El frontend actual usa `canManageEmployees()` para el botón «Crear empleado» y espera `current_user_permissions()` antes de inicializar Recursos Humanos. No era un filtro por etiqueta Administrador/Ejecutivo ni un problema de CSS. El backend también rechazaba la creación mediante la política restrictiva `module_profile_insert`.

Se aplicó la migración existente, primero en staging y luego en producción, registrando su versión. No se modificó ninguna cuenta, categoría, rol técnico ni permiso individual. No fue necesario cambiar JavaScript ni invalidar su caché: los permisos se consultan al cargar la página. Los dos archivos JavaScript servidos en producción se compararon con main `1f29a9cd60675e68d3ba33e60907d643a31473f3`; el HTML solo difiere por el beacon insertado por Cloudflare.

## Verificación

`supabase/tests/administrative-manager-employee-staging.mjs` realiza autenticación real y peticiones reales a Auth, PostgREST y la función de asignación de roles, exclusivamente en staging. Verificó:

- creación de un expediente sin cuenta ni categoría asignada y consulta tras una sesión nueva;
- permisos operativos de empleados sin `roles.assign`, `system.configure`, `users.manage` ni `finance.write`;
- rechazo de creación en otro museo y de asignación de Administrador;
- prioridad de una denegación explícita sobre el perfil y rechazo del INSERT;
- retirada de todas las entidades desechables creadas para la prueba.

En producción, una consulta con contexto SQL autenticado de Roberto confirmó `gerente_administrativo` y los permisos operativos de empleados, manteniendo denegados los cuatro permisos generales anteriores. Esta comprobación SQL no equivale a un inicio de sesión real ni a una prueba visual.

La aceptación visual en producción con la cuenta real de Roberto queda pendiente del inicio de sesión del usuario en el navegador conectado. No se creó ningún empleado de prueba en producción.
