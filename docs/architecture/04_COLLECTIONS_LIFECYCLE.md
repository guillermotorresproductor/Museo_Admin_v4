# Ciclo de Vida de Colecciones

## Objetivo

Este documento define el ciclo de vida funcional de una pieza dentro de Instituva.

El ciclo de vida describe cómo evoluciona el Expediente Museográfico desde el ingreso de una Pieza hasta el cierre de su expediente. Su propósito es establecer estados, eventos, transiciones válidas, límites y reglas permanentes para preservar la historia completa del Patrimonio Museológico.

Este documento no describe implementación, interfaces, almacenamiento, pantallas ni procesos técnicos.

## Principios del Ciclo de Vida

El ciclo de vida de Colecciones se rige por principios permanentes:

- toda Pieza conserva un único Expediente Museográfico;
- el Expediente Museográfico representa la memoria institucional de la Pieza;
- ningún evento del ciclo de vida elimina el Historial;
- toda modificación relevante debe conservar trazabilidad;
- la Baja Museográfica no destruye información;
- la Titularidad, la Adquisición y la Custodia son conceptos distintos;
- los valores administrativos museográficos no sustituyen la contabilidad oficial;
- los procesos de Préstamo y Donación forman parte del ciclo de vida de Colecciones;
- la complejidad del ciclo de vida pertenece a la arquitectura, no a la experiencia del usuario.

## Estados posibles de una pieza

Los estados describen la condición funcional del expediente dentro de Colecciones. Una Pieza puede atravesar distintos estados durante su vida institucional.

### Pieza Activa

Estado de una Pieza cuyo Expediente Museográfico permanece vigente para consulta, seguimiento, ubicación, conservación, exhibición o procesos museográficos activos.

### Pieza Prestada

Estado de una Pieza vinculada a un Préstamo documentado. Puede tratarse de una pieza recibida temporalmente por el museo o de una pieza prestada temporalmente por el museo.

### Pieza Devuelta

Estado que indica que el proceso de Préstamo o Custodia temporal concluyó mediante Devolución documentada. Este estado conserva el Historial del proceso.

### Pieza en Conservación

Estado de una Pieza bajo seguimiento, evaluación o cuidado preventivo documentado para preservar su integridad.

### Pieza en Restauración

Estado de una Pieza sometida a un proceso documentado de intervención para estabilizar, recuperar o mejorar su Condición.

### Baja Museográfica

Estado que indica la salida formal de una Pieza del Inventario Museográfico activo mediante una decisión institucional documentada.

### Expediente Cerrado

Estado del Expediente Museográfico cuando su ciclo activo concluyó administrativamente, preservando la información histórica para consulta, Auditoría y memoria institucional.

## Eventos del ciclo de vida

Los eventos son cambios relevantes que pueden ocurrir durante la vida de una Pieza. Todo evento significativo debe dejar evidencia suficiente para preservar el Historial.

### Ingreso

Evento mediante el cual una Pieza entra al conocimiento, evaluación, Custodia o responsabilidad museográfica del museo.

### Catalogación

Evento mediante el cual la Pieza recibe Identificación, Clasificación, descripción y organización conceptual dentro del Patrimonio Museológico.

### Adquisición

Evento mediante el cual una Pieza se incorpora al patrimonio o responsabilidad museográfica mediante una forma autorizada.

### Donación

Evento mediante el cual un Donante entrega una Pieza al museo. La Donación puede dar paso a Propiedad Institucional cuando el proceso correspondiente queda completado.

### Préstamo

Evento mediante el cual una Pieza entra o sale temporalmente bajo condiciones documentadas, conservando información de Prestamista, propósito, fechas, Custodia y Devolución esperada.

### Devolución

Evento mediante el cual concluye un Préstamo o una Custodia temporal, preservando la evidencia de entrega, Condición y cierre del proceso.

### Movimiento

