# Registro de decisiones de arquitectura

## ADR-001 - Supabase Auth como identidad oficial

Estado: Aprobada

Contexto:
Museo_Admin_v4 necesita una identidad unica y segura para usuarios del sistema.

Decision:
Supabase Auth sera el unico sistema oficial de autenticacion.

Consecuencias:
Las credenciales, sesiones, recuperacion e invitaciones deben gestionarse mediante Supabase Auth o backend seguro. No se mantendran contrasenas ni listas sensibles en el frontend.

## ADR-002 - Separacion Auth, Profile y Employee

Estado: Aprobada

Contexto:
El sistema mezcla acceso, usuario visible y expediente laboral.

Decision:
`auth.users` representa identidad y acceso. `profiles` representa perfil de acceso. `employees` representa expediente laboral.

Consecuencias:
`profiles.id` debe relacionarse con `auth.users.id`. `employees` debe tener un vinculo explicito opcional con Auth, preferiblemente `auth_user_id`.

## ADR-003 - RBAC con permisos explicitos

Estado: Aprobada

Contexto:
Un campo simple de rol no soporta separacion fina entre Finanzas, Recursos Humanos, supervision y administracion tecnica.

Decision:
Se utilizara RBAC con roles y permisos explicitos.

Consecuencias:
Se requeriran entidades como `roles`, `permissions`, `user_roles`, `role_permissions`, `user_permissions` y `employee_supervisors`.

## ADR-004 - Finanzas como permiso independiente

Estado: Aprobada

Contexto:
Los datos financieros son altamente sensibles y no deben abrirse automaticamente por tener rol tecnico o administrativo.

Decision:
Finanzas sera un permiso separado. Administrador no recibira acceso financiero automaticamente.

Consecuencias:
`finance.read`, `finance.write` y `finance.export` deben asignarse explicitamente y auditarse.

## ADR-005 - Arquitectura multi-museo

Estado: Aprobada

Contexto:
El sistema se proyecta para replicarse en otros museos.

Decision:
La arquitectura sera multi-museo.

Consecuencias:
Las entidades operacionales deben utilizar `museum_id` cuando corresponda. Las politicas RLS deben impedir acceso cruzado entre museos.

## ADR-006 - Storage privado para documentos laborales

Estado: Aprobada

Contexto:
Fotos y documentos laborales pueden contener informacion personal o sensible.

Decision:
Fotos y documentos de empleados deben almacenarse en Supabase Storage privado y entregarse mediante acceso autorizado.

Consecuencias:
El frontend no debe guardar documentos binarios ni fotos como base64 persistente. Se requeriran signed URLs o Edge Functions para acceso controlado.

## ADR-007 - Edge Functions para operaciones sensibles

Estado: Aprobada

Contexto:
Crear usuarios, resetear contrasenas, asignar roles o generar URLs privadas requiere privilegios que no deben estar en el navegador.

Decision:
Las operaciones sensibles se ejecutaran mediante backend seguro o Supabase Edge Functions.

Consecuencias:
El service role nunca debe exponerse en frontend. Toda accion sensible debe auditarse.

## ADR-008 - No modularizar app.js todavia

Estado: Aprobada

Contexto:
El archivo `js/app.js` concentra la logica actual. Modularizarlo junto con cambios de seguridad aumentaria el riesgo de regresion.

Decision:
`js/app.js` no se modularizara todavia en esta fase.

Consecuencias:
La Fase 1 documenta arquitectura y prepara migracion sin alterar comportamiento existente.

## ADR-009 - Mantener app_records temporalmente

Estado: Aprobada

Contexto:
`app_records` sostiene datos de varios modulos actuales y permite compatibilidad temporal.

Decision:
`app_records` continuara temporalmente para compatibilidad.

Consecuencias:
No se usara como modelo definitivo para identidad, empleados, horarios o ponche. Los modulos criticos migraran gradualmente a tablas estructuradas.

## ADR-010 - QuickBooks como fuente contable futura

Estado: Aprobada

Contexto:
El museo necesita contabilidad oficial y posible nomina conectada a un sistema contable.

Decision:
QuickBooks sera la fuente oficial futura para contabilidad y nomina. Museo_Admin_v4 manejara workflows, horarios, ponches, aprobaciones y registros de sincronizacion.

Consecuencias:
La integracion con QuickBooks debe hacerse posteriormente con backend seguro y OAuth 2.0. No debe exponerse ningun secreto de Intuit en frontend.
