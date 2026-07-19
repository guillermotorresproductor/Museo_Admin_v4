# Arquitectura General de Instituva

En la documentación histórica puede aparecer el nombre Museo_Admin. En este documento se utiliza Instituva como nombre general de la plataforma.

## 1. Propósito de Instituva

Instituva es el sistema administrativo del museo. Su propósito es organizar módulos internos, conservar información operacional del museo y presentar paneles administrativos según las responsabilidades aprobadas para cada área.

El sistema no debe asumir que todos los módulos tienen la misma naturaleza. Algunos módulos administran información propia de Instituva, mientras otros funcionarán como paneles o integraciones con sistemas externos que conservan su propia fuente oficial de información.

## 2. Principio de una sola fuente oficial de información

Cada módulo debe identificar cuál sistema es la fuente oficial de su información.

Cuando Instituva administra información propia, esa información puede vivir en las estructuras operacionales aprobadas para el sistema. Cuando un módulo depende de un sistema externo, Instituva no debe sustituirlo como fuente oficial.

Supabase podrá utilizarse como soporte operacional, caché, snapshots, configuración administrativa o bitácora cuando corresponda, pero no debe reemplazar la fuente oficial de otro sistema.

## 3. Clasificación de módulos

| Módulo | Clasificación actual | Fuente oficial o alcance aprobado |
| --- | --- | --- |
| Recursos Humanos | Módulo propietario | Instituva administra el expediente laboral mediante `employees`, `employees.status`, `employees.access_level`, `work_schedule`, Directorio de empleados y Perfil de empleado. |
| Notificaciones | Módulo administrativo de preferencias | Administra destinatarios y preferencias para futuras alertas. Actualmente no envía notificaciones automáticas ni procesa eventos. |
| Finanzas | Módulo integrador | QuickBooks Online será la fuente oficial financiera. Instituva funcionará como panel de consulta, resumen, monitoreo y exportación administrativa. |

Los módulos todavía no auditados quedan pendientes de evaluación. Su clasificación no debe declararse definitiva hasta completar su auditoría, discusión, aprobación y documentación específica.

### Módulos propietarios

Son módulos donde Instituva conserva y administra información operacional propia del museo. Recursos Humanos queda clasificado como módulo propietario para la versión actual auditada.

### Módulos integradores

Son módulos donde Instituva presenta, resume o administra información relacionada con un sistema externo, sin reemplazarlo como fuente oficial. Finanzas queda clasificado como módulo integrador porque QuickBooks Online será la fuente oficial financiera.

Notificaciones queda documentado como módulo administrativo de preferencias. No es todavía un motor de notificaciones ni una integración activa con sensores o canales externos.

## 4. Responsabilidades generales de Instituva

Instituva debe:

- administrar información operacional propia cuando el módulo haya sido aprobado como propietario;
- conservar configuraciones administrativas aprobadas;
- mostrar paneles, listados, resúmenes y vistas administrativas;
- distinguir información operacional de información oficial mantenida por sistemas externos;
- evitar que prototipos, datos demo o información local se presenten como fuente oficial;
- documentar las decisiones de arquitectura por módulo antes de implementar cambios mayores.

## 5. Responsabilidades de sistemas externos

Los sistemas externos conservan la responsabilidad oficial sobre la información que les pertenece.

QuickBooks Online será la fuente oficial de información financiera y contable. Instituva no reemplazará QuickBooks como sistema contable.

Las futuras fuentes externas de eventos, sensores o canales de entrega de notificaciones no están implementadas ni diseñadas en esta fase. El módulo Notificaciones solo administra preferencias.

## 6. Principios de integración

Las integraciones futuras deben seguir estos principios:

- integraciones mediante backend seguro;
- frontend sin secretos;
- el frontend no se conecta directamente a APIs externas protegidas;
- Supabase puede usarse como soporte, caché, configuración o bitácora cuando corresponda;
- Supabase no debe sustituir la fuente oficial de otro sistema.

Estos principios aplican especialmente al módulo Finanzas, donde toda integración con QuickBooks deberá realizarse mediante un backend seguro y el frontend de Instituva nunca se conectará directamente a la API de QuickBooks.

## 7. Flujo obligatorio de evolución de módulos

El siguiente flujo constituye una regla de gobernanza del proyecto para la evolución de módulos y documentación arquitectónica.

Todo módulo debe evolucionar siguiendo este flujo:

Auditoría
→ Discusión
→ Aprobación
→ Implementación mínima
→ Commit independiente
→ Documento de arquitectura
→ Cierre del módulo

Este flujo busca proteger la estabilidad del sistema, evitar reescrituras innecesarias y mantener trazabilidad clara entre decisiones, cambios y documentación.

## 8. Relación con los documentos específicos de cada módulo

Este documento resume principios generales y no reemplaza los documentos específicos de cada módulo.

Los documentos específicos aprobados son:

- `docs/architecture/05_HUMAN_RESOURCES.md`: define el estado auditado de Recursos Humanos, las mejoras mínimas realizadas y los pendientes para RRHH v2.
- `docs/architecture/06_NOTIFICATIONS.md`: define Notificaciones como configuración administrativa de preferencias, sin motor real de envío ni recepción de sensores.
- `docs/architecture/07_FINANCE_ARCHITECTURE.md`: define la responsabilidad futura entre Instituva y QuickBooks, estableciendo a QuickBooks como fuente oficial financiera.

Cuando exista una duda entre este documento general y un documento específico aprobado, debe revisarse el documento específico del módulo correspondiente y mantener el flujo de auditoría antes de cambiar la implementación.


