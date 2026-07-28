# Matriz inicial de roles y permisos

## Separacion entre puesto y permiso

`Director`, `Contable`, `Ujier`, `Tecnico` y otros puestos laborales no son necesariamente roles de seguridad.

- `position` y `department` pertenecen al expediente laboral.
- `roles` y `permissions` pertenecen a autorizacion del sistema.
- Una persona puede tener un puesto visible y permisos distintos.
- Finanzas es un permiso separado.
- Administrador no obtiene acceso financiero automaticamente.
- Administrador no obtiene acceso medico automaticamente.

## Roles iniciales

- Empleado
- Supervisor
- Recursos Humanos
- Finanzas
- Ejecutivo
- Administrador

## Matriz RBAC inicial

| Permiso | Descripcion | Roles por defecto | Restricciones | Edge Function | RLS | Auditoria |
|---|---|---|---|---|---|---|
| `profile.read.self` | Leer perfil propio de acceso. | Todos | Solo `auth.uid()`. | No | Si | No |
| `profile.update.self` | Actualizar datos no sensibles propios. | Todos | Campos permitidos. | No | Si | Si |
| `employees.read.self` | Leer expediente laboral propio permitido. | Empleado, Supervisor, RH, Finanzas, Ejecutivo, Administrador | Solo empleado vinculado. | No | Si | Si |
| `employees.read.team` | Leer empleados asignados. | Supervisor | Solo equipo asignado. | No | Si | Si |
| `employees.read.all` | Leer directorio laboral del museo. | Recursos Humanos, Ejecutivo | Sin datos medicos/financieros por defecto. | No | Si | Si |
| `employees.create` | Crear expediente laboral. | Recursos Humanos | No crea usuario Auth por si solo. | No | Si | Si |
| `employees.update.basic` | Editar datos basicos. | Recursos Humanos | Campos no sensibles. | No | Si | Si |
| `employees.update.employment` | Editar datos laborales. | Recursos Humanos | Compensacion puede requerir permiso adicional. | No | Si | Si |
| `employees.deactivate` | Desactivar expediente laboral. | Recursos Humanos | No equivale a desactivar Auth. | Si | Si | Si |
| `employees.medical.read` | Leer datos medicos. | Ninguno por defecto | Permiso separado. | No | Si | Si |
| `employees.medical.write` | Editar datos medicos. | Ninguno por defecto | Muy restringido. | No | Si | Si |
| `employee_documents.read.self` | Leer documentos propios permitidos. | Empleado | Segun tipo documental. | URL privada | Si | Si |
| `employee_documents.read.all` | Leer documentos laborales. | Recursos Humanos | No incluye medico salvo permiso. | URL privada | Si | Si |
| `employee_documents.write` | Cargar documentos. | Recursos Humanos | Storage privado. | URL privada | Si | Si |
| `schedules.read.self` | Leer horario propio. | Todos | Solo propio. | No | Si | No |
| `schedules.read.team` | Leer horarios del equipo. | Supervisor | Solo equipo asignado. | No | Si | No |
| `schedules.manage` | Crear/editar horarios. | Recursos Humanos, Supervisor | Supervisor solo equipo. | No | Si | Si |
| `time.clock` | Registrar ponche propio. | Empleado, Supervisor, RH, Finanzas, Ejecutivo, Administrador | Solo propio. | Opcional | Si | Si |
| `time.read.self` | Leer ponches propios. | Todos | Solo propio. | No | Si | Si |
| `time.read.team` | Leer ponches del equipo. | Supervisor | Solo equipo. | No | Si | Si |
| `time.correct` | Corregir ponches. | Recursos Humanos, Supervisor | Supervisor solo equipo. | Si | Si | Si |
| `timesheets.read.self` | Leer timesheets propios. | Todos | Solo propio. | No | Si | Si |
| `timesheets.read.team` | Leer timesheets del equipo. | Supervisor | Solo equipo. | No | Si | Si |
| `timesheets.approve` | Aprobar timesheets. | Supervisor | Solo equipo asignado. | Si | Si | Si |
| `notifications.read.self` | Leer notificaciones propias. | Todos | Solo destinatario. | No | Si | No |
| `notifications.manage` | Configurar alertas. | Ejecutivo, Administrador | No implica leer datos sensibles fuente. | No | Si | Si |
| `finance.read` | Leer Finanzas. | Finanzas | Permiso separado. | No | Si | Si |
| `finance.write` | Editar Finanzas. | Finanzas | Requiere auditoria. | No | Si | Si |
| `finance.export` | Exportar Finanzas. | Finanzas | Export protegido. | Si | Si | Si |
| `users.invite` | Invitar usuario Auth. | Recursos Humanos, Administrador autorizado | Backend seguro. | Si | Si | Si |
| `users.deactivate` | Desactivar acceso Auth. | Recursos Humanos, Administrador autorizado | Backend seguro. | Si | Si | Si |
| `roles.assign` | Asignar roles/permisos. | Administrador autorizado | Altamente restringido. | Si | Si | Si |
| `audit.read` | Leer bitacora. | Ejecutivo, Administrador autorizado | Finanzas separada si aplica. | No | Si | Si |
| `system.configure` | Configuracion tecnica del sistema. | Administrador | No da acceso financiero/medico. | Si para cambios sensibles | Si | Si |

## Reglas obligatorias

- Administrador no obtiene `finance.read`, `finance.write` ni `finance.export` automaticamente.
- Administrador no obtiene `employees.medical.read` automaticamente.
- Supervisor solo accede a su equipo.
- Empleado solo accede a su propia informacion.
- Recursos Humanos no recibe acceso financiero automaticamente.
- Finanzas no recibe acceso medico automaticamente.
- Ejecutivo no recibe todos los permisos automaticamente.
- `roles.assign` debe estar altamente restringido.
- `users.invite` y `users.deactivate` deben ejecutarse mediante backend seguro.

## Notas de implementacion futura

El frontend puede ocultar acciones, pero la seguridad real debe estar en RLS y Edge Functions. Cada permiso debe evaluarse contra `museum_id` y contra la identidad `auth.uid()`.
