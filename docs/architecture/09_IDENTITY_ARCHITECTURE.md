# Arquitectura de Identidad

## Propósito

Definir la arquitectura conceptual de identidad de Instituva para que toda acción funcional relevante pueda atribuirse a un actor reconocido dentro del sistema.

La identidad permite preservar responsabilidad, trazabilidad, continuidad histórica y calidad del modelo de conocimiento institucional. Este documento establece principios y límites semánticos; no define autorización, permisos, roles, tablas, esquemas, integraciones ni implementación técnica.

## Alcance

Esta arquitectura aplica a toda identidad que pueda participar en acciones, decisiones, recomendaciones, procesos, documentos, colecciones, registros administrativos, integraciones o eventos dentro de Instituva.

Una identidad puede representar:

- una persona;
- un agente de inteligencia artificial;
- un proceso automático;
- una integración externa;
- una cuenta de servicio.

Toda acción realizada dentro de Instituva debe poder atribuirse a una identidad.

## Principios

La identidad es una entidad conceptual del modelo de conocimiento de Instituva.

Las identidades no deben tratarse únicamente como cuentas de acceso. Representan actores institucionales que pueden participar en procesos, relaciones, decisiones, recomendaciones, auditorías y documentación.

Los principios permanentes son:

- toda acción funcional relevante debe tener una identidad atribuible;
- una identidad conserva continuidad histórica aunque cambien sus mecanismos de acceso;
- el tipo de identidad describe qué es el actor, pero no determina qué permisos posee;
- los tipos de identidad provienen de un catálogo oficial controlado por Instituva;
- la administración de identidades oficiales es un proceso de gobernanza;
- las identidades oficiales preservan historial, relaciones y trazabilidad;
- la complejidad técnica debe permanecer en la arquitectura, no en la experiencia de usuario.

## Modelo conceptual de identidad

Una identidad representa un actor reconocido por Instituva.

Ese actor puede intervenir directa o indirectamente en acciones del sistema, generar información, aprobar decisiones, recibir responsabilidades, producir recomendaciones, ejecutar procesos o relacionarse con entidades institucionales.

La identidad permite responder preguntas como:

- quién o qué realizó una acción;
- quién o qué generó una propuesta;
- quién aprobó una intervención;
- qué actor está relacionado con un documento, proceso, pieza, área o sistema externo;
- qué historial debe conservarse para reconstruir responsabilidad institucional.

## Tipos de identidad

Los tipos de identidad deben provenir de un catálogo oficial controlado por Instituva.

El tipo de identidad expresa la naturaleza del actor. No expresa permisos, autoridad ni nivel de acceso.

Instituva mantiene un catálogo oficial de tipos de identidad. Los tipos descritos en este documento constituyen el conjunto inicial reconocido por la plataforma, y su evolución depende de la gobernanza arquitectónica:

- Persona;
- Agente de inteligencia artificial;
- Proceso automático;
- Integración externa;
- Cuenta de servicio.

En la interfaz, el tipo de identidad debe seleccionarse mediante un menú desplegable. Cada opción debe contar con ayuda contextual en lenguaje sencillo para que una persona usuaria pueda comprender qué representa el tipo seleccionado.

## Persona y cuenta de acceso

Persona y cuenta de acceso son conceptos distintos.

Una persona puede existir dentro de Instituva sin tener cuenta de acceso. Esto permite preservar información institucional sobre empleados, especialistas, prestamistas, donantes, custodios, responsables u otros actores sin asumir que todos inician sesión en el sistema.

Una persona puede cambiar de cuenta de acceso sin perder su identidad histórica. Su expediente, relaciones, responsabilidades y acciones pasadas deben permanecer vinculadas a la misma identidad.

Una cuenta de acceso no representa por sí misma a la persona. La cuenta es un mecanismo operativo de entrada al sistema; la identidad representa al actor institucional.

## Gobernanza de identidades

La creación y administración de identidades oficiales constituye un proceso de gobernanza.

Las identidades serán creadas y mantenidas por personas especialistas responsables de la administración funcional del sistema. Esta gobernanza protege la calidad del modelo de conocimiento institucional y evita que el sistema acumule actores duplicados, ambiguos o mal clasificados.

La gobernanza de identidades debe preservar:

