# Colecciones — impresión múltiple y aviso de préstamo (2026-11-06)

## Alcance seguro de esta rama

**Implementado (frontend, sin escritura):** botón independiente «IMPRIMIR ETIQUETAS SELECCIONADAS» sobre el listado existente; imprime las piezas seleccionadas en hojas carta, ocho etiquetas por hoja como máximo (2 columnas × 4 filas), QR por pieza y saltos de página. Conserva «IMPRIMIR SELECCIÓN» (listado detallado) e «Imprimir etiqueta» (individual), sin cambiar los datos.

**No implementado ni activado:** envío, persistencia y programación de notificaciones. El módulo actual de notificaciones solamente administra preferencias, según `docs/architecture/06_NOTIFICATIONS.md`. No debe falsearse un aviso visible en el navegador como una notificación programada real.

## Contrato de vencimiento propuesto para revisión

- Origen: `collection_accessions.expected_return_on` cuando `modality = 'prestamo_temporal'`.
- Destinataria: empleados activos con permiso efectivo y ámbito organizacional equivalente al perfil Gerente Museográfica; nunca basarse exclusivamente en un nombre, cargo, variable del frontend o `localStorage`.
- Regla: evento de aviso exactamente 30 días calendario antes de la fecha estimada de devolución, computado en zona `America/Puerto_Rico`; comparar fechas, no milisegundos.
- Estados elegibles: préstamos vigentes y formalizados/recibidos según estados reales del ciclo de vida. No notificar borradores, devoluciones concluidas ni expedientes cerrados.
- Idempotencia: clave lógica `organization_id + accession_id + expected_return_on + notification_type + recipient_id`; un aviso por versión de fecha y destinatario.
- Cambio de fecha: invalidar/cancelar programaciones pendientes y generar el aviso para la nueva fecha; conservar historial de eventos emitidos.
- Si el préstamo entra con menos de 30 días restantes: definir explícitamente política de aviso inmediato antes de habilitar; no emitir mensajes retroactivos por accidente.
- Auditoría: conservar origen, fecha de vencimiento, fecha de programación, destinatario efectivo, estado y resultado, sin exponer contenido patrimonial sensible a otros roles.
- Separación de dominios: Colecciones es fuente de verdad; un futuro servicio transversal de notificaciones consume eventos y es dueño del transporte y preferencias.
- Seguridad: RLS por organización, permisos verificados del lado servidor, ejecución idempotente; sin credenciales elevadas en frontend.
- Pruebas requeridas: 30 días exactos; fin de mes/año; febrero bisiesto; fecha modificada; devolución anticipada; duplicados; dos organizaciones; empleado desactivado; reintentos fallidos.

## Puerta de aprobación antes de conectar a producción

1. Verificar contra Supabase operacional el esquema y estado exactos (solo lectura), sin asumir las migraciones aplicadas.
2. Aprobar arquitectura de Notificaciones v2, permisos y mecanismo seguro de scheduling.
3. Crear migración NUEVA, aditiva, reversible en desarrollo; no modificar migraciones previamente aplicadas.
4. Ensayar RLS, idempotencia, auditoría y pruebas en entorno aislado.
5. PR separado para motor de avisos; sin despliegue ni `db push` hasta revisión/autorización explícita.

## Verificación de impresión antes de aprobar

- Seleccionar 0, 1, 8, 9, 16 y 17 piezas; comprobar 0 (sin imprimir), 1, 1, 2, 2 y 3 páginas.
- Confirmar cada QR y título con pieza original, sin corte ni escalado accidental.
- Papel carta, escala 100 %, márgenes del navegador consistentes, sin encabezados/pies automáticos.
- Probar títulos largos y navegador Chrome; las etiquetas con texto excesivo requieren comprobación visual.
- Repetir pruebas de impresión individual y listado seleccionado.
- **No se ha validado aún una impresión física ni el sistema completo en navegador.**
