# Revisión obligatoria — save_schedule_week_draft

**Estado: SQL de referencia no ejecutado.** La función propuesta valida tenant, permiso, autoedición, semana, duplicados, jornada neta y revisión optimista antes de guardar en tablas **nuevas** de borrador. No interactúa con employee_shifts.

**Bloqueos conocidos para usarla:** no captura aún snapshot seguro de turnos oficiales; faltan comprobaciones del acumulado semanal contra programación oficial y concurrencia con published; falta una función de lectura de borradores y pruebas reales en BD sintética. No usar con información existente ni anunciar publicación.

La publicación atómica no está implementada; debe aplicar reglas actuales de auditoría, solapamiento, bloqueo por actividad y controles de 40 horas del servidor, sin omitir reglas en producción.