Evento que documenta un cambio de Ubicación Museográfica, Custodia, contexto de Exhibición o responsabilidad operacional sobre una Pieza.

### Exposición

Evento mediante el cual una Pieza se presenta en un contexto museográfico, educativo, cultural o institucional aprobado.

### Conservación

Evento de seguimiento preventivo, evaluación o cuidado orientado a preservar la integridad de la Pieza.

### Restauración

Evento de intervención documentada para estabilizar, recuperar o mejorar la Condición de una Pieza.

### Baja

Evento institucional mediante el cual una Pieza sale del Inventario Museográfico activo sin perder su Expediente Museográfico ni su Historial.

### Cierre de expediente

Evento mediante el cual el Expediente Museográfico pasa a estado cerrado por conclusión del ciclo aplicable, preservando su memoria institucional.

## Transiciones permitidas

Las transiciones permitidas describen cambios conceptuales coherentes dentro del ciclo de vida de una Pieza.

- Ingreso puede conducir a Catalogación, Préstamo, Donación, Custodia temporal o evaluación institucional.
- Catalogación puede conducir a Pieza Activa cuando la identificación y documentación básica quedan establecidas.
- Donación puede conducir a Propiedad Institucional cuando se completa el proceso institucional correspondiente.
- Préstamo puede conducir a Pieza Prestada mientras la Custodia temporal permanece vigente.
- Pieza Prestada puede conducir a Pieza Devuelta cuando el Préstamo concluye mediante Devolución documentada.
- Pieza Activa puede entrar en Movimiento, Exposición, Conservación, Restauración o Baja Museográfica.
- Movimiento puede actualizar la Ubicación Museográfica sin cambiar la Titularidad ni la Adquisición.
- Exposición puede concluir y devolver la Pieza a su estado activo, a Conservación, a Restauración o a otro estado documentado según su Condición.
- Conservación puede devolver la Pieza a Pieza Activa o conducirla a Restauración si requiere intervención.
- Restauración puede devolver la Pieza a Pieza Activa, a Conservación o a Baja Museográfica si la decisión institucional lo justifica.
- Baja Museográfica puede conducir a Expediente Cerrado cuando se completa el proceso correspondiente.
- Expediente Cerrado conserva consulta histórica, pero no representa una Pieza activa dentro del Inventario Museográfico.

## Transiciones no permitidas

Las transiciones no permitidas protegen la integridad patrimonial y la trazabilidad del Expediente Museográfico.

- Una Pieza no debe eliminarse físicamente como sustituto de una Baja Museográfica.
- Una Baja Museográfica no debe borrar el Historial ni la Documentación Asociada.
- Una Pieza Prestada no debe convertirse en Propiedad Institucional sin un evento de Adquisición, Donación, transferencia u otra forma autorizada.
- Una Donación no debe asumirse como Propiedad Institucional hasta que el proceso correspondiente quede completado.
- Una Adquisición no debe confundirse con Titularidad ni con Custodia.
- Un Movimiento no debe alterar por sí solo la Titularidad, la Adquisición ni el origen de la Pieza.
- Una Pieza en Restauración no debe pasar a Expediente Cerrado sin una decisión institucional documentada.
- Una Devolución no debe eliminar la evidencia del Préstamo.
- Un Expediente Cerrado no debe reutilizarse para representar otra Pieza.
- Un valor administrativo museográfico no debe convertirse en registro contable oficial por transición del ciclo de vida.

## Reglas permanentes

Las reglas permanentes aseguran que el ciclo de vida sea consistente con la arquitectura de Instituva.

