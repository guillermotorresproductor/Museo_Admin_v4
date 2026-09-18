# Recuperación focalizada de Finanzas

Base: `b4a66c6`; punto de recuperación: `recovery/pre-finance-restoration`.

## Causa e inventario

`7cbc469` (PR #25; componentes `71e4d82` y `2828bb9`) sustituyó la pantalla operacional por Presupuesto anual v1, cuyo servicio solo estaba conectado a Instituva Development. Producción mantiene correctamente `institutionalData.enabled=false`. El controlador operacional completo permanecía en `app.js`, desactivado. No se cambia ese indicador ni el destino del backend.

Se recuperan Resumen, Ingresos, Gastos, Nómina presupuestada, Reportes/bitácora y Configuración, con exportación CSV/Excel, impresión/PDF y formatos opcionales de QuickBooks. No se presenta el botón OAuth de QuickBooks como una integración implementada. Se reutilizan la interfaz, los servicios y las clasificaciones existentes. La edición usa el contrato transaccional `update_finance_record_amount` localizado en `f52045f` y staging, ausente de producción.

## Diseño vigente y límites

Los permisos `finance.read`, `finance.write` y `finance.export` permanecen independientes. Se conserva la verificación sensible de acceso existente y las políticas de perfiles de empleados. No se cambian roles, asignaciones, cuentas ni permisos efectivos del administrador. Lectura y escritura requieren el museo actual; el servidor impide cambios directos que eviten la auditoría.

La documentación inicial que describía QuickBooks como sistema oficial queda subordinada al checkpoint de Instituva `INSTITUVA_CHECKPOINT_AREAS_W1_CI_2026-08-02.md` y al diseño posterior de nómina: Instituva es propietario operacional y QuickBooks es opcional. Las columnas Nómina/Beneficios aquí son presupuesto, no aprobación ni ejecución de nómina. No se modifican empleadores, pagadores, etapas de aprobación, versiones aprobadas ni tablas de nómina.

La implementación de presupuesto gobernado en Instituva (`1a223c6`, pruebas `6740a49`) y los vínculos `museo_organization_links` se conservan sin copiar datos ni vincular organizaciones por nombre/correo. No existe un proyecto Instituva Production accesible: esta recuperación usa `finance_records` del Supabase de Museo Production. El controlador v1 permanece separado para un preview explícito; no se conecta producción a Development.

La frontera de datos encontrada es `museum_id` y, en Instituva, `organization_id`. No se encontró una entidad de regiones geográficas: `c09de76`, titulado con “regiones”, renombra secciones KPI. Por tanto se acredita aislamiento entre museos; no se afirma haber probado una jerarquía geográfica inexistente en los esquemas disponibles. No se modifican relaciones organizacionales.

## Reglas y preservación de datos

Se conserva literalmente la plantilla de 54 conceptos, septiembre–agosto, y sus valores predeterminados. Total de ingresos menos todos los gastos, incluyendo Nómina/Beneficios una sola vez. La plantilla suma 746,300.00 de ingresos, 576,790.04 de gastos y 169,509.96 netos. Misceláneos: septiembre 0 y los siguientes once meses 1,500; representación: 0 y 3,000; Director: 4,000 mensuales.

Los importes guardados prevalecen. No se siembran proyecciones, no se reemplazan valores al leer, no se generan exportaciones con transacciones ficticias. Se conserva la exclusión histórica de Contingencia/Ahorros sin eliminar sus registros. Una celda ausente no se inventa. Los duplicados fallan explícitamente. Se corrige la fecha exportada para concordar con los rótulos septiembre–agosto existentes. Los totales de pantalla suman centavos para evitar residuos binarios.

Antes del despliegue: 672 registros de producción, sin identidades duplicadas; digest íntegro `a107aa9575f81dec982ba3a99e318917`. La migración no contiene DML sobre datos financieros.

## Verificación realizada

- Siete pruebas Node: plantilla y valores, datos guardados, nómina/beneficios sin doble conteo, centavos, fechas fiscales, duplicados, exportación/clasificación/resumen y estructura de las seis utilidades. Las doce pruebas existentes de perfiles de empleados también pasaron.
- Staging SQL, transacción revertida: lectura/escritura autorizadas, dos museos, denegación de PATCH directo, lector sin edición, auditoría aislada, anónimo denegado, decimales inválidos y reversión del importe si falla la auditoría.
- Staging Auth/REST real: cuentas y museos desechables sin correos; lectura aislada y respuesta 403 al intentar editar con el lector.
- Navegador, controlador real sobre staging mediante un proxy local de pruebas: seis pestañas, edición 10.10 → 20.10, gasto 3.60, balance 16.50, recarga con nuevo inicio de sesión y bitácora persistente. Campos del lector deshabilitados y exportación oculta; exportación visible tras un permiso explícito en la cuenta de prueba. No se alteró el control sensible de acceso del código publicado.
- Se pulsó CSV sin errores de consola; el navegador automatizado no notificó la descarga. El contenido y los cálculos del generador se verificaron en Node. No se afirma una comprobación del archivo descargado ni del diálogo nativo de impresión.
- Se eliminaron únicamente los registros, cuentas y museos desechables creados para estas pruebas. No se repitieron pruebas de invitaciones.
- Ensayo de migración en producción con ROLLBACK: compatibilidad de esquema, permisos financieros del administrador, lectura de auditoría y digest financiero sin cambios.

La escritura se prueba solamente en staging; la comprobación posterior en producción debe ser de lectura y de integridad, sin introducir importes ficticios.
