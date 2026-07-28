# Auditoría y Trazabilidad

## 1. Objetivo

Definir la arquitectura de auditoría y trazabilidad de Instituva para garantizar que todas las acciones funcionales relevantes realizadas dentro del sistema puedan reconstruirse de manera íntegra, verificable y consistente, independientemente del dominio al que pertenezcan.

La auditoría constituye una capacidad transversal de la plataforma y no pertenece a ningún dominio específico.

## 2. Alcance

Esta arquitectura aplica a todos los dominios funcionales de Instituva, incluyendo, entre otros:

- Colecciones
- Recursos Humanos
- Finanzas
- Inventario Administrativo
- Exposiciones
- Conservación
- Restauración
- Notificaciones
- Configuración del sistema

Todos los dominios deberán utilizar el mismo modelo conceptual de auditoría.

## 3. Principios fundamentales

### La auditoría es transversal

La auditoría forma parte de la plataforma.

Los dominios funcionales no implementan mecanismos independientes de auditoría.

### La auditoría preserva evidencia

Su propósito es conservar evidencia objetiva de las acciones realizadas dentro del sistema.

No interpreta acontecimientos, no reemplaza las reglas de negocio y no toma decisiones.

### La auditoría es permanente

Los registros de auditoría forman parte del patrimonio informativo de Instituva.

Su conservación debe permitir la reconstrucción histórica de las acciones relevantes.

### La auditoría es consistente

Todas las entidades y dominios deben generar evidencia de auditoría conforme a los mismos principios arquitectónicos.

## 4. Estado, historial y auditoría

Instituva distingue claramente tres conceptos.

### Estado

Representa la condición actual de una entidad.

Responde:

> ¿Cómo se encuentra actualmente?

### Historial

Describe la evolución funcional de una entidad a través del tiempo.

Responde:

> ¿Cómo evolucionó esta entidad?

El historial pertenece al dominio de negocio.

### Auditoría

Registra las acciones realizadas dentro del sistema sobre una entidad.

Responde:

> ¿Quién realizó qué acción, cuándo y sobre qué información?

La auditoría pertenece a la plataforma.

La auditoría no sustituye el historial funcional.

## 5. Modelo de auditoría

Instituva adopta un modelo de Auditoría de Cambios, correspondiente al Nivel 2.

Cada acción auditable deberá permitir reconstruir tanto la operación realizada como las modificaciones funcionales producidas.

Conceptualmente, la auditoría conserva evidencia de:

- la acción ejecutada;
- la entidad afectada;
- la persona o proceso responsable;
- el momento en que ocurrió;
- el resultado de la acción;
- los atributos funcionales modificados;
- los valores anteriores y posteriores, cuando corresponda.

El modelo no obliga a conservar indiscriminadamente información técnica o sensible.

## 6. Eventos auditables

Cada dominio determinará cuáles de sus acciones son funcionalmente relevantes.

Como principio general, deberán poder auditarse acciones como:

- creación;
- modificación;
- eliminación lógica;
- aprobación;
- rechazo;
- cambio de estado;
- cambio de ubicación;
- asignación o modificación de responsabilidades;
- restauración de información;
- operaciones que alteren información oficial;
- cambios relevantes de configuración.

La lista específica de acciones auditables pertenece a cada dominio.

## 7. Información mínima

Una acción auditable debe permitir identificar, cuando corresponda:

- quién o qué proceso realizó la acción;
- cuándo ocurrió;
- qué acción se realizó;
- sobre qué entidad se realizó;
- cuál fue el resultado;
- qué información cambió;
- cuál era el valor anterior;
- cuál es el valor nuevo.

La arquitectura no exige que todos los eventos contengan exactamente los mismos datos cuando estos no sean aplicables.

## 8. Inmutabilidad

Los registros de auditoría representan evidencia histórica.

Como principio arquitectónico:

- no deben modificarse;
- no deben sobrescribirse;
- no deben reutilizarse para representar eventos distintos;
- no deben eliminarse mediante operaciones funcionales normales.

Toda corrección debe generar nueva evidencia.

La historia no se reescribe.

## 9. Información sensible

La auditoría debe preservar evidencia sin comprometer información protegida.

Cuando una acción afecte datos sensibles, secretos, credenciales o información personal restringida, Instituva deberá registrar que el cambio ocurrió sin exponer necesariamente el contenido completo del valor anterior o posterior.

La trazabilidad no justifica revelar información protegida.

El acceso a la auditoría deberá respetar las políticas de autorización y confidencialidad de Instituva.

## 10. Consulta de auditoría

La auditoría debe poder consultarse de manera comprensible por personas autorizadas.

Las consultas deberán facilitar la identificación de:

- acciones realizadas;
- entidades afectadas;
- responsables;
- fechas;
- cambios producidos;
- resultados.

La consulta de auditoría no implica que toda persona usuaria tenga acceso irrestricto a todos los registros.

## 11. Experiencia de usuario

La auditoría no debe aumentar innecesariamente la carga operativa de las personas usuarias.

Como principios permanentes:

- la evidencia de auditoría debe generarse automáticamente;
- la persona usuaria no debe capturar manualmente información técnica de auditoría;
- la interfaz debe utilizar lenguaje claro y comprensible;
- los detalles técnicos o avanzados solo deben mostrarse cuando sean necesarios;
- los términos especializados deben incluir ayuda contextual cuando corresponda;
- la visualización de cambios debe priorizar la legibilidad;
- la complejidad de la auditoría debe permanecer en la arquitectura, no en la interfaz.

Una representación comprensible puede expresar un cambio de esta forma:

> Ubicación actualizada  
> De "Reserva Norte" a "Sala Permanente"  
> Realizado por María López el 19 de julio de 2026.

La interfaz no debe exigir conocimientos técnicos ni museográficos para comprender esa información.

## 12. Relación con los dominios

Todos los dominios utilizan la misma arquitectura transversal de auditoría.

Cada dominio conserva, además, su propio historial funcional cuando sea necesario.

Por ejemplo:

- Colecciones conserva la evolución museográfica de una pieza.
- Recursos Humanos conserva la evolución administrativa del personal.
- Inventario Administrativo conserva la evolución operativa de los activos.
- Finanzas conserva la evolución funcional de sus procesos internos.

La auditoría registra las acciones realizadas sobre esas entidades, pero no sustituye sus historiales funcionales.

## 13. Principios permanentes

- La auditoría es una capacidad transversal de Instituva.
- Ningún dominio implementa una auditoría independiente.
- La auditoría conserva evidencia objetiva.
- Estado, historial y auditoría son conceptos diferentes.
- Instituva adopta Auditoría de Cambios de Nivel 2.
- Toda modificación funcional relevante debe ser trazable.
- Los valores anteriores y posteriores se conservan cuando corresponda.
- La información sensible debe permanecer protegida.
- Los registros de auditoría son inmutables.
- La auditoría debe generarse automáticamente.
- La auditoría no debe complicar la experiencia de usuario.
- La complejidad pertenece a la arquitectura, no a la interfaz.
- La historia no se pierde ni se reescribe.