# Reglas de negocio - Asistencia y Ponches

## 1. Control documental

| Campo | Valor |
|---|---|
| Proyecto | Museo_Admin_v4 |
| Dominio | Recursos Humanos - Asistencia |
| Tipo | Especificacion funcional / Business Rules |
| Estado | Aprobada como base para implementacion posterior |
| Version | 1.0 |
| Fecha | 21 de julio de 2026 |
| Fuente de verdad futura | Turnos, eventos de asistencia, solicitudes de correccion, aprobaciones y auditoria estructurados en Supabase |
| Integracion futura | QuickBooks sera la fuente oficial de nomina; Instituva administrara horarios, ponches, excepciones, aprobaciones y sincronizacion |

## 2. Objetivo

Definir las reglas oficiales para registrar, validar, clasificar, corregir y aprobar la asistencia del personal del Museo de la Musica de Puerto Rico. Estas reglas deben poder implementarse sin reinterpretaciones, conservar evidencia historica y permitir configuracion administrativa sin cambios de codigo.

## 3. Alcance

Esta especificacion aplica a:

- turnos regulares y especiales;
- entrada y salida del empleado;
- salida y regreso de almuerzo;
- tardanzas y ausencias parciales;
- validacion de presencia fisica;
- ponches olvidados;
- trabajo antes o despues del turno;
- solicitudes, correcciones y aprobaciones;
- calculo operacional de tiempo para futura sincronizacion con QuickBooks.

No define calculos contributivos, deducciones, acumulaciones, clasificacion legal de horas extra ni procesamiento final de nomina. Esos resultados corresponderan a QuickBooks y a las reglas laborales aplicables configuradas por personal autorizado.

## 4. Principios obligatorios

**BR-ATT-001 - Inmutabilidad.** Ningun evento de asistencia se elimina ni se sobrescribe. Una correccion crea nuevos registros relacionados con el evento original.

**BR-ATT-002 - Hora real.** Todo evento aceptado conserva la fecha y hora real recibida por el servidor. La interfaz no podra sustituirla por la hora programada.

**BR-ATT-003 - Hora confiable.** La hora oficial sera la del servidor en UTC. La presentacion se convertira a la zona horaria configurada para el museo, inicialmente 'America/Puerto_Rico'.

**BR-ATT-004 - Separacion de conceptos.** El sistema conservara separadamente:

- hora real del evento;
- hora programada del turno;
- tiempo trabajado calculado;
- tiempo aprobable;
- tiempo finalmente aprobado para nomina.

**BR-ATT-005 - Aprobacion humana.** Ninguna excepcion, correccion u hora adicional se aprueba automaticamente.

**BR-ATT-006 - Auditoria.** Todo intento, aceptacion, rechazo, solicitud, aprobacion, denegacion y correccion relevante debe quedar auditado.

**BR-ATT-007 - Parametrizacion versionada.** Los valores administrativos deben conservar la version de configuracion utilizada al evaluar cada evento. Cambiar una regla no recalcula silenciosamente eventos historicos.

**BR-ATT-008 - Aislamiento.** Toda consulta y operacion se limita al 'museum_id' y a los permisos del usuario autenticado.

## 5. Definiciones

| Termino | Definicion funcional |
|---|---|
| Turno asignado | Periodo previamente configurado para un empleado, con inicio, fin, fecha y tipo. |
| Evento de asistencia | Marcacion inmutable de entrada, salida a almuerzo, regreso de almuerzo o salida final. |
| Intento rechazado | Solicitud de marcacion que no crea un evento confirmado, pero conserva evidencia minima del intento. |
| Hora real | Momento recibido y confirmado por el servidor. |
| Hora programada | Momento de inicio o fin definido en el turno. |
| Margen temprano | Periodo anterior al inicio durante el cual se permite registrar entrada. |
| Tolerancia | Periodo posterior al inicio que no se clasifica como tardanza. |
| Ausencia parcial | Entrada posterior al umbral configurado que exige justificacion y revision. |
| Tiempo adicional | Tiempo real antes o despues del turno que no constituye automaticamente tiempo aprobado de nomina. |
| Correccion | Registro nuevo y trazable que propone reemplazar funcionalmente un evento sin modificar el original. |

