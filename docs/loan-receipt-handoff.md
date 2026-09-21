# Formulario de préstamo museológico

Rama: `feat/loan-receipt-museology-details`.
Base revisada: `0f982d6` de `main`.

Guillermo confirmó el 21 de septiembre de 2026 que la pieza sigue perteneciendo al propietario. El formulario ofrece préstamo temporal o por tiempo indefinido y declara expresamente que no hay transferencia de propiedad. No se incorporó la redacción contradictoria de donación del borrador de Ana.

Se incorporaron categorías, autor/artista/intérprete, período, materiales, procedencia, dos fotografías, medidas y unidades, conservación, propósitos, firmas opcionales y uso interno. La impresión sustituye el enlace a la plantilla Word antigua; ese archivo permanece intacto en el repositorio.

El formulario anterior guardaba solo un resumen compartido y abría un correo. La nueva versión guarda un expediente completo por clave UUID en `app_records`, módulo `recibos_prestamo`, bajo las políticas existentes del museo. No modifica el registro legado `receipts`, otros módulos, permisos ni esquemas. Cada reintento conserva la clave y el contenido del envío; usa inserción sin sobrescritura y lectura posterior para confirmar persistencia. El listado muestra expedientes nuevos y resúmenes antiguos.

Las fotos se convierten en copias JPEG de hasta 1600 píxeles, con límite de 1.5 millones de caracteres por foto; los originales deben conservarse aparte. Fotos y trazos de firmas quedan dentro del JSON protegido de cada expediente. Las firmas son trazos opcionales, sin atribuirles identidad verificada o certificación electrónica. No hay envío automático de correo. El formulario no crea automáticamente piezas en `collection_items`; el número y estado de registro de inventario siguen siendo datos declarados por Museología.

## Verificación realizada

- `node --check js/loan-receipt.js` y `node --check js/app.js`.
- `node --test supabase/tests/loan-receipt.test.mjs`: cuatro pruebas pasaron; una prueba de navegador queda pendiente.
- Validación de fechas, categoría Otros y propósitos; comparación independiente del orden JSONB; guardado por expediente, fallo de lectura posterior, reintento sin duplicación y rechazo de escritura.
- IDs únicos, etiquetas HTML y `git diff --check`.

## Pendiente antes de producción

- La prueba visual no pudo ejecutarse aquí: falta Chromium y su descarga devolvió HTTP 502. La prueba de navegador está preparada para `LOAN_BROWSER_TEST=1 node --test supabase/tests/loan-receipt.test.mjs` en un entorno con Playwright y Chromium.
- Ejecutar la prueba visual, incluyendo captura de firmas, ambas fotos, devolución temporal/indefinida, recarga del listado e impresión carta.
- Confirmar guardado y lectura con una sesión autorizada de staging, incluidas las políticas ya desplegadas de `app_records`. No se han utilizado credenciales ni escrito datos reales.
- `collections-navigation.test.mjs` ya está desactualizado respecto de la función de permisos: cuatro casos fallan por el mock ausente `hasModuleProfile`. Los helpers de permisos son idénticos a la base; este PR no los modifica.
- No se ha fusionado ni desplegado en mmdpr.org. Continuar desde esta rama, comparando el estado del Codex local antes de editar.