- la integridad semántica;
- el lenguaje ubicuo;
- la calidad de las relaciones;
- la consistencia del modelo de conocimiento institucional.

## Ciclo de vida

Las identidades oficiales nunca se eliminan físicamente del modelo de conocimiento.

Cuando una identidad deja de participar en la operación, cambia de estado, pero su existencia, relaciones e historial permanecen preservados.

El ciclo de vida conceptual de una identidad puede incluir creación, activación, actualización, cambio de estado, suspensión operativa, reactivación o cierre administrativo. Ninguno de estos eventos debe borrar evidencia histórica ni romper relaciones institucionales previas.

## Relaciones con el modelo de conocimiento

Las identidades existen dentro de una red de relaciones institucionales.

Pueden relacionarse con:

- personas;
- áreas;
- procesos;
- documentos;
- colecciones;
- sistemas externos;
- otros actores institucionales.

Estas relaciones permiten reconstruir responsabilidades, participación, procedencia de acciones, aprobaciones, custodias, recomendaciones, intervenciones y vínculos funcionales entre dominios.

Las identidades fortalecen el modelo de conocimiento porque conectan actores con hechos, documentos, piezas, decisiones y procesos institucionales.

## Identidades de inteligencia artificial

Los agentes de inteligencia artificial son identidades de primera clase dentro de Instituva.

Un agente de inteligencia artificial puede generar recomendaciones, propuestas, análisis, resúmenes, clasificaciones o intervenciones asistidas. Su participación debe quedar atribuida a su propia identidad, sin confundirse con la identidad de una persona.

Toda acción, recomendación o intervención de un agente de inteligencia artificial debe ser auditable.

Cuando una acción propuesta por un agente requiera aprobación humana, deben conservarse por separado:

- la identidad del agente que generó la propuesta;
- la identidad de la persona que la aprobó.

Esta separación protege la responsabilidad institucional y permite distinguir entre asistencia automatizada y decisión humana.

## Auditoría y trazabilidad

La identidad es necesaria para que la auditoría sea íntegra.

Toda acción funcional relevante debe poder asociarse con la identidad que la realizó, recomendó, aprobó o ejecutó. Esta atribución debe conservarse sin depender exclusivamente de una cuenta de acceso activa.

La auditoría debe distinguir, cuando corresponda, entre:

- identidad ejecutora;
- identidad proponente;
- identidad aprobadora;
- proceso automático;
- integración externa;
- cuenta de servicio.

La auditoría no sustituye el historial funcional de los dominios. La identidad permite que ese historial conserve responsabilidad clara y verificable.

## Experiencia de usuario

La arquitectura debe ocultar la complejidad técnica a las personas usuarias.

La interfaz debe utilizar lenguaje claro, consistente y alineado con el lenguaje ubicuo de Instituva. Cuando un concepto especializado pueda generar dudas, debe existir ayuda contextual integrada en lenguaje sencillo.

La selección del tipo de identidad debe ser comprensible para usuarios administrativos, especialistas y responsables funcionales. La experiencia no debe exigir conocimiento técnico sobre autenticación, integraciones o procesos automáticos para comprender qué representa una identidad.

## Límites del documento

Este documento no define autorización.

No establece permisos, roles, niveles de acceso, reglas de seguridad, modelos de autenticación, esquemas de datos, APIs, pantallas, integraciones ni implementación técnica.

La autorización se definirá en un documento posterior.

## Relaciones con otros documentos arquitectónicos

Este documento se relaciona con:

- `00_SYSTEM_ARCHITECTURE.md`, porque identidad forma parte de los principios transversales de Instituva;
- `03_UBIQUITOUS_LANGUAGE.md`, porque los tipos y conceptos de identidad deben respetar el lenguaje oficial;
- `08_AUDIT_AND_TRACEABILITY.md`, porque toda auditoría requiere atribución a una identidad;
- `05_HUMAN_RESOURCES.md`, porque Persona y cuenta de acceso son conceptos distintos dentro de la gestión administrativa;
- `02_COLLECTIONS_ARCHITECTURE.md`, porque Colecciones puede relacionar piezas, custodios, responsables, prestamistas, donantes e investigadores con identidades oficiales.

Estos documentos deben mantenerse coherentes entre sí para preservar la integridad semántica de Instituva.