## 6. Precondiciones para marcar

**BR-ATT-010.** El usuario debe tener una sesion valida, un expediente laboral vinculado, estado activo y permiso 'time.clock'.

**BR-ATT-011.** Debe existir un turno asignado que corresponda al empleado y al momento del intento. Si no existe, no se confirma el ponche y se registra el intento como 'no_assigned_shift'.

**BR-ATT-012.** El turno debe estar activo y no cancelado. Los cambios posteriores al primer evento requieren trazabilidad y no pueden alterar silenciosamente la evaluacion original.

**BR-ATT-013.** El sistema debe impedir eventos incompatibles con el estado actual de la jornada.

## 7. Secuencia valida de eventos

La secuencia normal sera:

1. 'clock_in' - Entrada.
2. 'lunch_out' - Salida a almuerzo.
3. 'lunch_in' - Regreso de almuerzo.
4. 'clock_out' - Salida final.

**BR-ATT-020.** No puede existir una segunda entrada mientras la jornada permanezca abierta.

**BR-ATT-021.** No se permite salida a almuerzo sin entrada previa.

**BR-ATT-022.** No se permite regreso de almuerzo sin una salida a almuerzo abierta.

**BR-ATT-023.** No se permite salida final sin entrada previa.

**BR-ATT-024.** No se permite salida final mientras el empleado figure en almuerzo. El empleado debera registrar regreso o solicitar correccion.

**BR-ATT-025.** Los descansos cortos no generan eventos de asistencia.

## 8. Ventana de entrada

**BR-ATT-030.** La entrada puede confirmarse desde 15 minutos antes del inicio programado, inclusive.

**BR-ATT-031.** Todo evento aceptado conserva la hora real, incluso cuando ocurra dentro del margen temprano.

**BR-ATT-032.** Una entrada anterior al inicio programado no genera horas extra ni tiempo adicional aprobable por si sola. Para calculos ordinarios, el tiempo computable comenzara en la hora programada, salvo aprobacion explicita de trabajo previo al turno.

**BR-ATT-033.** Un intento anterior a la ventana de 15 minutos no crea evento de entrada. El intento se registra con resultado 'too_early' y la interfaz informa: "El turno aun no permite registrar asistencia. Podra marcar entrada a partir de [hora]".

**BR-ATT-034.** El limite temprano debe evaluarse con la configuracion vigente del museo y el turno asignado, no con la hora del dispositivo.

## 9. Tardanzas y ausencia parcial

La diferencia se calcula como 'hora_real_entrada - hora_programada_inicio'.

| Diferencia | Clasificacion | Resultado |
|---:|---|---|
| Menor o igual a 0 | A tiempo | Entrada aceptada. |
| Mayor de 0 y hasta 5:00 minutos, inclusive | Tolerancia | Entrada aceptada y clasificada dentro del margen. |
| Mayor de 5:00 y hasta 30:00 minutos, inclusive | Tardanza | Entrada aceptada y marcada como tardanza. |
| Mayor de 30:00 minutos | Ausencia parcial | Entrada aceptada, marcada como ausencia parcial y requiere justificacion. |

**BR-ATT-040.** Exactamente cinco minutos se considera tolerancia.

**BR-ATT-041.** Exactamente treinta minutos se considera tardanza; la ausencia parcial comienza al exceder treinta minutos.

**BR-ATT-042.** La tardanza no debe impedir el registro de entrada.

**BR-ATT-043.** Una ausencia parcial crea automaticamente una excepcion pendiente. El empleado debe presentar motivo y el supervisor debe resolverla.

**BR-ATT-044.** La clasificacion se conserva aunque posteriormente exista una correccion; la correccion genera una nueva evaluacion vinculada.

