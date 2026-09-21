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

## Publicación

Se aplicó y probó la migración en staging. Antes de publicar se ejecuta una transacción de ensayo en producción que compara huellas de doce tablas de datos. La aplicación definitiva usa la misma comprobación y registra la migración. La restitución de Ana se ejecutará después de verificar el despliegue, mediante `assign_employee_module_profile`, con comprobación de identidad, categoría esperada y auditoría. Los resultados finales de despliegue se comunican en la entrega de la tarea.
