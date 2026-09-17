# Revisión previa a publicación: expediente RH sin cuenta

**Solo revisión. No fusionar, desplegar ni ejecutar migraciones sin autorización
posterior. mmdpr.org y su Supabase contienen datos reales.**

## Identidad y destinos comprobados

| Elemento | Evidencia |
| --- | --- |
| Repositorio | `https://github.com/guillermotorresproductor/Museo_Admin_v4.git` (origin fetch/push; API GitHub confirma repositorio público) |
| Ruta local | `C:\Users\guill\OneDrive\Desktop\WEB ADMINISTRACION\CODIGOS\Museo_Admin_v4\_hr_corrective` |
| Rama del PR | `fix/hr-unlinked-employee-draft` |
| Base y main remoto al revisar | `2a33ef411035374644a93ee529fa782e310f9ecf` |
| Correctivo | `860e06d17171e32cc816a1edb0ea7f844b53d3c2` |
| Prueba visual y evidencia | `120ebd40ceebc0047c7927f0c3338a94f2807b36` |
| Alojamiento objetivo | Cloudflare Pages `instituva-app`, dominio de Producción `mmdpr.org` |
| Supabase Producción | `kfokfjngozgcwjpzxcsu` |
| Staging, separado | `lonpdmxdvbxuagqxztig`; no se copiará su base a Producción |

