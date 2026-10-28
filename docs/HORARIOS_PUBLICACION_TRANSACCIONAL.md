# HORARIOS — publicación transaccional (diseño, no ejecutado)

No ejecutar migraciones ni escribir a Supabase con información real.

## Contrato
Tabla aislada de borradores semanales vinculada a museum_id y employees.id. Tabla hija de asignaciones con fecha, entrada, salida, almuerzo, acción, motivo, identificador y versión de turno original. RLS por museo y permiso schedules.manage. Los empleados no ven borradores.

## Publicación atómica
La RPC publish_schedule_week debe operar en una sola transacción PostgreSQL y: (1) comprobar auth.uid, museo, permiso y no autoedición; (2) bloquear semana y borrador; (3) verificar estado, revisión, fechas futuras, versiones de turnos originales y ausencia de actividad; (4) validar almuerzo, descansos, jornadas, acumulado semanal, solapamientos y turnos nocturnos; (5) aplicar todo o nada; (6) registrar auditoría, actor y fecha; (7) marcar publicado solo tras aplicar el lote. Ante conflicto: excepción y rollback total.

## Integración
Los turnos publicados siguen en employee_shifts para consulta desde list_my_assigned_shifts. No modificar attendance_events ni payroll. Conservar reglas existentes. No encadenar las RPC individuales desde el navegador para simular atomicidad.

## Bloqueo
La función schedule_employee_shift difiere entre staging y producción. Reconciliar en ambiente aislado antes de introducir una migración real. Pruebas con cuentas y datos sintéticos para roles, concurrency, 8/40h, nocturnos, cambios parciales fallidos, idempotencia, ponches y nómina.

Este documento es una especificación, no implementación ni certificación.
