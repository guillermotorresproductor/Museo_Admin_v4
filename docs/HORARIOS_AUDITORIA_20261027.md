# HORARIOS — Auditoría de integración y gobernanza
Fecha: 2026-10-27
Estado: implementación en rama de desarrollo / NO AUTORIZADA PARA PRODUCCIÓN

## Base verificable
- Aplicación productiva: repositorio Museo_Admin_v4, Cloudflare Pages mmdpr.org.
- Base producción: museo-admin-v4 (Supabase). Base de prueba: museo-admin-v4-staging.
- Módulo ya existente en recursos-humanos.html: edición de turnos individuales, reglas recurrentes y excepciones.
- Mi Espacio tiene bindMyAssignedShifts y consume RPC list_my_assigned_shifts.
- Horarios consume list_employee_shifts, schedule_employee_shift y set_employee_day_off.
- Los datos de empleado se obtienen del directorio central, sin crear duplicados.

## Reglas de gobernanza
- Solo usuario con permiso schedules.manage puede consultar turnos de otros.
- La RPC valida auth.uid(), museo, empleado activo y bloquea autoedición.
- Los turnos existentes se guardan inmediatamente (NO hay flujo de aprobación/publicación diferida).
- Los ponches y cálculo de nómina no deben modificarse para implementar este módulo.
- Los cambios deben ser auditados mediante las RPC existentes.
- Para cambios futuros que requieren un estado de borrador/publicación, agregar contrato transaccional y controles de lectura a nivel de base antes de mostrar esa función.

## Hallazgos críticos
1. Comparación de funciones staging/producción (md5 pg_get_functiondef): schedule_employee_shift NO coincide. No sustituir el SQL de producción por staging.
2. list_employee_shifts y list_my_assigned_shifts usan mismo contrato en ambos entornos según digest verificado.
3. attendance_shift_json devuelve local_start y local_end, no starts_local ni ends_local. Corregido en la vista.
4. El listado incluye turnos completed, withdrawn/cancelled y day_off. La vista de programación debe sumar únicamente scheduled.
5. Día con más de un turno: evitar editar implícitamente el primero. Requerirá selector explícito para todos los casos avanzados.
6. Sin editor de borradores consolidado, no prometer visibilidad retardada a empleados.
7. La validación semanal de cliente es preventiva; la garantía definitiva debe quedar en la RPC de producción y la base de datos.

## Matriz de aceptación previa a merge
- Administrador General: consultar, editar empleados ajenos.
- Director Ejecutivo: consultar, editar empleados ajenos (si su perfil tiene schedules.manage).
- Gerente Administrativo: consultar, editar empleados ajenos (si su perfil tiene schedules.manage).
- Ujier/Guía/Mantenimiento: NO acceder a Horarios administrativos y SÍ ver solo su horario en Mi Espacio.
- No poder crear/editar turnos propios.
- Cambio de turno: motivo cuando la RPC lo requiere y auditoría.
- Turno 13:00–22:00, 60 min almuerzo = 8 h netas.
- Turno 13:00–21:00, 60 min almuerzo = 7 h netas.
- No permitir sobrepasar 40 h de programación ordinaria sin flujo excepcional expresamente autorizado.
- No permitir traslapes, turnos cerrados o completados.
- Día libre con motivo y control de concurrencia.
- Desconexión de red: error explícito, nunca reemplazar datos por «sin horario».
- Ponches y nómina: pruebas de regresión sin alteración.
- Vista móvil Mi Espacio para personal activo y usuarios con permisos.
- Impresión: semana y horas netas correctas.

## Bloqueadores para despliegue
- Validación funcional real con cuentas de prueba en staging.
- Alinear divergencia del contrato de schedule_employee_shift entre staging y producción.
- Implantar y verificar publicación diferida de semanas (si ese es requisito de lanzamiento).
- Revisión y aprobación del PR.