GitHub registra el check exitoso **Cloudflare Pages: instituva-app** del commit
base y enlaza el despliegue
[`0f18e73a-6d23-4394-bb1d-aea7c2081418`](https://dash.cloudflare.com/?to=/c4343d13a0f6cb061346bacc73fe61cb/pages/view/instituva-app/0f18e73a-6d23-4394-bb1d-aea7c2081418).
La integración también tiene `instituva-museo-demo`; no confundir sus destinos.

Se compararon por HTTP los scripts de `mmdpr.org`,
`0f18e73a.instituva-app.pages.dev` y `git show 2a33ef4:<archivo>`: coinciden los
tres, normalizando CRLF y salto final. SHA-256 del contenido normalizado:

| Archivo | SHA-256 |
| --- | --- |
| js/app.js | `8C39B547900EA9842CB63A2168BB15EE16E671334D65FE8C26B2327584E0ECC6` |
| js/services/supabase.js | `604A886C4CD2BFE4EF39DBFC612D5B154DE7DDC412D7DC6C9759879C7E8F78CF` |
| js/config.js | `508D729A83B38458D076442FA9563451E37EA7E50CC4A6104F5003D7A93736E2` |

Esto acredita repositorio, proyecto Pages y contenido publicado. Por instrucción del usuario del 17 de septiembre, esta evidencia es la base de verificación del destino y no se exige acceso al panel como requisito para publicar. **La asociación
administrativa del dominio personalizado y la configuración de ramas de
Cloudflare no se han inspeccionado aún: el panel solicita iniciar sesión.** No
se presenta la coincidencia de contenido como sustituto de esa comprobación.
`js/config.js` fija `mmdpr.org` a Producción y su Supabase indicado arriba.

Existe además `.github/workflows/pages.yml`: publica GitHub Pages solo en push
a `main` o ejecución manual. La API Pages indica `cname:null`, destino
`guillermotorresproductor.github.io/Museo_Admin_v4/`; no confundir este hosting
paralelo con el dominio Cloudflare. Este PR no cambia workflows ni config.

## Subida del PR sin despliegue

Se mantiene intacta la historia de los dos commits solicitados y se añade este
informe y el rollback en un commit final cuyo mensaje comienza con
`[CF-Pages-Skip]`. Cloudflare documenta ese prefijo para omitir el despliegue de
un push: [documentación oficial](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message).
El único ref a subir es `refs/heads/fix/hr-unlinked-employee-draft`. No se empuja
`main`, no se ejecuta ningún workflow manual y el PR se abre como borrador.
No se desactiva permanentemente ninguna integración o control de seguridad.

## Inventario de cambios del PR

| Archivos | Alcance |
| --- | --- |
| `js/app.js` | RH y Ver perfil admiten nivel solicitado NULL, mantienen la verificación, muestran requisitos de invitación y refrescan el estado después de guardar |
| `js/services/supabase.js` | No disfraza NULL como Empleado; correo vacío como NULL; conserva código/estado de los errores HTTP |
| `recursos-humanos.html`, `perfil-empleado.html` | Opción Sin nivel solicitado, ayudas, correo no obligatorio para guardar expediente y versión de scripts |
| `supabase/functions/_shared/employee-access.ts` | Lectura de expediente sin nivel y consulta de estado de invitación con verificación de identidad, duplicados e intentos previos |
| `supabase/functions/assign-sensitive-role/index.ts` | Separa nivel solicitado/efectivo y permite pasar al RPC un expediente sin correo/perfil; conserva validación de vínculo para perfiles vinculados y autorización |
| `supabase/functions/employee-access/index.ts` | Acción status usa la nueva consulta; acciones de recuperación/reactivación conservan su resolutor anterior |
| `supabase/migrations/202609160001_employee_draft_fields.sql` | DROP NOT NULL en email y access_level de employees; ambos ya son nullable en Producción |
| `supabase/migrations/202609160002_unset_employee_level.sql` | CREATE OR REPLACE del RPC existente: expected NULL solo para expediente sin nivel/perfil, conflicto nuevo PT409; mismos bloqueos, auditoría y ACL |
| `supabase/tests/employee-access-wiring.test.mjs`, `employee-photo-level.test.mjs`, `unlinked-employee.test.mjs` | Regresiones focalizadas y pruebas del guardado/panel |
| `supabase/tests/unlinked-employee-staging.mjs` | Integración exclusivamente Staging, con fixture propio y limpieza por sus IDs |
| `scripts/test-unlinked-employee-staging.ps1`, `scripts/review-unlinked-employee-staging.mjs` | Ejecución Staging y revisión visual local con identidad sintética, sin enviar invitaciones |
| `docs/HR_UNLINKED_EMPLOYEE_CORRECTIVE_20260916.md` | Causa, respuestas reales, evidencia de Producción y Staging, limitaciones |
| `docs/HR_RELEASE_REVIEW_20260916.md` | Este inventario, destinos, respaldo y procedimiento de reversión |
| `docs/rollback/20260916_restore_employee_level_function.sql` | Definición anterior capturada de Producción mediante transacción READ ONLY; archivo de reversión manual, no autoejecutable |

**No hay borrado, truncado, reinicio, reemplazo de datos ni importación de Staging
en las migraciones.** El DROP NOT NULL elimina una restricción, no columnas ni
contenido. CREATE OR REPLACE sustituye código y no ejecuta el cuerpo del RPC.

Hay dos usos de DELETE que deben explicitarse, no ocultarse:

1. El RPC conserva el DELETE de asignaciones técnicas anteriores que ya existía
   antes de este PR; ocurre únicamente al llamar explícitamente al cambio de
   nivel autorizado y transaccional. No se ejecuta al aplicar la migración.
2. Los ejecutores de pruebas borran únicamente sus fixtures sintéticos de
   Staging, con URL fija y IDs propios. No se ejecutan en Producción.

No hay nuevas políticas RLS, buckets, roles, grants individuales ni cambios de
Auth. No cambia `invite-employee`, `_shared/security.ts`, `js/config.js`, las
políticas de fotos ni los permisos de módulos. El owner del RPC es `postgres`;
ACL leída: `{postgres=X/postgres,authenticated=X/postgres}`. Las declaraciones
de owner/REVOKE/GRANT de la migración conservan esa ACL y no conceden nuevos
permisos a usuarios.

Versiones actuales consultadas en Producción, sin desplegar:

| Función | Versión | verify_jwt |
| --- | --- | --- |
| assign-sensitive-role | 2 | false (autenticación/permiso internos ya existentes) |
| employee-access | 1 | true |
| invite-employee | 7 | true; no requiere despliegue por este PR |

## Respaldo disponible: comprobación inicial y límites históricos

Esta comprobación inicial se complementa con el respaldo local y ensayo descritos al final; las carencias de copia de fotos y ensayo indicadas aquí quedaron resueltas dentro del alcance allí documentado.

Lectura con `supabase backups list --project-ref kfokfjngozgcwjpzxcsu --output json`
el 16 de septiembre de 2026:

- Backup físico más reciente: **1691571715**, **COMPLETED**, creado
  **2026-09-16T06:37:31.854Z**.
- Otros siete backups físicos COMPLETED: del 9 al 15 de septiembre.
- `walg_enabled:true`, región `us-east-1`; **`pitr_enabled:false`**.
- La API confirma disponibilidad y estado; **no se ejecutó una restauración de
  ensayo ni se certifica una restauración completa probada** durante esta revisión.
- Consultar de nuevo justo antes de cualquier migración: no tratar una lista
  histórica como garantía de disponibilidad futura ni de cobertura de cambios
  posteriores a las 06:37 UTC.

Los backups de base de datos **no incluyen los archivos de Supabase Storage**,
solo sus metadatos. No se ha acreditado un respaldo independiente recuperable
de objetos/fotos. Esta limitación y la ausencia de una restauración probada deben
resolverse/aceptarse expresamente antes de autorizar una migración con requisitos
de recuperación completa. No se habilita PITR ni se contrata ningún servicio.
Fuente: [Backups de Supabase](https://supabase.com/docs/guides/platform/backups).

No se descargaron expedientes, contraseñas, fotos ni dumps de datos al repositorio.
El archivo de rollback contiene exclusivamente la definición SQL de una función.

## Reversión que conserva información

Esta revisión no requiere rollback remoto: todavía no hay despliegue del
correctivo en Producción. Para una eventual publicación aprobada:

1. Registrar antes los IDs de los despliegues activos, hash del frontend,
   versiones/opciones JWT de las Edge Functions, definición/ACL del RPC y estado
   de migraciones. Revalidar el respaldo reciente. Si la definición del RPC
   cambió desde esta captura, obtener una nueva antes de migrar.
2. Si el correctivo falla, revertir **código**, no los datos: volver al frontend
   del commit `2a33ef4` o al despliegue Pages anterior registrado, y redesplegar
   las versiones de código previas de las dos funciones conservando sus JWT.
   No tocar `invite-employee` ni la configuración de Supabase/Cloudflare.
3. Solo si también es necesario revertir el RPC, revisar y ejecutar por separado
   [el SQL capturado](rollback/20260916_restore_employee_level_function.sql).
   Usa CREATE OR REPLACE en una transacción: conserva la misma función, su ACL,
   los expedientes, perfiles, auditorías y decisiones de nivel ya guardadas.
   SHA-256 del archivo capturado:
   `B154C08B50078C53721377DE68ADCE7927223B346A0030B7221D3DCC097DF119`.
4. **No reinstalar NOT NULL**: el estado original de Producción ya permite NULL.
   Tampoco rellenar NULLs, borrar expedientes o restablecer roles para que un
   rollback pase. Corregir el registro de migraciones mediante una migración
   compensatoria revisada, sin reset ni reaplicación masiva de historial.
5. Verificar en lectura los mismos IDs, referencias de fotos, permisos y
   auditorías tras la reversión. No enviar correos ni crear registros de prueba
   en Producción. El frontend anterior volvería a mostrar el defecto de los
   expedientes incompletos: el rollback conserva datos, no soluciona ese defecto.

**No restaurar directamente un backup antiguo sobre Producción como rollback
ordinario**: perdería operaciones legítimas posteriores al backup. Si ocurriera
daño de datos, detenerse y acordar una recuperación específica: restaurar en un
entorno aislado autorizado, comparar con el estado actual y recuperar solo los
datos afectados preservando las operaciones posteriores. La restauración tiene
indisponibilidad y no recupera objetos de Storage eliminados. No se ha ejecutado
ninguno de esos pasos ni se presume autorizado.

## Validación ya acreditada

45 pruebas locales focalizadas y ciclo HTTP/visual de expediente sin cuenta en
Staging. Reproducción del error de Roberto con sesión de Guillermo en Producción,
sin guardar; el HAR/cuerpo HTTP bruto de Producción no se exportó. Consultar el
[informe de evidencia](HR_UNLINKED_EMPLOYEE_CORRECTIVE_20260916.md).
No se repiten pruebas de fotos, seguridad o datos reales durante esta revisión.

## Actualización: respaldo local y recuperación comprobada

El 16 de septiembre se creó una copia privada fuera del repositorio y de
OneDrive, en `C:\Users\guill\Museo_Backups\production-20260916-224524`.
La carpeta raíz tiene herencia de permisos deshabilitada y acceso limitado al
usuario actual de Windows y SYSTEM. Los datos, fotografías, credenciales locales
y registros de recuperación no se incorporan a este PR.

- `database.dump`: pg_dump 17.11, formato custom, 7.177.706 bytes; SHA-256
  `F1367757490A0A88BA63A5482845DAE02E10A804EABF29B7977E19871AD315D1`.
  Incluye esquema y datos; se pudo listar y extraer íntegramente sin errores.
- Recuperación en PostgreSQL local aislado, solo `127.0.0.1:55439`, con contraseña:
  64 tablas y 2.147 filas de `public`, `auth`, `storage` y `supabase_migrations`.
  Se compararon todas las filas COPY, ordenadas dentro de cada tabla, con el dump
  original: igualdad completa, además de conteos coincidentes. Ambas exportaciones
  usan UTC; la primera diferencia detectada era únicamente la zona horaria local.
- Storage: 20 archivos, 4.976.031 bytes. Tamaños y SHA-256 verificados al descargar
  y al recuperar una copia local; imágenes decodificables: 1 PNG y 19 WEBP.
  El inventario de objetos/buckets y referencias permaneció estable durante la
  descarga. También se preservó, decodificó y verificó una foto inline de employees.
- El dump también contiene `legacy.inventory_items_pre_v1` (0 filas),
  `realtime.schema_migrations` (82), `realtime.subscription` (0) y `vault.secrets`
  (0). Estas cuatro tablas están en el archivo y en su extracción íntegra,
  pero no se cargaron en el ensayo de recuperación de datos de aplicación.
- El servidor local quedó detenido. No se escribieron datos de aplicación en
  Producción ni Staging, no se restauraron backups antiguos, no hubo invitaciones,
  migraciones, despliegues ni repetición de las pruebas funcionales acreditadas.

**Alcance preciso:** se comprobó recuperación de datos de aplicación y archivos,
no la puesta en marcha completa de Supabase. El ensayo local omite RLS, triggers,
funciones, propietarios/ACL y servicios administrados; sus definiciones incluidas
en el dump requieren un entorno Supabase compatible y revisión para recuperarse
operativamente. No usar `pg_restore` a ciegas contra Producción.

El paquete privado de respaldo conserva el dump, objetos, inventario y referencias
de fotos, manifiestos, comprobaciones y guía. Para comprobarlo sin tocar servidores:
extraer en otra carpeta privada y cotejar `SHA256SUMS.json`. La guía de recuperación
local y la evidencia detallada permanecen junto al respaldo privado.

**Estado al 17 de septiembre:** el usuario acepta verificar el destino mediante
la evidencia ya obtenida y no requiere acceso al panel de Cloudflare. El check de
GitHub para instituva-app, el ID de despliegue y la igualdad de scripts con
mmdpr.org acreditan el destino operativo; no se afirma haber inspeccionado la
configuración administrativa de dominios o ramas. No se cambiará esa configuración.
La segunda copia externa queda aplazada por decisión expresa del usuario.

Paquete privado final: `production-recovery.zip`, 29 archivos, 11.919.888 bytes;
SHA-256 `ddad278caf10575abcc82c1d7d77a14c115a1d4f2bcd9eaf08be038968e4fecb`.
Se verificaron el ZIP y todos sus archivos contra el manifiesto. El paquete permanece
local, fuera del repositorio. No se hace ninguna nueva restauración en esta etapa.

PR #32 sin conflictos contra main `2a33ef4`; las pruebas funcionales aprobadas no
se repiten. La documentación se actualiza con `[CF-Pages-Skip]`, sin despliegue.
Se mantiene el PR en borrador para evitar confundir preparación con autorización.
**Único impedimento de autorización para publicar: falta la aprobación explícita
posterior del usuario.** Antes de ejecutarla, comprobar que main y el estado de
Producción siguen siendo los revisados; una deriva real requeriría evaluación.
