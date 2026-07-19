# Arquitectura del Dominio Colecciones

## 1. Propósito

Colecciones define el dominio principal de Instituva para la gestión del patrimonio museológico del museo.

Su propósito es conservar la memoria institucional de cada pieza, organizar su ciclo de vida, proteger su información museográfica y establecer una fuente oficial para todo dato relacionado con el patrimonio bajo responsabilidad del museo.

Este documento define responsabilidades, límites y relaciones del dominio. No describe implementación, almacenamiento, pantallas ni integraciones técnicas.

## 2. Definición del dominio

Colecciones administra el patrimonio museológico del museo y el expediente oficial de cada pieza.

El dominio comprende los objetos, obras, instrumentos, documentos, materiales históricos y bienes patrimoniales que forman parte de la colección, se encuentran bajo custodia del museo, participan en procesos museográficos o están vinculados a préstamos, donaciones, adquisiciones, depósitos o formas legales autorizadas.

Colecciones representa el valor diferenciador de Instituva porque organiza la información que protege, explica y da continuidad al patrimonio cultural del museo.

## 3. Objeto central

El objeto central del dominio es la pieza museológica o bien patrimonial.

Una pieza museológica es cualquier objeto con valor cultural, histórico, artístico, documental, musical, educativo o museográfico que requiera identificación, documentación, custodia, localización, seguimiento, conservación o historial institucional.

Cada pieza posee un único expediente museográfico oficial. Toda información relacionada con la pieza debe derivar de ese expediente o quedar relacionada con él.

## 4. Criterios de pertenencia

Un objeto pertenece a Colecciones cuando representa patrimonio museológico o forma parte de un proceso museográfico.

Pertenecen a Colecciones:

- obras de arte;
- instrumentos musicales patrimoniales;
- documentos históricos;
- fotografías patrimoniales;
- vestuario, memorabilia y objetos culturales;
- piezas donadas, prestadas, adquiridas, depositadas o bajo custodia temporal;
- objetos incluidos en exposiciones o procesos de conservación, restauración, investigación o documentación museográfica.

Un objeto pertenece a Inventario Administrativo cuando sirve para la operación del museo y no constituye patrimonio museológico.

Pertenecen a Inventario Administrativo:

- equipos operacionales;
- mobiliario administrativo;
- materiales de uso interno;
- herramientas;
- recursos técnicos;
- activos utilizados para operar, mantener o administrar el museo.

La diferencia principal es la naturaleza del objeto. Colecciones protege patrimonio. Inventario Administrativo administra recursos operacionales.

## 5. Responsabilidades del dominio

Colecciones es responsable de:

- identificar piezas museológicas;
- conservar el expediente museográfico oficial;
- documentar procedencia, titularidad, adquisición y custodia;
- registrar donaciones, préstamos, depósitos y formas legales autorizadas;
- documentar ubicación museográfica;
- registrar condición, conservación y restauración;
- preservar historial de movimientos, exposiciones, devoluciones y bajas;
- asociar documentos, fotografías y evidencia institucional;
- conservar valores administrativos museográficos;
- proveer información confiable a reportes, dashboard, seguridad, conservación, restauración y otros dominios relacionados.

## 6. Responsabilidades excluidas

Colecciones no administra:

- contabilidad oficial;
- nómina;
- cuentas de usuario;
- permisos laborales;
- recursos humanos;
- materiales operacionales;
- equipos administrativos;
- mantenimiento general del edificio;
- motor de notificaciones;
- seguridad física como sistema independiente;
- reportes financieros oficiales;
- depreciación, activos financieros o estados financieros oficiales.

Estas responsabilidades pertenecen a otros dominios o sistemas oficiales según su naturaleza.

## 7. Fuente oficial del patrimonio

Colecciones es la fuente oficial del patrimonio museológico dentro de Instituva.

Toda pieza museológica debe tener su referencia oficial en Colecciones. Otros dominios pueden consultar, presentar, resumir o relacionar datos de piezas, pero no deben reemplazar a Colecciones como autoridad patrimonial.

Cuando exista diferencia entre información patrimonial presentada por otro módulo e información registrada en Colecciones, prevalece el expediente museográfico oficial.

## 8. Expediente museográfico

El expediente museográfico es la memoria institucional de una pieza.

Representa el conjunto organizado de información que permite conocer qué es la pieza, de dónde proviene, bajo qué condición legal se encuentra, dónde está, cuál es su condición, qué procesos ha vivido y qué documentación la respalda.

El expediente puede incluir, conceptualmente:

- identificación de la pieza;
- descripción museográfica;
- procedencia;
- titularidad;
- forma de adquisición;
- condición de custodia;
- ubicación;
- estado de conservación;
- historial de movimientos;
- procesos de préstamo, donación, conservación, restauración, exposición o baja;
- documentación, fotografías y evidencia asociada;
- valores administrativos museográficos.

