# Perfiles de módulos de empleados

Versión funcional: `module-profiles-20260918`.

Los diez perfiles se guardan en `employees.access_profile`, con catálogo en
`employee_module_profiles`. La vinculación existente `employees.profile_id`
determina el acceso del usuario. No se modifican `profiles.role`, los roles
asignados ni las excepciones de permisos. Un perfil NULL conserva exactamente
el acceso anterior; no hay conversión por cargo ni migración de empleados.

`Mi espacio` corresponde a `employee-portal.html`; `Calendario de Ujieres`
corresponde a `ujieres.html`. Consultar el calendario no concede
`usher.schedule.manage` ni acceso a Recursos Humanos.

El resolver existente `has_permission` conserva su OID y su implementación
anterior como función privada. Los perfiles añaden permisos de entrada/consulta
`modules.*.read` y restringen los permisos al conjunto de módulos elegido.
Los permisos de escritura, borrado, invitación y asignación de roles no se
conceden por seleccionar un perfil. Administración conserva los controles
adicionales de sus operaciones y subpáginas protegidas.

El frontend filtra menú, tarjetas y enlaces, y rechaza rutas antes de inicializar
el módulo. Supabase aplica políticas RLS restrictivas a tablas y archivos y
comprueba permisos en RPC y Edge Functions. La tabla de calendarios normalizados
también se filtra por `calendar_type`. Los HTML son recursos estáticos; la
protección de los datos y operaciones se ejecuta en el servidor.

La selección se realiza desde Administración → Recursos Humanos → empleado →
Nivel de acceso / Perfil de módulos → Guardar cambios. Requiere el permiso
existente `roles.assign`. El RPC verifica museo, vínculo de identidad, cambios
concurrentes y auditoría; no permite cambiar el propio perfil. Los empleados
sin cuenta guardan el perfil para su futura vinculación. Si su nivel técnico
estaba vacío, solo esa selección explícita establece `empleado` como base.

## Verificación focalizada

- 17 comprobaciones de frontend: matriz exacta, opciones, URL directa, controles
  administrativos existentes y correspondencia código/etiqueta.
- 21 escenarios transaccionales en PostgreSQL staging: diez perfiles sobre dos
  roles técnicos, RLS de registros/calendarios/inventario/mantenimiento,
  ausencia de privilegios nuevos, persistencia, rechazo de PATCH directo,
  función base privada, administrador anterior y conflictos. Fixtures revertidos.
- Diez guardados mediante la Edge Function, lectura del resultado, login nuevo
  y logout reales en staging. Cuentas y empleado descartables retirados;
  auditoría de prueba conservada sin referencia a cuentas eliminadas.
- Navegador local sin backend: selector operativo, cuatro módulos de Mantenimiento
  y denegación de Inventario por URL.
- Simulación transaccional sobre el esquema de producción: catálogo de diez
  perfiles y comparación de filas de empleados/cuentas sin cambios; rollback.

No se enviaron correos ni se repitieron pruebas de invitaciones.