- Cada Pieza mantiene un único Expediente Museográfico oficial.
- Todo evento relevante debe relacionarse con el Expediente Museográfico correspondiente.
- El Historial debe conservarse incluso cuando una Pieza cambia de estado.
- La Evidencia Fotográfica y el Documento Asociado deben conservarse cuando respalden decisiones relevantes.
- Las decisiones sobre Préstamo, Donación, Baja Museográfica, Restauración y Cierre de expediente requieren trazabilidad permanente.
- Los estados describen la situación museográfica de la Pieza, no su valor contable.
- La Ubicación Museográfica debe reflejar el lugar autorizado donde la Pieza se encuentra o se encontró durante un evento documentado.
- La Condición debe poder documentarse al ingresar, moverse, prestarse, devolverse, exhibirse, conservarse o restaurarse una Pieza.

## Conservación del historial

El Historial es la secuencia preservada de eventos, cambios y procesos relacionados con una Pieza o Expediente Museográfico.

La conservación del Historial permite conocer la trayectoria institucional de una Pieza, validar decisiones, sostener auditorías y proteger la memoria del museo.

Deben preservarse, cuando apliquen:

- Identificación;
- Clasificación;
- Procedencia;
- Titularidad;
- Custodia;
- Adquisición;
- Donación;
- Préstamo;
- Devolución;
- Movimiento;
- Ubicación Museográfica;
- Condición;
- Conservación;
- Restauración;
- Exposición;
- Baja Museográfica;
- Expediente Cerrado;
- Documento Asociado;
- Evidencia Fotográfica;
- valores administrativos museográficos.

Ningún estado final o administrativo debe interpretarse como autorización para perder evidencia histórica.

## Relación con otros dominios

### Finanzas

Finanzas puede consumir valores administrativos museográficos o referencias operacionales cuando sean necesarios para consulta institucional. Colecciones conserva la responsabilidad principal sobre los valores museográficos de la Pieza. Finanzas conserva la responsabilidad sobre información financiera y contable oficial según su arquitectura aprobada.

### Inventario Administrativo

Inventario Administrativo administra recursos operacionales. Puede consumir referencias de Colecciones únicamente para distinguir patrimonio de recursos administrativos. Colecciones conserva la responsabilidad principal sobre piezas patrimoniales y su ciclo de vida.

### RRHH

RRHH proporciona información de personas que pueden actuar como Responsable, Custodio o participantes administrativos de un proceso. Colecciones conserva la responsabilidad principal sobre la Pieza, su estado y su Historial.

### Notificaciones

Notificaciones puede consumir, en una fase futura, eventos o criterios derivados del ciclo de vida de Colecciones. Notificaciones administra preferencias de destinatarios, mientras Colecciones conserva la responsabilidad sobre el significado museográfico de los eventos.

### Reportes

Reportes consume información oficial de Colecciones para presentar inventarios, historial, estados, movimientos, préstamos, donaciones, conservación, restauración o baja. Colecciones conserva la responsabilidad principal sobre los datos patrimoniales.

### Seguridad

Seguridad puede consumir Ubicación Museográfica, Condición de Custodia, Movimiento, Exposición o criterios de riesgo asociados a una Pieza. Seguridad conserva responsabilidad sobre incidentes y protección operativa; Colecciones conserva la responsabilidad sobre el Expediente Museográfico.

## Principios Permanentes

- El Expediente Museográfico representa la historia completa de la Pieza.
- Toda modificación relevante debe preservar evidencia y trazabilidad.
- Ningún evento del ciclo de vida elimina memoria institucional.
- La Baja Museográfica retira una Pieza del Inventario Museográfico activo, pero no destruye su expediente.
- La Devolución cierra una Custodia temporal o Préstamo, pero conserva el registro del proceso.
- La Titularidad, la Adquisición y la Custodia deben mantenerse como conceptos separados.
- Los valores administrativos museográficos apoyan la gestión patrimonial, pero no sustituyen información contable oficial.
- El Historial debe permanecer disponible para consulta, Auditoría y responsabilidad institucional.
- El lenguaje del ciclo de vida debe mantenerse alineado con el lenguaje oficial de Instituva.
- La experiencia del usuario debe presentar estos conceptos de forma clara, con ayuda contextual cuando un término especializado pueda generar dudas.