El expediente no es solamente un registro inicial. Es el historial vivo y oficial de la pieza.

## 9. Titularidad, adquisición y custodia

Titularidad, adquisición y custodia son conceptos distintos.

La titularidad define quién posee legalmente la pieza. Una pieza puede ser propiedad institucional del museo o estar bajo otra condición legal autorizada.

La adquisición describe la forma en que la pieza ingresó al museo o a su esfera de responsabilidad. Puede originarse mediante compra, donación, transferencia, legado u otra forma autorizada.

La custodia describe la responsabilidad temporal o permanente del museo sobre una pieza, aunque la titularidad pertenezca a otra persona o entidad.

Una pieza donada puede convertirse en propiedad institucional. Un préstamo puede mantener la titularidad fuera del museo mientras la pieza queda bajo custodia temporal. La forma de adquisición no debe confundirse con la titularidad.

## 10. Ciclo de vida conceptual

El ciclo de vida de Colecciones describe los eventos institucionales que puede atravesar una pieza.

Ingreso:
La pieza entra al conocimiento o responsabilidad del museo para evaluación, registro, custodia o proceso museográfico.

Catalogación:
La pieza recibe identificación, descripción y organización conceptual dentro del patrimonio museológico.

Adquisición:
La pieza se incorpora formalmente mediante una forma autorizada, como compra, transferencia, legado u otro mecanismo aprobado.

Donación:
La pieza ingresa mediante aportación voluntaria y puede convertirse en propiedad institucional según el proceso aprobado.

Préstamo:
La pieza ingresa o sale temporalmente bajo condiciones documentadas, conservando la trazabilidad de prestamista, propósito, fechas y responsabilidad.

Devolución:
La pieza prestada retorna a la persona o entidad correspondiente, o se cierra el periodo de custodia temporal.

Movimiento:
La pieza cambia de ubicación, sala, custodia, exposición o condición operacional documentada.

Exposición:
La pieza se presenta en un contexto museográfico, educativo o institucional aprobado.

Conservación:
La pieza recibe seguimiento preventivo o evaluación para preservar su integridad.

Restauración:
La pieza atraviesa un proceso de intervención documentada para recuperar o estabilizar su condición.

Baja:
La pieza sale del inventario museográfico activo mediante un proceso institucional documentado.

Cierre de expediente:
El expediente queda cerrado administrativamente cuando el ciclo aplicable concluye, preservando su historial.

## 11. Historial y trazabilidad

La historia de una pieza nunca debe perderse.

Colecciones debe preservar la trazabilidad de eventos relevantes, incluyendo ingreso, registro, cambios de ubicación, préstamos, devoluciones, donaciones, conservación, restauración, exposiciones, bajas y cierre de expediente.

Las piezas patrimoniales no deben eliminarse mediante operaciones normales. Cualquier salida, baja o cierre debe preservar memoria institucional suficiente para auditoría, consulta histórica y responsabilidad museográfica.

## 12. Documentación asociada

La documentación asociada respalda el expediente museográfico.

Puede incluir formularios, comunicaciones, fotografías, autorizaciones, recibos, evidencia de condición, documentos legales, documentos de préstamo, documentos de donación, registros de conservación, restauración, baja, traslado o exposición.

Los documentos pueden estar disponibles desde áreas documentales del sistema, pero cuando describen o justifican la historia de una pieza deben relacionarse con Colecciones.

## 13. Valores administrativos museográficos

Colecciones puede registrar valores administrativos o museográficos cuando sean necesarios para operación, seguros, documentación, custodia, préstamos, donaciones o toma de decisiones internas.

Estos valores pueden incluir:

- valor estimado;
- valor asegurado;
- valor museográfico;
- valor de reposición.

Estos valores representan información administrativa o museográfica. No constituyen contabilidad oficial y no sustituyen registros contables, depreciaciones, activos financieros ni estados financieros oficiales.

La responsabilidad contable oficial permanece en el dominio financiero y en el sistema contable aprobado para ese propósito.

## 14. Relaciones con otros dominios

### Inventario Administrativo

Consume información de Colecciones cuando necesita distinguir patrimonio de recursos operacionales.

Proporciona información sobre equipos, mobiliario y recursos de operación que no son patrimonio museológico.

La responsabilidad principal sobre piezas patrimoniales permanece en Colecciones. La responsabilidad sobre recursos operacionales permanece en Inventario Administrativo.

### Exposiciones

Consume identificación, ubicación, condición, disponibilidad e historial museográfico de piezas.

Proporciona contexto expositivo, participación en salas, fechas, narrativa y uso museográfico temporal.

La responsabilidad principal sobre la pieza permanece en Colecciones. La responsabilidad sobre la programación o curaduría expositiva pertenece a Exposiciones.

### Conservación

Consume identificación, condición, fotografías, ubicación e historial de la pieza.

Proporciona evaluaciones preventivas, observaciones, recomendaciones y seguimiento de conservación.

