# Recuperación del Inventario de Colecciones — revisión, sin publicar

Base: `061f99994f2b7cebd52835d520858c25bc816d47` (PR #32 de RH publicado).
Rama: `feat/collections-catalog-recovery`. Producción: mmdpr.org / instituva-app /
Supabase `kfokfjngozgcwjpzxcsu`. Pruebas exclusivamente contra Staging
`lonpdmxdvbxuagqxztig`, con frontend local y cuentas ficticias.

## Arqueología y reutilización

Se consultaron todas las ramas locales/remotas de Museo_Admin_v4 e Instituva_App,
actualizando las referencias sin cambiar sus checkouts. También se inspeccionaron
las copias de C:/DEV: Museo_Admin_v4, Museo_Admin_v4_mmdpr_phase1,
Museo_Admin_v4_repo, Museo_Admin_v4_publicar/Museo_Admin_v4 e Instituva_App,
y los worktrees locales de ambos proyectos. No se modificaron esas copias.

| Evidencia recuperada | Decisión |
| --- | --- |
| `02_COLLECTIONS_ARCHITECTURE.md`, `04_COLLECTIONS_LIFECYCLE.md`, sección 9 del MASTER_SPEC | Expediente único, titularidad/adquisición/custodia separadas, FMV, fotos, QR e historial; sin borrado patrimonial |
| `33f6fbc^:inventario.html`, separación en `33f6fbc` | Recuperar los conceptos y campos museográficos del antiguo modo Obra de Arte, no la pantalla mixta ni el almacenamiento de equipos |
| `01e709d`, `d744de6`, `fdde061`, `aa2f843`, `4efe79c`, `a5c3509` y rama local de integración de préstamos | Existe trabajo histórico de formulario/expediente de préstamo y navegación; no es un catálogo persistente de piezas listo para activar |
| `colecciones-museograficas.html`, `departamento-museologico.html`, `recibo-prestamo.html`, `documentos.html`, `bindLoanReceiptForm` actuales | Conservar la jerarquía y el formulario vigente; añadir acceso al catálogo, sin sustituir el préstamo por una versión histórica |
| `app_records`, `fetchSystemCollection` / `saveSystemCollection` | Conservarlos. No usarlos para reemplazar arrays completos de piezas, por riesgo de sobrescritura concurrente y ausencia de historial por pieza |
| Inventario relacional de equipos y sus correcciones de fotos | Reutilizar el patrón de sesión/RPC/permisos, aislamiento por museo y fotos privadas; no reutilizar su tabla o bucket |
| Instituva_App, incluyendo origin/main `a4aae01` | Arquitectura, categorías de personal y casos ejecutivos relacionados; no se encontró implementación de catálogo de Colecciones en las ramas y copias examinadas |

La consulta de solo lectura de Producción para módulos de app_records cuyos
nombres contienen invent/prest/colec no devolvió filas. Eso no autoriza borrar ni
importar información desde otras copias o ubicaciones. No se extraen registros
reales ni se copian a Staging.

## Qué faltaba y qué se implementa

- `inventario-colecciones.html`: registrar, buscar, consultar y editar piezas.
  Número único por museo; descripción, clasificación, autor, época, materiales,
  dimensiones, procedencia, titularidad, ingreso/adquisición, custodia, donante,
  prestamista, fecha, ubicación, condición, FMV, moneda y referencia documental.
- Tablas independientes `collection_items`, `collection_history`, `collection_photos`.
  Escritura solo mediante RPCs con autorización, versión esperada y motivo obligatorio.
  Cambio e historial se confirman en la misma transacción.
- Historial permanente con fecha, actor y su nombre, motivo y valores anteriores/nuevos.
  Sin botones, permisos ni RPC de borrado. Triggers rechazan borrados de piezas y
  modificaciones/borrados de historial y referencias fotográficas.
- Bucket privado `collection-photos`: fotos JPG/PNG/WEBP de hasta 10 MB, nombre
  único por fotografía, sin upsert ni eliminación desde el cliente; se conservan
  imágenes anteriores. URL firmada para consulta autorizada y renovación al abrir.
- QR generado localmente (qrcode-generator 1.4.4, MIT) hacia el expediente autenticado.
  Se conserva solo el ID de retorno durante login, no datos de piezas en localStorage.
- Las lecturas de catálogo, fotos e historial son paginadas. La edición concurrente
  retorna conflicto, sin sobrescribir el trabajo de otra persona.

No se implementa automáticamente todo el ciclo institucional de donación,
adquisición, préstamo externo, devolución, baja o cierre. Esta entrega permite
catalogación y documentación; no convierte un ingreso o préstamo en propiedad.
Los estados disponibles son ingreso, catalogada, conservación y restauración.
La referencia de préstamo es documental: no crea ni modifica préstamos existentes.

El formulario vigente de préstamo conserva su comportamiento anterior: persiste
su resumen en app_records y prepara correo mediante mailto. Su implementación
actual no guarda todos los campos como un expediente relacional completo. El
trabajo formal encontrado en la rama histórica queda identificado, no publicado
ni trasladado automáticamente como parte de este correctivo.

## Permisos y persona encargada

Nuevos permisos en el catálogo existente, sin elevar roles:

- `collections.read`: consultar piezas, fotos e historial.
- `collections.write`: registrar/editar y añadir fotos; incluye consulta del catálogo.

La migración **no concede permisos a ninguna persona ni cambia roles existentes**.
Ni `inventory.manage` ni ser Administrador habilitan implícitamente este catálogo.
Se usa `has_permission` vigente, con perfil activo y museo asociado, además de RLS.
Las concesiones/revocaciones individuales siguen en `user_permissions` existente.

Se solicitó la identidad de la persona que catalogará; todavía no fue indicada.
Antes de habilitar su uso real hay que identificar su cuenta/perfil/museo y revisar
sus permisos efectivos. Si requiere escritura, una concesión explícita de
`collections.write` es suficiente; no necesita Administrador, RH ni Finanzas.
No se ha modificado ninguna cuenta real.

## Validación acreditada

- Migración `202609170001_collections_catalog` aplicada y registrada solo en Staging.
- 23 comprobaciones HTTP usando el servicio de frontend real: creación, lectura
  desde un segundo login, edición/versiones, número duplicado, denegación de lector,
  aislamiento entre museos, escritura directa rechazada, anonimato rechazado,
  dos fotos conservadas y recuperadas byte a byte, sobrescritura/borrado de fotos
  impedidos, historial e intento de manipulación rechazado, revocación de permisos.
- Cuenta probada: rol Empleado, únicamente `collections.write` para catalogar;
  comprobación expresa de ausencia de `system.configure`.
- Navegador con identidad ficticia: acceso a Colecciones y al catálogo, registro
  de una maraca ficticia, recarga, edición de ubicación con motivo, subida de PNG,
  consulta de fotografía y tres eventos históricos, reapertura desde enlace permanente.
  Navegación Departamento → Colecciones → formulario de préstamo comprobada sin enviar.
- 4 pruebas de navegación/autorización y retorno de enlace por login aprobadas.
- 18 pruebas de wiring de acceso aprobadas porque este PR modifica los controles
  de navegación compartidos. No se repitió el ciclo funcional de RH en servidores.
- Los fixtures se conservan en museos exclusivos de pruebas: sin borrarlos ni
  mezclarlos con registros del museo. El runner desactiva solo sus propios perfiles
  y museos ficticios al concluir. No envía invitaciones ni correos.
  La revisión visual terminó con los tres perfiles y ambos museos ficticios
  desactivados mediante una actualización acotada al identificador de esa prueba;
  el terminal no admitió Enter. El runner ahora exige terminal interactivo en modo UI.

Comandos reproducibles: `node --test supabase/tests/collections-navigation.test.mjs`,
`node --test supabase/tests/employee-access-wiring.test.mjs` y
`scripts/test-collections-staging.ps1 [-UI]`. El runner fija la URL de Staging y
rechaza cualquier otro proyecto. Secretos solo en memoria del proceso; el servidor
de revisión escucha exclusivamente en 127.0.0.1 y sirve un acceso de un solo uso.

## Preservación y publicación posterior

El diff no modifica las tablas/buckets/RPC de Equipos, RH o préstamos ni el código
de servicios de RH. No importa app_records, no sustituye registros, no elimina
piezas ni fotografías. Las políticas restrictivas de Storage solo afectan el
nuevo bucket; los buckets existentes quedan fuera de sus restricciones.

Publicación prohibida hasta revisión y autorización. El commit de la rama usa
`[CF-Pages-Skip]` y el PR se abre en borrador; no se fusiona main ni se ejecuta un
workflow manual. La configuración de hosting permanece igual.

Para una publicación futura: revisar el respaldo reciente, verificar el main
vigente, aplicar solo la migración nueva, registrar su versión, desplegar el
frontend aprobado y comprobar la cuenta de catalogación con permisos explícitos.
No se requieren nuevas Edge Functions. No activar scripts de fixtures en Producción.

Reversión: volver al código frontend previo y conservar todas las tablas nuevas,
su historial y Storage. No ejecutar DROP, restauraciones antiguas ni migraciones
inversas que borren piezas ya registradas. Si se detecta un problema de seguridad,
suspender el permiso específico de escritura mediante una acción autorizada y
corregirlo manteniendo los expedientes existentes.

Limitaciones operativas: una foto subida cuyo adjunto falle por conflicto se
conserva como objeto pendiente; no se elimina automáticamente ni reemplaza otra.
La interfaz avisa si la ficha ya se guardó y falló el paso posterior. No se debe
crear otra pieza por ese mensaje; hay que reabrir la existente.
