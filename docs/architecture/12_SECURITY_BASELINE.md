# Security Baseline

## Estado

BORRADOR APROBADO PARA REVISIÓN

## Objetivo

Definir la línea base de seguridad para Instituva antes de implementar autenticación, multi-organización e integraciones operacionales.

## Separación por organization_id

Cada registro operacional pertenecerá a una organización mediante `organization_id` o una relación equivalente aprobada. Esta separación será parte del modelo de seguridad y no dependerá de ocultar elementos en la interfaz.

## Row Level Security

Las políticas de seguridad de datos deberán imponer la separación por organización. El frontend podrá adaptar la experiencia visual, pero la autorización efectiva deberá residir en la base de datos, funciones seguras o backend autorizado.

## Autenticación

La autenticación deberá identificar a la cuenta de acceso y permitir resolver la identidad institucional correspondiente. Persona, empleado, identidad y cuenta de acceso se mantendrán como conceptos separados.

## Roles globales y organizacionales

Instituva tendrá roles globales limitados para operación de la plataforma, comenzando solo con:

- `platform_owner`
- `platform_support`

Los roles internos de cada organización estarán separados de los roles globales de Instituva.

## Edge Functions

Las acciones sensibles deberán ejecutarse mediante funciones seguras o servicios de backend equivalentes. Estas acciones incluyen invitaciones, cambios de acceso, administración de roles sensibles, desactivaciones, decisiones auditables y futuras integraciones protegidas.

## Auditoría

Toda acción relevante deberá poder atribuirse a una identidad. Las acciones de soporte, administración, aprobación, corrección y configuración deberán conservar trazabilidad suficiente para revisión posterior.

## Manejo de secretos

Los secretos administrativos, claves privadas, credenciales de servicios, claves de servidor y credenciales de integraciones externas no deben existir en el frontend ni en el repositorio.

Las claves publicables solo podrán utilizarse bajo políticas de mínimo privilegio y con protecciones de servidor apropiadas.

## Datos sensibles

Los datos sensibles deberán limitarse a las personas y procesos autorizados. Su acceso, modificación y visualización deberán quedar protegidos por autorización efectiva y auditoría.

## Política segura de caché futura

La caché futura deberá respetar organización, identidad, permisos, sensibilidad de datos y expiración. No deberá permitir que información de una organización o usuario quede disponible para otro.

## Acceso de soporte de INSTITUVA

El acceso de soporte de Instituva deberá ser limitado, autorizado y auditado. `platform_support` no tendrá acceso automático a información sensible de una organización.

Cualquier acceso excepcional deberá quedar asociado a una justificación, una identidad responsable y una ventana operacional controlada.

## Principio de mínimo privilegio

Cada identidad, cuenta, rol, función e integración recibirá solamente el nivel de autoridad necesario para completar su responsabilidad aprobada.

La interfaz podrá simplificar la experiencia, pero no sustituirá los controles de autorización efectivos.

## Restricciones

- No almacenar secretos en Git.
- No depender de `localStorage` como autoridad de permisos.
- No usar botones ocultos como mecanismo de seguridad.
- No permitir acceso entre organizaciones sin autorización explícita.
- No conectar el frontend directamente a APIs externas protegidas.