La responsabilidad principal sobre el expediente permanece en Colecciones. La responsabilidad técnica del proceso de conservación pertenece a Conservación.

### Restauración

Consume información de la pieza, su condición, documentación y autorización institucional.

Proporciona registros de intervención, fechas, responsables, resultados y evidencia del proceso.

La responsabilidad principal sobre la pieza permanece en Colecciones. La responsabilidad del proceso restaurativo pertenece a Restauración.

### Seguridad

Consume ubicación, criticidad, condición de custodia y datos necesarios para proteger piezas.

Proporciona incidentes, alertas, observaciones o eventos relacionados con protección física.

La responsabilidad principal sobre la identidad e historia de la pieza permanece en Colecciones. Seguridad conserva responsabilidad sobre eventos y controles de protección.

### Documentos

Consume referencias a piezas y procesos museográficos cuando un documento respalda el expediente.

Proporciona acceso, organización y consulta de documentos institucionales relacionados.

La responsabilidad principal sobre documentos generales pertenece a Documentos. La responsabilidad sobre el significado museográfico del documento dentro del expediente pertenece a Colecciones.

### Reportes

Consume datos oficiales de Colecciones para informes museográficos, patrimoniales, administrativos o de seguimiento.

Proporciona vistas consolidadas, resúmenes y salidas institucionales.

La responsabilidad principal sobre los datos patrimoniales permanece en Colecciones. Reportes conserva responsabilidad sobre la presentación y consolidación.

### Notificaciones

Consume, en una fase futura, eventos o criterios relacionados con piezas, ubicación, condición o seguridad.

Proporciona preferencias administrativas de destinatarios para futuras alertas.

La responsabilidad principal sobre preferencias pertenece a Notificaciones. La responsabilidad sobre los datos patrimoniales permanece en Colecciones.

### Dashboard

Consume indicadores y resúmenes de Colecciones.

Proporciona visibilidad general del estado institucional.

La responsabilidad principal sobre el patrimonio permanece en Colecciones. Dashboard conserva responsabilidad sobre la vista resumida.

### Finanzas

Consume únicamente referencias administrativas cuando sean necesarias para consulta, conciliación interna o contexto institucional.

Proporciona información financiera o contable oficial según la arquitectura financiera aprobada.

La responsabilidad principal sobre valores museográficos permanece en Colecciones. La responsabilidad sobre contabilidad oficial permanece en Finanzas y en el sistema contable aprobado.

### Recursos Humanos

Consume referencias a responsables, usuarios o personal asociado a procesos museográficos.

Proporciona información laboral o administrativa de empleados autorizados.

La responsabilidad principal sobre empleados pertenece a Recursos Humanos. La responsabilidad sobre la pieza y su expediente permanece en Colecciones.

### Mantenimiento

Consume ubicación o contexto de áreas cuando una condición física del espacio pueda afectar piezas.

Proporciona reportes operacionales sobre áreas, trabajos, materiales o condiciones del edificio.

La responsabilidad principal sobre mantenimiento del espacio pertenece a Mantenimiento. La responsabilidad sobre la pieza y su condición museográfica permanece en Colecciones.

## 15. Funcionalidad existente relacionada

La funcionalidad actual relacionada con Colecciones aparece de forma parcial en varias áreas del sistema.

`inventario.html` contiene registros que mezclan equipos operacionales con obras de arte. Conceptualmente, la parte relacionada con obras de arte, donantes, prestamistas, valor, préstamo, devolución y propósito corresponde a Colecciones. La parte relacionada con equipos y recursos operacionales corresponde a Inventario Administrativo.

`recibo-prestamo.html` representa conceptualmente un proceso del ciclo de vida de Colecciones, específicamente la recepción de artículos de colección mediante préstamo.

`documentos.html` contiene accesos a formularios museográficos y documentos institucionales. Los documentos que respalden piezas, préstamos, donaciones, conservación, restauración o baja deben entenderse como documentación asociada al expediente museográfico.

Estas referencias reconocen el estado actual del sistema y no definen migraciones ni implementación.

## 16. Principios inviolables

- Existe un único expediente museográfico por pieza.
- Colecciones es la fuente oficial del patrimonio.
- Inventario Administrativo nunca administra patrimonio.
- Préstamos y Donaciones pertenecen al ciclo de vida de Colecciones.
- La historia de una pieza nunca debe perderse.
- Las piezas patrimoniales no deben eliminarse mediante operaciones normales.
- Los valores museográficos no sustituyen la contabilidad.
- Titularidad, adquisición y custodia son conceptos distintos.
- La forma de adquisición no determina por sí sola la titularidad.
- Toda documentación museográfica debe relacionarse con el expediente correspondiente.
- La complejidad pertenece a la arquitectura, no al usuario.
- El sistema debe enseñar cuando un concepto especializado pueda generar dudas mediante ayuda contextual integrada.