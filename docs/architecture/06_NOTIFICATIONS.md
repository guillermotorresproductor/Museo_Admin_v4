# Notificaciones

## Estado
AUDITADO

## Objetivo

Administrar las preferencias de los destinatarios de futuras alertas del sistema.

## Filosofía

- Este módulo NO es un motor de notificaciones.
- No procesa eventos.
- No recibe sensores.
- No envía correos.
- No envía SMS.
- No envía Push.
- Se limita a administrar preferencias.

## Funcionalidad actual

- Configuración de destinatarios.
- Cinco categorías de alerta.
- Preferencias por empleado.
- Persistencia en app_records.
- Uso de employee.id como identificador.

## Cambios implementados

- Filtrado de empleados inactivos.
- Exclusión de registros demo/locales.
- Mensaje aclaratorio sobre futuras integraciones.
- Validaciones para evitar guardar preferencias inválidas.

## Decisiones

### Mantener

- app_records como almacenamiento temporal.
- employee.id como referencia.
- Cinco categorías actuales.
- Configuración administrativa.

### Posponer

- Motor de eventos.
- APIs.
- Sensores.
- Webhooks.
- Historial.
- Canales de entrega.
- Correo.
- SMS.
- Push.
- WhatsApp.
- Revisión de políticas RLS.

## Pendientes para Notificaciones v2

- Integración con eventos externos.
- Tabla formal de eventos.
- Historial.
- Severidad.
- Estado leído/no leído.
- Canales de entrega.
- Integración con Auth.

## Conclusión

El módulo queda estabilizado como configuración administrativa para futuras integraciones.
