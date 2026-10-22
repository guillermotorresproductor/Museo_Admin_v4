# Contrato de implementación — Préstamo permanente (22-oct-2026)

## Decisión de Dirección
**Préstamo permanente** significa custodia museográfica de duración indefinida, **sin transmisión de propiedad**. La titularidad sigue perteneciendo a la persona o entidad prestamista. Una donación es un acto distinto.

Este cambio **no puede implementarse mediante sustitución de rótulos** de la modalidad `donacion_permanente`, porque hoy esa clave transfiere titularidad al Museo al formalizar. Mantener el tratamiento de expedientes anteriores.

## Modelo de datos — aditivo y compatible
- Crear modalidad nueva: `prestamo_permanente`.
- Preservar los valores históricos `prestamo_temporal`, `donacion_permanente`, `catalogacion_directa`; no renombrar claves guardadas, no convertir registros antiguos.
- `ownership_status = 'externa'` durante todo el ciclo, incluyendo la formalización, recepción, devolución y cierre. En `collection_items.details.owner` debe constar el prestamista como titular según el expediente; jamás convertirlo en `Museo` por formalizar o recibir.
- `custody_status = 'pendiente'` antes de recepción física; `museo` después de recepción; `externa` cuando se documente devolución.
- Fecha de inicio/entrega requerida, **sin fecha de devolución estimada obligatoria**. La duración indefinida no equivale a irrevocabilidad.
- Mantener número de inventario, número de ingreso, historial, fotografías y firmas sin alteraciones retroactivas.
- Documento/snapshot inmutable y firmado debe identificar explícitamente modalidad, titular externo, custodia del Museo y condiciones de restitución; las condiciones de duración y terminación requieren texto institucional aprobado.

## Sitios técnicos que requieren cambio coordinado
1. **Interfaz**: `ingreso-articulo.html`, `js/collection-intake.js`, `js/collections.js`, `js/collection-document.js`, `js/services/collections.js`. El nuevo selector no debe enviar la clave de donación.
2. **Validaciones y persistencia**: crear **migración nueva**, nunca editar migraciones aplicadas; extender constraints de `collection_accessions` y RPC de creación y modificación de ingreso; fecha de devolución opcional y titularidad externa.
3. **Firmas/formalización**: validar firma de `propietario` y `director`, jamás `donante`; generar snapshot de préstamo y no ejecutar actualización de propiedad de donación.
4. **Recepción/devolución/cierre**: permitir los estados del préstamo permanente sin devolución fechada de antemano, con trazabilidad de restitución cuando ocurra.
5. **Documentos históricos**: mantener el texto y el hash de contratos de donación ya formalizados, sin modificación retroactiva ni traducción a préstamos.

## Pruebas mínimas antes de publicar
- Crear, guardar, editar borrador, firmar, formalizar y recibir un nuevo `prestamo_permanente` en un entorno autorizado con datos de prueba.
- Confirmar mediante consulta que `ownership_status` continúa externa y que el catálogo **no registra** al Museo como propietario.
- Confirmar fecha esperada de devolución nula, sin errores de validación.
- Verificar la firma de prestamista y Director, digest/snapshot/documento impreso coherentes y bloqueados después de formalización.
- Probar devolución/cierre conservando trazabilidad y titularidad; no alterar ni duplicar inventario.
- Prueba de regresión: préstamo temporal, donación anterior, acceso, inventario y firmas intactos; seguridad/RLS sin ampliaciones.
- Solo promover a producción con pruebas ejecutadas, revisión de contrato por autoridad competente y autorización expresa de Dirección.

## Estado
**Especificación técnica — sin migraciones ni cambios operacionales.**
El PR #96 se mantiene en borrador. Se retiraron del PR los rótulos parciales que inducían a error. No desplegar esta modalidad hasta desarrollar y aprobar su semántica contractual y de datos.