## 10. Validacion de presencia fisica

**BR-ATT-050.** Todo evento de asistencia requiere una validacion de presencia satisfactoria.

**BR-ATT-051.** La administracion configura uno o varios metodos permitidos:

- geolocalizacion y geocerca;
- red WiFi institucional validada por el servidor;
- codigo QR temporal y firmado;
- kiosco o tableta institucional registrada.

**BR-ATT-052.** La politica configurable define si basta un metodo valido o si se requiere una combinacion. El valor inicial recomendado es un metodo valido de la lista autorizada.

**BR-ATT-053.** Si la validacion falla, no se crea un evento confirmado. Se registra un intento con resultado 'presence_validation_failed', metodo utilizado, fecha, usuario y razon tecnica no sensible.

**BR-ATT-054.** La interfaz debe explicar que no pudo confirmarse presencia y ofrecer reintento o el mecanismo alterno autorizado.

**BR-ATT-055.** La evidencia de ubicacion debe minimizar datos personales. No se conservara un historial continuo de ubicacion; solo la evidencia necesaria asociada al intento.

**BR-ATT-056.** Si el dispositivo no concede permiso de ubicacion y no existe otro metodo autorizado, el ponche se rechaza. La falta de permiso no equivale automaticamente a ausencia; puede originar una solicitud de excepcion.

## 11. Almuerzo

**BR-ATT-060.** La salida y regreso de almuerzo son eventos independientes y conservan la hora real.

**BR-ATT-061.** El periodo de almuerzo se calcula desde 'lunch_out' hasta 'lunch_in'.

**BR-ATT-062.** Un almuerzo sin evento de regreso permanece abierto y evita la salida final hasta corregirse o completarse.

**BR-ATT-063.** Si falta cualquiera de los eventos de almuerzo, el empleado debe solicitar correccion; el sistema no inventa una hora.

**BR-ATT-064.** La duracion esperada del almuerzo sera configurable por turno o politica, pero una diferencia no modificara automaticamente el registro ni generara sanciones automaticas. Podra crear una excepcion para revision.

## 12. Turnos especiales

**BR-ATT-070.** El sistema soportara turnos regulares, nocturnos, de fin de semana, de actividad especial y extraordinarios.

**BR-ATT-071.** Todo turno especial debe configurarse antes de utilizarse y contener:

- empleado;
- museo;
- fecha;
- fecha y hora de inicio;
- fecha y hora de fin;
- tipo de turno;
- zona horaria;
- responsable que lo creo o aprobo;
- estado del turno.

**BR-ATT-072.** Un turno puede cruzar medianoche. Su fecha operacional sera la fecha de inicio, pero conservara timestamps completos para evitar ambiguedad.

**BR-ATT-073.** Los eventos deben validarse contra el turno especial asignado, no contra el horario regular del empleado.

**BR-ATT-074.** Si existen turnos que se solapan, el sistema debe exigir seleccion o resolucion administrativa antes de confirmar el evento; no elegira silenciosamente.

**BR-ATT-075.** Un turno especial creado despues de ocurrido el trabajo requiere justificacion y aprobacion; no regulariza automaticamente eventos previos.

## 13. Ponches olvidados

**BR-ATT-080.** El empleado puede solicitar una correccion para cualquier evento faltante permitido.

**BR-ATT-081.** La solicitud debe incluir turno, tipo de evento faltante, fecha y hora propuestas y motivo obligatorio.

**BR-ATT-082.** La solicitud inicia en estado 'pending' y no cambia el timesheet hasta ser aprobada.

**BR-ATT-083.** Un supervisor autorizado puede aprobar o rechazar. Recursos Humanos puede intervenir conforme a 'time.correct' y a las reglas de alcance.

**BR-ATT-084.** El solicitante no puede aprobar su propia solicitud.

**BR-ATT-085.** El rechazo requiere motivo y permanece en el historial.

**BR-ATT-086.** La aprobacion crea un evento corregido o suplementario y conserva el evento original, si lo hubiera.

