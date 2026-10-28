# INSTITUVA HORARIOS — Migración preparada (NO EJECUTAR EN PRODUCCIÓN)

El archivo SQL introduce exclusivamente dos tablas nuevas de borradores semanales. No cambia empleados, turnos oficiales, nómina, asistencia ni funciones existentes. Se dejan **sin políticas de acceso y sin GRANT** para evitar exposición prematura.

## Revisión pendiente

1. Implementar RPCs de CRUD del borrador con verificación de auth.uid(), museum_id y schedules.manage.
2. Implementar publicación atómica usando las restricciones existentes; no exponer función sin pruebas negativas de autorización, concurrencia y rollback.
3. Restringir el esquema de API: sin GRANT a anon y sin permisos generales de escritura a authenticated.
4. Validar en una base desechable, con empleados y cuentas sintéticas, antes de considerar staging.
5. Ensayar cambio de turno completado, día libre, noche, conflicto, límite 40h, fallo durante el lote y doble publicación.

**Importante:** el borrador JSON de la interfaz aún no se ha conectado a estas tablas. No se declara publicación completada.
