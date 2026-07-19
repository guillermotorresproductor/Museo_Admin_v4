# Finanzas y QuickBooks

## Estado
BORRADOR ARQUITECTONICO

## Proposito

Definir responsabilidades futuras entre Museo_Admin y QuickBooks Online antes de implementar cualquier integracion.

Este documento no define OAuth, tablas, endpoints, migraciones ni detalles tecnicos de implementacion.

## 1. Informacion que seguira viviendo en Museo_Admin

Museo_Admin debe conservar informacion operacional y administrativa del museo que no representa contabilidad oficial.

Debe vivir en Museo_Admin:

- usuarios del sistema administrativo;
- permisos internos de acceso al modulo Finanzas;
- configuracion visual del dashboard financiero;
- preferencias de vistas, filtros y reportes internos;
- bitacora administrativa de acciones realizadas dentro de Museo_Admin;
- solicitudes internas que puedan originar actividad financiera, como renta de espacios o eventos;
- estados administrativos propios del museo;
- notas internas no contables;
- archivos o reportes generados para consulta administrativa;
- cache o snapshot temporal de datos financieros consultados desde QuickBooks, si se aprueba en una fase posterior.

Museo_Admin puede visualizar informacion financiera, pero no debe convertirse en el sistema contable oficial.

Supabase podra utilizarse para almacenar cache, snapshots, configuracion administrativa y bitacoras operacionales, pero nunca sera la fuente oficial de la informacion contable.

## 2. Informacion que pertenecera exclusivamente a QuickBooks

QuickBooks Online sera la fuente oficial de informacion financiera y contable.

Debe pertenecer exclusivamente a QuickBooks:

- chart of accounts oficial;
- transacciones contables oficiales;
- ingresos oficiales;
- gastos oficiales;
- facturas;
- recibos;
- pagos;
- clientes contables;
- suplidores;
- reconciliaciones bancarias;
- balances oficiales;
- impuestos y partidas contables oficiales;
- cierres mensuales o anuales;
- reportes oficiales para contabilidad, auditoria o junta;
- nomina oficial, si QuickBooks Payroll o un sistema contable conectado se utiliza para ese proposito.

Museo_Admin no debe duplicar ni sustituir esos registros como fuente oficial.

## 3. Datos que deben sincronizarse

La sincronizacion debe limitarse a datos necesarios para que Museo_Admin pueda visualizar, resumir o relacionar informacion operacional con informacion contable.

Datos candidatos a sincronizacion futura:

- totales por periodo;
- categorias contables resumidas;
- ingresos por fuente;
- gastos por categoria;
- estado de pagos relacionados con solicitudes internas;
- identificadores externos de QuickBooks para conciliacion;
- fechas, importes y descripciones necesarias para mostrar reportes administrativos;
- metadatos de sincronizacion, como fecha de ultima actualizacion y usuario que ejecuto la consulta.

La sincronizacion no debe convertir a Museo_Admin en editor primario de contabilidad.

## 4. Datos que solo deben consultarse

Algunos datos deben consultarse desde QuickBooks solo para lectura y no deben editarse desde Museo_Admin.

Deben ser solo consulta:

- balance neto oficial;
- ingresos oficiales;
- gastos oficiales;
- transacciones cerradas o reconciliadas;
- reportes contables oficiales;
- categorias contables oficiales;
- historial financiero oficial;
- estado de facturas y pagos ya registrados en QuickBooks;
- cualquier dato que afecte libros contables o auditoria.

Museo_Admin puede presentar estos datos en dashboards y reportes, pero no debe alterar su valor oficial.

## 5. Funciones actuales del modulo Finanzas que desapareceran

Cuando QuickBooks sea la fuente oficial, algunas funciones actuales del modulo Finanzas deberan desaparecer o convertirse en vistas de solo lectura.

Deben desaparecer o transformarse:

- edicion manual directa de celdas financieras;
- siembra automatica de plantilla financiera local;
- uso de datos demo como respaldo financiero;
- contrasenas hardcoded del gate financiero;
- clasificacion contable por texto local;
- exportacion hacia QuickBooks como flujo principal;
- calculos financieros paralelos que pretendan reemplazar reportes oficiales;
- valores forzados desde codigo para renglones especificos;
- bitacora local en memoria como evidencia principal de cambios financieros.

Estas funciones pueden haber servido para prototipo, pero no deben permanecer como mecanismo contable definitivo.

## 6. Partes de la interfaz que pueden reutilizarse sin cambios

Algunas partes visuales pueden mantenerse porque son presentacionales y no dependen de ser fuente oficial.

Pueden reutilizarse sin cambios o con ajustes menores de texto:

- estructura general del panel;
- tarjetas KPI;
- navegacion por pestanas;
- estilo visual de tablas;
- estado visual de conexion o sincronizacion;
- botones de imprimir o exportar reportes administrativos;
- layout responsivo;
- estilos generales del modulo;
- convencion visual de resumen financiero.

La interfaz puede mantenerse, pero la fuente de datos debera cambiar en una fase posterior.

## 7. Componentes nuevos necesarios

Para que Museo_Admin funcione correctamente con QuickBooks como fuente oficial, haran falta componentes administrativos nuevos en una fase posterior.

Componentes futuros necesarios:

- indicador claro de fuente de datos oficial;
- vista de ultima sincronizacion;
- estado de conexion con QuickBooks;
- manejo de errores de sincronizacion;
- vistas de conciliacion entre solicitudes internas y registros contables;
- registro de auditoria de consultas o sincronizaciones;
- controles de solo lectura para datos oficiales;
- mecanismo para distinguir datos operacionales de datos contables oficiales;
- filtros administrativos por periodo, categoria, fuente y estado;
- mensajes claros cuando los datos provienen de QuickBooks y no de Museo_Admin.
- Capa de integracion segura entre Museo_Admin y QuickBooks.

Estos componentes deben definirse antes de cualquier integracion real.

Toda integracion con QuickBooks debera realizarse mediante un backend seguro. El frontend de Museo_Admin nunca se conectara directamente a la API de QuickBooks.

## 8. Riesgos durante la migracion

Riesgos principales:

- confundir datos demo o Supabase con datos oficiales;
- mantener edicion manual en Museo_Admin cuando QuickBooks debe mandar;
- duplicar transacciones entre ambos sistemas;
- mostrar balances distintos en diferentes computadoras;
- clasificar mal categorias contables por reglas locales;
- perder trazabilidad entre solicitudes internas y registros QuickBooks;
- permitir acceso financiero a usuarios sin permiso contable real;
- mezclar datos operacionales con datos contables oficiales;
- depender de reportes locales que no coincidan con QuickBooks;
- generar confianza falsa en calculos transicionales.

La migracion debe priorizar claridad de fuente, consistencia de datos y proteccion contra edicion accidental.

## Conclusion

QuickBooks Online debe ser la fuente oficial de contabilidad. Museo_Admin funcionara como un panel de consulta, resumen, monitoreo y exportacion administrativa de la informacion financiera cuya fuente oficial sera QuickBooks.

El modulo Finanzas actual puede aportar estructura visual, pero sus funciones de edicion, datos demo y calculos paralelos deben tratarse como transicionales hasta que exista una integracion formal con QuickBooks.