## 14. Horas adicionales y horas extra

**BR-ATT-090.** La salida final siempre conserva la hora real, aunque ocurra despues del fin programado.

**BR-ATT-091.** Toda permanencia posterior al fin del turno se clasifica inicialmente como 'overtime_pending', segun el umbral administrativo configurado.

**BR-ATT-092.** El tiempo adicional no se aprueba automaticamente ni se envia como horas extra aprobadas a nomina.

**BR-ATT-093.** El supervisor debe aprobar, aprobar parcialmente o rechazar el tiempo adicional y documentar la decision.

**BR-ATT-094.** La aprobacion debe distinguir entre tiempo real registrado y tiempo aprobado. Una aprobacion parcial no altera la hora real de salida.

**BR-ATT-095.** Trabajo anterior al inicio del turno sigue la misma regla: se conserva la hora real, pero solo se considera adicional si fue autorizado expresamente.

**BR-ATT-096.** La elegibilidad laboral para horas extra y su calculo final no se deducen exclusivamente del ponche; utilizaran la clasificacion de compensacion, las reglas aprobadas y el sistema oficial de nomina.

## 15. Correcciones y aprobaciones

**BR-ATT-100.** Una correccion nunca ejecuta 'UPDATE' o 'DELETE' sobre el evento original.

**BR-ATT-101.** Toda correccion conserva:

- identificador del evento original, cuando exista;
- tipo, fecha y hora originales;
- tipo, fecha y hora propuestos o aprobados;
- solicitante;
- aprobador;
- fecha y hora de solicitud;
- fecha y hora de decision;
- motivo del empleado;
- comentario de decision;
- estado;
- version de reglas aplicada.

**BR-ATT-102.** Estados permitidos: 'pending', 'approved', 'partially_approved', 'rejected', 'cancelled_by_requester' antes de decision.

**BR-ATT-103.** Una decision completada no se edita. Una reconsideracion crea una nueva solicitud relacionada.

**BR-ATT-104.** El supervisor solo decide sobre empleados de su equipo. Recursos Humanos actua segun permisos institucionales. Ninguna persona aprueba su propio evento o solicitud.

**BR-ATT-105.** Las aprobaciones sensibles deben ejecutarse mediante backend seguro y quedar auditadas.

## 16. Intentos y resultados

Todo intento debe terminar en uno de los siguientes resultados funcionales:

| Resultado | Crea evento confirmado | Descripcion |
|---|---:|---|
| 'accepted' | Si | Evento valido y confirmado. |
| 'too_early' | No | Fuera de la ventana temprana. |
| 'presence_validation_failed' | No | No se confirmo presencia fisica. |
| 'no_assigned_shift' | No | No existe turno aplicable. |
| 'invalid_sequence' | No | El evento contradice el estado actual. |
| 'inactive_employee' | No | Expediente inactivo. |
| 'permission_denied' | No | Usuario sin autorizacion. |
| 'duplicate_event' | No | Evento incompatible o duplicado. |
| 'system_error' | No | Fallo tecnico; no debe presentarse como ponche exitoso. |

## 17. Parametros administrativos

Los siguientes parametros deben administrarse sin modificar codigo:

| Parametro | Valor inicial | Restriccion funcional |
|---|---:|---|
| 'early_clock_in_minutes' | 15 | Entero no negativo. |
| 'late_tolerance_minutes' | 5 | Entero no negativo. |
| 'partial_absence_minutes' | 30 | Debe ser mayor que la tolerancia. |
| 'overtime_review_threshold_minutes' | 0 | Tiempo posterior al turno que genera revision. |
| 'expected_lunch_minutes' | Por definir | Configurable por politica o turno. |
| 'presence_validation_mode' | Un metodo valido | Lista o combinacion aprobada. |
| 'allowed_presence_methods' | Por definir | Geocerca, WiFi, QR y/o kiosco. |
| 'timezone' | America/Puerto_Rico | Configurable por museo. |
| 'correction_submission_days' | Por definir | No inventar valor hasta aprobacion institucional. |
| 'approval_reminder_hours' | Por definir | Solo recordatorio; no autoaprueba. |

