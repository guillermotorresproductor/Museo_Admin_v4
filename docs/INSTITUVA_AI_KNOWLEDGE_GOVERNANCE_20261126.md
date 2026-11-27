# INSTITUVA AI — Gobernanza de conocimiento y experiencia conversacional
Fecha: 2026-11-26
Estado: PROPUESTA DE REVISIÓN; no desplegar sin validaciones.

## Objetivo invariable
Asistente institucional que investiga incidencias de los módulos habilitados, explica hallazgos con evidencia autorizada y propone acciones humanas. No ejecuta escrituras operacionales, cambios de permisos, modificaciones de datos, migraciones ni configuraciones. La tecnología, consultas y controles son internos; el usuario conversa naturalmente.

## Principios de seguridad
1. Separación estricta por `museum_id`, identidad autenticada y permisos efectivos antes de cada consulta. Nunca confiar en IDs, nombres o filtros enviados por el usuario como autorización.
2. El modelo nunca recibe llaves, JWT, secretos, conexiones SQL arbitrarias, datos de otros museos ni interfaces de escritura.
3. La selección de fuentes es en servidor y de vocabulario cerrado; retornar evidencia mínima. Reducir identificadores y datos personales al mínimo indispensable.
4. Mantener `store:false` cuando se utilice el proveedor; no registrar prompts, datos personales ni snapshots. Guardar solo métricas operativas agregadas sin contenido.
5. Incidentes sin evidencia suficiente: indicar límites y pedir únicamente el dato necesario; no inventar estados, usuarios, fechas, montos ni causas.
6. Documentos y datos consultados son contenido no confiable, no instrucciones para cambiar reglas o revelar información.
7. No ampliar permisos, endpoints o dominios como consecuencia de una pregunta.
8. Cualquier evolución de seguridad sigue su propio ciclo de revisión: este trabajo no sustituye controles pendientes.

## Fuentes de conocimiento y precedencia
1. Estado vigente del código y esquema aprobados para la versión desplegada, verificado con commit y ambiente.
2. Políticas operacionales aprobadas y documentación vigente versionada.
3. Runbooks revisados y pruebas de aceptación vigentes.
4. Historial de decisiones: solo contexto; etiquetar histórico/no verificado hasta cotejar.
5. Conversaciones: **no** inyectarlas directamente como verdad de producción.

Cada entrada debe incluir: id, dominio, explicación, fuente/ruta, commit o versión, fecha de revisión, estado (vigente / histórico no contrastado / pendiente / rechazado), restricciones de permisos y responsable de validación cuando aplique. Descartar contraseñas, secretos y registros reales del conocimiento global.

## Dominios iniciales
- Organización, multi-museo, roles y permisos.
- Asistencia: entrada, almuerzo, regreso, salida, alertas y correcciones autorizadas.
- Horarios: preparación, publicación, límites, validaciones y visibilidad.
- Finanzas: registros, cheques, facturas, controles de duplicados, contable externo de solo lectura.
- Colecciones: adquisiciones/ingresos, objetos, préstamos, fotografías y etiquetas.
- Inventario: artículos, equipos y trazabilidad.
- Recursos Humanos: empleados, usuarios, perfiles y solicitudes de días libres.
- Notificaciones, calendarios, documentos, reportes y configuración técnica autorizada.

## Experiencia del usuario
- Chat moderno, minimalista, con entrada única en lenguaje natural y respuesta conversacional.
- No mostrar permanentemente «¿Quieres que te guíe paso a paso?» ni «Comenzar guía».
- El asistente ofrece pasos secuenciales **solo si el diagnóstico o el usuario los requiere**; la guía se incorpora a la conversación y admite continuar, aclarar o cambiar de tema.
- Detalles de fuentes y evidencia disponibles bajo demanda, sin ocupar la pantalla principal.
- Desambiguar personas o fechas solamente cuando sea imprescindible; nunca consultar expedientes antes de resolver identidad y autorización.
- No confundir respuesta orientativa con acción ejecutada. Ningún botón de «siguiente» realiza cambios.

## Estrategia de implementación sin riesgo
Fase A — Auditoría: cotejar ramas y despliegue de `supabase/functions/instituva-ai-assistant/`. En revisión de `main` del 26-11-2026, el archivo `index.ts` importa `product-knowledge.ts` e `incident-runbooks.ts`, pero las lecturas directas de esas rutas en `main` devolvieron NOT_FOUND. Ambas dependencias requieren reconciliación de código antes de modificar o publicar el backend. La rama histórica `feat/instituva-ai-readonly-diagnostic-v1-20261125` contiene al menos `product-knowledge.ts`. No asumir que la función desplegada coincide con `main`.

Fase B — Inventariar y contrastar entradas de conocimiento con fuente/commit, sin registros personales; conservar las referencias históricas como no verificadas.

Fase C — Integrar la base validada al mecanismo existente de `findProductKnowledge` sin habilitar herramientas de escritura, sin ampliar permisos y sin alterar otros módulos.

Fase D — Pruebas aisladas en staging: autenticación; perfiles; múltiples museos; solicitudes no autorizadas; aislamiento de datos; ausencia de escrituras; respuestas con y sin evidencia; confusión de nombres; guías opcionales; regresión de módulos existentes; costo de tokens.

Fase E — Promoción controlada solo tras aprobación explícita, revisión de cambios, y comparación del commit desplegado con el probado.

## Casos de aceptación
- «¿Por qué Roberto no puede corregir un ponche?» → explicar norma aplicable **sin consultar datos personales** si la pregunta es general; para el caso individual, exigir permisos y evidencia.
- Pregunta de usuario de museo A sobre museo B → denegar sin filtraciones.
- Referencia de política no cotejada → etiquetar como no verificada; no presentar como hecho actual.
- Pregunta genérica → respuesta natural, sin panel persistente de guía.
- Incidencia operativa con solución manual → ofrecer pasos en conversación, sin ejecuciones automáticas.

## Costos
Medir tokens de entrada/salida, llamadas a herramientas, tiempo y errores mediante métricas sin contenido sensible. Definir topes y alarmas por museo; no prometer tarifa fija por consulta.

## Alcance de este documento
Solo documentación de gobernanza. No altera producción, entorno staging, credenciales, permisos, base de datos, módulos o llamadas al modelo.
