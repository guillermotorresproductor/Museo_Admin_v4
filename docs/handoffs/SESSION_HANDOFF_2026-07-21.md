# Resumen de continuidad - 21 de julio de 2026

> Documento histórico de continuidad. No representa arquitectura vigente ni sustituye los documentos permanentes de arquitectura.

## Adelantos principales

- Se consolidó la identidad de usuarios mediante perfiles, roles y permisos reales del servidor.
- Se creó y probó un acceso separado para Recursos Humanos y otro para empleados.
- Se validó una experiencia limitada para empleados según sus funciones autorizadas.
- Se implementaron invitaciones seguras, activación de cuenta y recuperación de contraseña.
- Se creó el módulo de asistencia con ponches, horarios recurrentes, excepciones y horizonte automático de 90 días.
- Se implementó el flujo auditado de correcciones: solicitud del empleado, aprobación o rechazo de Recursos Humanos y conservación del registro histórico.
- La prueba completa con [TEST_USER] fue aprobada correctamente en staging; el registro anterior permaneció intacto y se creó la auditoría.
- Se corrigió el enrutamiento por identidad para impedir que una cuenta de Recursos Humanos adopte visualmente el expediente de un empleado.
- Se añadieron al expediente del empleado las secciones de compensación y contacto de emergencia con permisos restringidos.
- Se documentaron las reglas oficiales de asistencia, tardanzas, presencia física, almuerzo, turnos especiales, horas extra y correcciones.

## Estado técnico histórico

- Proyecto de prueba: Supabase staging `[STAGING_PROJECT_ID]`.
- Producción no fue modificada durante estas pruebas.
- Rama de trabajo: `docs/identity-architecture-phase-1`.
- Último commit enviado al momento del documento original: `e1cc7af`.
- La automatización de horarios y el flujo de correcciones estaban aplicados en staging.
- Las pruebas de sintaxis, autenticación, permisos, RLS, asistencia y auditoría resultaron satisfactorias.

## Cambio local pendiente al momento del documento original

- Se eliminaron de la interfaz de Recursos Humanos las referencias visibles al proveedor de base de datos.
- Los mensajes se hicieron neutrales: `DIRECTORIO SINCRONIZADO` y `ASISTENCIA ACTUALIZADA`.
- Archivos modificados en ese momento:
  - `js/app.js`
  - `js/services/supabase.js`
  - `recursos-humanos.html`

## Próximos pasos recomendados en ese momento

1. Revisar visualmente los mensajes neutrales y crear su commit y push.
2. Ocultar en el menú lateral los módulos que cada rol no tenga autorizados.
3. Terminar la compatibilidad entre los ponches históricos y los nuevos eventos gobernados.
4. Preparar la integración con QuickBooks solamente como destino contable; horarios, permisos y reglas laborales permanecen en el servidor propio.
5. Configurar copias de seguridad redundantes hacia almacenamiento autorizado mediante un proceso del servidor, nunca desde el navegador.
6. Cuando `instituva.com` estuviera activo en Cloudflare, configurar los dominios de aplicación y actualizar las URL autorizadas de autenticación usando placeholders de ambiente.
7. Al actualizar el plan de Supabase, revisar capacidad, copias de seguridad, retención, monitoreo y recuperación antes de producción.

## Principios que debían conservarse

- No guardar secretos, claves privadas ni contraseñas en el navegador o repositorio.
- Mantener RLS y permisos del servidor como autoridad final.
- No eliminar registros históricos de asistencia.
- Toda excepción, corrección y hora extra debe quedar auditada.
- Probar primero en staging y no modificar producción sin autorización expresa.