**BR-ATT-110.** Cada cambio de parametros requiere usuario autorizado, fecha efectiva, motivo, version y auditoria.

**BR-ATT-111.** Una configuracion nueva aplica prospectivamente desde su fecha efectiva.

## 18. Roles y responsabilidades

| Actor | Responsabilidad |
|---|---|
| Empleado | Registrar sus eventos, consultar los propios y solicitar correcciones. |
| Supervisor | Consultar su equipo, resolver excepciones, correcciones y tiempo adicional dentro de su alcance. |
| Recursos Humanos | Administrar turnos, consultar asistencia autorizada, corregir conforme a permiso y supervisar cumplimiento. |
| Administracion autorizada | Configurar parametros institucionales sin obtener automaticamente permisos de nomina. |
| Sistema | Validar reglas, preservar evidencia, clasificar eventos y generar auditoria. |
| QuickBooks futuro | Procesar la nomina oficial una vez aprobada la integracion y los datos. |

## 19. Mensajes funcionales minimos

- Entrada confirmada: "Entrada registrada correctamente a las [hora]".
- Demasiado temprano: "El turno aun no permite registrar asistencia. Podra marcar entrada a partir de [hora]".
- Tolerancia: "Entrada registrada dentro del margen de tolerancia".
- Tardanza: "Entrada registrada con tardanza de [minutos] minutos".
- Ausencia parcial: "Entrada registrada como ausencia parcial. Debe presentar una justificacion".
- Presencia fallida: "No se pudo confirmar su presencia en el Museo. Intente nuevamente o utilice otro metodo autorizado".
- Secuencia invalida: mensaje especifico que indique el evento pendiente.
- Salida posterior: "Salida registrada. El tiempo adicional queda pendiente de aprobacion".
- Correccion enviada: "Solicitud enviada al supervisor. El registro original no fue modificado".

## 20. Criterios de aceptacion

1. Una entrada a -15:00 minutos se acepta; a -15:01 se rechaza y registra el intento.
2. La hora real se conserva y nunca se redondea sustituyendo el evento.
3. Una entrada a +5:00 se clasifica tolerancia; a +5:01, tardanza.
4. Una entrada a +30:00 se clasifica tardanza; a +30:01, ausencia parcial.
5. Una entrada temprana aceptada no genera automaticamente horas extra.
6. Un fallo de presencia no crea evento confirmado.
7. No se puede registrar almuerzo o salida en secuencia invalida.
8. Los turnos que cruzan medianoche se evaluan con timestamps completos.
9. La salida tardia conserva la hora real y genera revision de tiempo adicional.
10. Una correccion aprobada conserva tanto el original como el registro corregido.
11. El solicitante no puede aprobar su propia solicitud.
12. El supervisor no puede aprobar empleados fuera de su equipo.
13. Los parametros pueden cambiarse sin desplegar codigo y cada evento conserva la version evaluada.
14. Ningun flujo funcional elimina asistencia, intentos, solicitudes, decisiones o auditoria.
15. La sincronizacion futura solo transmite tiempo aprobado y nunca secretos de Intuit desde el navegador.

## 21. Decisiones pendientes antes de implementar

Estas decisiones requieren aprobacion institucional y no deben inferirse:

- duracion esperada del almuerzo por tipo de turno;
- plazo para solicitar correcciones;
- metodos de presencia autorizados y prioridad entre ellos;
- coordenadas y radio de la geocerca;
- identificadores de redes o kioscos institucionales;
- reglas para empleados que trabajan fuera del Museo;
- umbral minimo para revision de tiempo adicional si no se usa cero;
- flujo de segunda aprobacion para horas extra, si aplica;
- politica de retencion y acceso a evidencia de ubicacion;
- mapeo final de tiempo aprobado hacia QuickBooks.
