# Auditoría de validación — HORARIOS — 2026-10-27
**Implementación corregida en la rama. La migración no está aplicada a producción ni a staging. No fusionar ni desplegar el PR #102 sin autorización.**

## Hallazgos bloqueantes
1. **Identidad / autoedición:** employees.profile_id frente a auth.uid() no está demostrado como vínculo válido. Puede fallar de manera abierta si los identificadores pertenecen a entidades distintas.
2. **Snapshots:** save_schedule_week_draft captura source_shift_id y source_updated_at en SELECT separados. Sin lock ni snapshot coordinado, pueden corresponder a distintas versiones.
3. **Cambios concurrentes:** publish comprueba un snapshot anterior, pero un nuevo turno adicional podría crearse entre las consultas y la escritura. El advisory lock no obliga a los RPC existentes a cooperar.
4. **Límite semanal:** validar por item 8h no basta. El orden de los RPC individuales puede superar transitoriamente 40 horas, rechazando incluso un reemplazo final válido; además hay que revisar jornadas que abarcan medianoche.
5. **Turnos existentes:** el guard inicial admite que exista un segundo turno si source_shift_id no es NULL; completed está permitido en el filtro EXISTS y los casos de cancelación no se han certificado.
6. **Seguridad SECURITY DEFINER:** requiere examen de propietario, privilegios, search_path, grants y relaciones de identidad/museo.
7. **Firma RPC:** faltan pruebas con el catálogo real de PostgreSQL para confirmar firma y overloads de schedule_employee_shift y set_employee_day_off.
8. **Integración:** frontend sigue utilizando borradores locales; no invoca save_schedule_week_draft ni publish_schedule_week. No hay pruebas reales de Mi Espacio.
9. **Regresión:** no existen pruebas de rollback de un lote parcialmente procesado, auditoría y nómina con datos sintéticos.
10. **RLS y despliegue:** tablas denegadas por defecto; lectura/CRUD y función de publicación no desplegadas.

## Pasos necesarios antes de aprobación
- Hacer introspección **solo lectura** del catálogo y confirmar firmas de RPC, tipos, permisos y modelo de identidad.
- Corregir controles de autoedición, instantáneas coherentes y concurrencia semanal; bloquear cambios concurrentes de la ruta antigua o usar mecanismo unificado.
- Añadir una función de validación global antes de aplicar operaciones individuales.
- Preparar base PostgreSQL aislada con esquema equivalente, usuarios ficticios y tests de rollback (fallo en ítem 2 de 3), idempotencia, conflictos, permisos, 8/40h y PWA.
- Conectar la interfaz después de probar las funciones; nunca exponer 'Publicar' hasta obtener resultados satisfactorios.
- Mantener PR en borrador y producción sin cambios.

**Alcance de la revisión:** análisis estático de los tres SQL del PR; NO se ejecutaron pruebas de integración ni migraciones.
