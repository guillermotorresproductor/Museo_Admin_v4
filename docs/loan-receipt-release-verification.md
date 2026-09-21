# Verificación de préstamo y Museología — 21 de septiembre de 2026

Base `0f982d6`; PR #34, rama `feat/loan-receipt-museology-details`. Se conservaron los árboles de trabajo anteriores y se trabajó en un árbol separado. Se integró el commit remoto concurrente `868af8a` sin sobrescribirlo, incluyendo el selector de Perfil de Empleado, y se consolidó la migración con su nombre `202609210001_museographic_collections_access.sql`.

## Correcciones

- Gerente Museográfica recibe `collections.write` después de validar identidad activa, denegaciones explícitas y pertenencia al módulo del museo. No se modifican roles técnicos ni se conceden capacidades administrativas.
- Una segunda causa estaba en la política permisiva antigua de `app_records`: exigía capacidades administrativas incluso con `collections.write`. La nueva política autoriza únicamente inserción y lectura de préstamos del propio museo; las políticas restrictivas permanecen vigentes.
- El selector RH contiene las diez categorías actuales. Una cuenta antigua muestra «Conservar configuración actual» y guardar sus datos no invoca reasignación, incluso con roles técnicos heredados en conflicto.
- El préstamo conserva titularidad, admite plazo indefinido sin devolución, guarda un expediente completo por UUID, verifica lectura posterior y conserva reintentos sin sobrescritura. Consulta visible antes de imprimir; imágenes decodificadas antes de imprimir, etiquetas agrupadas con fotos y firmas y medidas junto a sus unidades.

## Pruebas

- 39 pruebas locales focalizadas aprobadas: préstamo, rutas de Colecciones, diez categorías, restricciones administrativas y conservación de cuentas antiguas. Un test Playwright opcional permanece omitido por configuración; no se presenta como ejecutado.
- 19 comprobaciones con Auth y PostgREST reales en staging: bases técnicas empleado y ejecutivo, módulos exactos, edición de inventario e historial, fotografía de inventario, préstamo completo temporal e indefinido, reintento idempotente, nueva sesión, recibos anteriores intactos, denegación explícita, aislamiento entre museos y rechazo de cambio de roles.
- Suite SQL en staging: 22 resultados aprobados para diez categorías y dos roles base, RLS, persistencia y límites administrativos. Transacción revertida.
- Navegador con sesión real de staging: menú anterior conservado; enlace interno desde inventario a préstamo; carga y conversión de ambas fotos PNG a JPEG; captura de trazo de firma; guardado y recarga del expediente; imágenes y firma recuperadas del servidor; Recursos Humanos denegado por URL directa.
- Impresión: comprobación visual paginada con Paged.js y CSS real de carta (816 × 1056 px a 96 dpi), fuente 12 pt. Es una comprobación de maquetación, no impresión física ni prueba del diálogo nativo. El navegador integrado no expone dicho diálogo.

Los datos de prueba son ficticios, en museos aislados de staging; al finalizar se desactivan sus identidades y museos, preservando los expedientes y el historial. Ninguna prueba escribe piezas ficticias en producción.

## Publicación confirmada

PR #34 fusionado: `2980df5ae2c6b3766e4564f22a62dbf5d0387220`. Cloudflare Pages informó éxito y se compararon por SHA-256 los seis archivos publicados en mmdpr.org (HTTP 200) con la revisión local: formulario, RH, perfil de empleado, app.js, loan-receipt.js y su CSS.

Migración `202609210001` registrada en staging y producción. El ensayo y la aplicación conservaron las huellas de las once tablas de datos presentes de las doce previstas; producción no tiene `public.user_roles`. Se conservaron cuentas Auth, perfiles, empleados, permisos, recibos, piezas, fotos, historial, Finanzas, museos y metadatos de almacenamiento.

Después de verificar el despliegue, Ana fue restituida de Gerente Administrativo a Gerente Museográfica usando `assign_employee_module_profile`, con comprobación de la identidad vinculada, categoría esperada y auditoría. La operación se ejecutó como mantenimiento autorizado a través de Management API con el contexto del administrador existente; no fue una sesión de Ana. Una consulta independiente posterior confirmó las seis entradas de módulos anteriores, escritura de inventario y préstamos y ausencia de `roles.assign`, `system.configure` y `finance.write`. El rol técnico ejecutivo y los otros datos permanecieron idénticos. Se generó una sola auditoría de restitución.

Las identidades y museos ficticios usados en staging se desactivaron; no se borraron expedientes.
