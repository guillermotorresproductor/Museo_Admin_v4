# Inventario de equipos — Marketing + fotografía móvil

**Estado:** propuesta en PR #82. Sin migración aplicada en Staging ni en Producción.

## Objetivo y alcance

- El perfil compartido `contenido_marketing` puede consultar y **registrar equipos** en cualquier museo de esta instalación.
- Todos los usuarios autorizados a utilizar **Inventario de equipos**, incluidos perfiles con consulta solamente, pueden añadir **una primera fotografía faltante** a un equipo de su museo.
- El formulario de alta y el listado ofrecen **Galería** y **Cámara** como controles de archivo reales. El usuario toca el control; la página no ejecuta `click()` sobre un input oculto. Safari, Chrome y los navegadores móviles reciben `accept` con JPG, PNG, HEIC/HEIF y WebP, y la cámara usa `capture="environment"`.
- Un rol técnico administrador o ejecutivo no concede edición ni archivo a Marketing. Un `allow` explícito de `inventory.manage` sigue vigente; al retirarlo, Marketing vuelve a quedar sin administración. Un `deny` explícito de creación o de fotografía prevalece sobre el perfil.
- La ruta válida es exactamente `{museo}/{equipo}/main.webp`. Una subcarpeta adicional no se puede insertar, reemplazar ni borrar.
- Se conservan JPG, PNG, HEIC/HEIF y WebP admitidos por el navegador, tamaño original máximo de 10 MB y procesamiento a WebP (máximo 500 KB).
- Solo `inventory.manage` permite editar fichas, archivar equipos y reemplazar imágenes existentes.
- No se modifica **Inventario de Colecciones Museográficas**, roles laborales, expedientes, nómina, compensación ni ponches.

## Modelo de permisos

| Permiso | Capacidad | Alcance |
|---|---|---|
| `modules.inventory.read` | Lectura del inventario | Por museo |
| `inventory.create` | Registrar equipo | Perfil `contenido_marketing` y usuarios con `inventory.manage` |
| `inventory.photo.attach` | Adjuntar una primera fotografía faltante | Usuarios con lectura autorizada de Inventario, incluso excepciones individuales; un `deny` individual prevalece |
| `inventory.manage` | Administrar/editar/archivar/reemplazar fotos | No se hereda por el rol técnico cuando el perfil es Marketing. Un `allow` individual previo sí se respeta |

Controles de foto: exactamente dos carpetas, `{museo}/{equipo}/main.webp`, equipo existente y no archivado, foto aún no asociada. La asociación mediante RPC exige que `storage.objects.owner_id` sea el usuario actual. La limpieza de una carga fallida se limita al dueño del archivo todavía sin asociar. La política `UPDATE` no cambia: reemplazar sigue exigiendo `inventory.manage`.

## Validación obligatoria antes del despliegue

1. Confirmar esquema y migraciones de **Staging** (`lonpdmxdvbxuagqxztig`), nunca usar Producción (`kfokfjngozgcwjpzxcsu`) como ambiente de prueba.
2. No usar `supabase db push`. Staging está en `202609300007` y tiene migraciones posteriores de otros módulos sin aplicar.
3. Ejecutar únicamente `supabase/migrations/202610110002_marketing_equipment_inventory_create.sql`. El archivo es idempotente: una segunda ejecución no vuelve a parchear las funciones ya actualizadas.
4. Ejecutar `supabase/tests/employee-module-profiles.sql` dentro de su transacción con `ROLLBACK`; validar que su resultado está totalmente en verde.
5. Iniciar sesión como Marketing: ver Inventario, registrar equipo y adjuntar foto de galería y foto tomada desde celular; verificar que no pueda editar ni archivar aunque su rol técnico sea superior.
6. Iniciar sesión con perfil de consulta del inventario: añadir una foto **faltante** a un artículo preexistente, sin poder reemplazar una foto ya asociada, editar o archivar.
7. Verificar `deny` explícito, `allow` explícito de administración, usuarios inactivos, aislamiento entre dos museos, rechazo de subcarpetas y ausencia de acceso a colecciones.
8. Ejecutar controles de seguridad Supabase (RLS, políticas y funciones) y verificar que los perfiles ajenos al módulo no ganaron acceso.
9. Solo con validación formal se autoriza la fusión de PR y la migración en producción; auditar permiso efectivo tras el despliegue.

## Reversión y control de cambios

- Antes de migrar cada entorno, conservar definiciones previas de `public.has_permission`, `public.inventory_create`, `public.inventory_set_photo`, `public.can_manage_inventory_photo`, y políticas Storage afectadas, además de la matriz de perfiles. El respaldo de Staging previo a esta migración está en el archivo local `museo-pr82-staging-backup-20261011.json`, SHA-256 `5868442CFB66AE8C781825FA9B0AF937C952F235FE4F88400E4D12092A559C9B`.
- Para retirar **solo la entrada nueva de Marketing** en una emergencia: quitar el valor `inventory` del arreglo `employee_module_profiles.modules` de `contenido_marketing`; esto deja intacto su historial laboral y los equipos creados. Hacerlo como migración correctiva auditada.
- La reversión completa de políticas/RPC debe restaurar las definiciones guardadas del entorno, sin tocar registros `inventory_items`, fotografías ya vinculadas ni colecciones museográficas. No usar migraciones automáticas de reversión en producción sin revisión.
- El bloqueo de seguridad que impidió aplicar SQL desde esta conversación **no debe eludirse por otra vía**. Utilizar un proceso de despliegue autorizado.

## Pruebas CI

GitHub Actions: suite específica en `.github/workflows/marketing-equipment-inventory-guard.yml`. Las pruebas de Node verifican código, formulario, permiso mínimo, foto inicial, reemplazo administrativo y limpieza fallida. **Las pruebas CI no sustituyen las pruebas reales de Storage y autenticación en Staging.**


## Corrección posterior a la validación de Staging — 11 octubre

- El archivo `202610110002_marketing_equipment_inventory_create.sql` **ya fue aplicado individualmente en Staging** mediante el CLI, sin registrar una versión nueva en `supabase_migrations.schema_migrations`. No volver a aplicar migraciones en bloque con `db push`.
- Las pruebas transaccionales específicas confirmaron la creación de equipos, la foto inicial, `deny` individual, el control de dueño y el aislamiento por museo. Una comprobación de `inventory.manage` con `allow` individual falló porque ese entorno no tenía la excepción histórica `inventory_individual_allow`.
- Se incorpora **una sola migración correctiva**, `202610110003_marketing_inventory_explicit_manage_allow.sql`. Conserva la denegación de `inventory.manage` para Marketing por defecto y concede administración únicamente si ya existe una fila `allow` individual activa, en el mismo museo. Las comprobaciones previas de perfil activo, `deny` explícito y límite de módulo permanecen intactas. La migración es idempotente y falla sin cambios si el resolutor no coincide.
- **Próximo paso en Staging:** ejecutar solo la migración correctiva mediante el flujo de desarrollo autorizado. Repetir la prueba SQL de `allow` y su revocación dentro de `ROLLBACK`, además de las pruebas aisladas de Inventario. No se requieren cambios en Recursos Humanos.
- **Para un despliegue nuevo:** aplicar `202610110002` y luego `202610110003`, cada una mediante el proceso autorizado, sin arrastrar migraciones antiguas. Registrar la deriva existente entre historial de migraciones y base antes de cualquier `db push` futuro.
