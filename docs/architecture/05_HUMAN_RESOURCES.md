# Recursos Humanos

## Estado
AUDITADO

## Objetivo
Administrar el expediente laboral de los empleados del museo.

## Filosofía
- Se conserva el módulo existente.
- No se reescribió la implementación.
- Solo se realizaron mejoras mínimas aprobadas.

## Cambios implementados
- Cambio visual de "Puesto" a "Cargo".
- Placeholder en "Horario asignado de trabajo".
- Cambio visual de "Rol dentro del sistema" a "Nivel de acceso".
- Eliminación visual de los campos Usuario y Contraseña temporal.
- Aclaración de que la creación del expediente no crea automáticamente una cuenta de acceso.
- Ocultar el botón visible de Restablecer contraseña.

## Decisiones aprobadas
### Mantener
- employees
- employees.status
- employees.access_level
- work_schedule
- Directorio de empleados
- Perfil de empleado

### Posponer
- Integración con Supabase Auth.
- Sincronización con profiles.role.
- RBAC.
- Edge Functions.
- auth_user_id.
- Soft Delete.

## Pendientes para RRHH v2
- Validación de correo duplicado.
- Filtrar empleados inactivos en Notificaciones.
- Mejorar la advertencia antes de eliminar un empleado.
- Evitar editar registros demo/locales como si fueran registros reales.

## Conclusión
El módulo Recursos Humanos queda auditado y estabilizado para la versión actual. Las mejoras futuras relacionadas con autenticación y permisos se implementarán en una fase posterior.
