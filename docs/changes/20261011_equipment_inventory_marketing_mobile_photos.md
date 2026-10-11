# Inventario de equipos — Marketing + fotografía móvil

**Estado:** propuesta en PR #82. Sin migración aplicada en Staging ni en Producción.

## Objetivo y alcance

- El perfil compartido `contenido_marketing` puede consultar y **registrar equipos** en cualquier museo de esta instalación.
- Todos los usuarios autorizados a utilizar **Inventario de equipos**, incluidos perfiles con consulta solamente, pueden añadir **una primera fotografía faltante** a un equipo de su museo.
- El formulario de alta y el listado admiten selección de fotografías del celular y captura directa con cámara trasera.
- Se conservan JPG, PNG, HEIC/HEIF y WebP admitidos por el navegador, tamaño original máximo de 10 MB y procesamiento a WebP (máximo 500 KB).
- Solo `inventory.manage` permite editar fichas, archivar equipos y reemplazar imágenes existentes.
- No se modifica **Inventario de Colecciones Museográficas**, roles laborales, expedientes, nómina, compensación ni ponches.

## Modelo de permisos

| Permiso | Capacidad | Alcance |
|---|---|---|
| `modules.inventory.read` | Lectura del inventario | Por museo |
| `inventory.create` | Registrar equipo | Perfil `contenido_marketing` y usuarios con `inventory.manage` |
| `inventory.photo.attach` | Adjuntar una primera fotografía faltante | Usuarios con lectura autorizada de Inventario, incluso excepciones individuales; un `deny` individual prevalece |
| `inventory.manage` | Administrar/editar/archivar/reemplazar fotos | No se amplía |

Controles de foto: objeto `main.webp` dentro de la carpeta del museo/registro, equipo existente y no archivado, foto aún no asociada; la asociación mediante RPC exige además que el archivo haya sido subido por el usuario actual (`storage.objects.owner_id`). La limpieza de una carga fallida se limita al dueño del archivo todavía sin asociar.

## Validación obligatoria antes del despliegue

1. Confirmar esquema y migraciones de **Staging** (`lonpdmxdvbxuagqxztig`), nunca usar Producción (`kfokfjngozgcwjpzxcsu`) como ambiente de prueba.
2. Aplicar `supabase/migrations/202610110002_marketing_equipment_inventory_create.sql` en Staging **a través de un despliegue autorizado**.
3. Ejecutar `supabase/tests/employee-module-profiles.sql` dentro de su transacción con `ROLLBACK`; validar que su resultado está totalmente en verde.
4. Iniciar sesión como Marketing: ver Inventario, registrar equipo y adjuntar foto de galería y foto tomada desde celular; verificar que no pueda editar ni archivar.
5. Iniciar sesión con perfil de consulta del inventario: añadir una foto **faltante** a un artículo preexistente, sin poder reemplazar una foto ya asociada, editar o archivar.
6. Verificar `deny` explícito, usuarios inactivos, aislamiento entre dos museos, rechazo de rutas ajenas y ausencia de acceso a colecciones.
7. Ejecutar controles de seguridad Supabase (RLS, políticas y funciones) y verificar que los perfiles ajenos al módulo no ganaron acceso.
8. Solo con validación formal se autoriza la fusión de PR y la migración en producción; auditar permiso efectivo tras el despliegue.

## Reversión y control de cambios

- Antes de migrar cada entorno, conservar definiciones previas de `public.has_permission`, `public.inventory_create`, `public.inventory_set_photo`, y políticas Storage afectadas, además de la matriz de perfiles.
- Para retirar **solo la entrada nueva de Marketing** en una emergencia: quitar el valor `inventory` del arreglo `employee_module_profiles.modules` de `contenido_marketing`; esto deja intacto su historial laboral y los equipos creados. Hacerlo como migración correctiva auditada.
- La reversión completa de políticas/RPC debe restaurar las definiciones guardadas del entorno, sin tocar registros `inventory_items`, fotografías ya vinculadas ni colecciones museográficas. No usar migraciones automáticas de reversión en producción sin revisión.
- El bloqueo de seguridad que impidió aplicar SQL desde esta conversación **no debe eludirse por otra vía**. Utilizar un proceso de despliegue autorizado.

## Pruebas CI

GitHub Actions: suite específica en `.github/workflows/marketing-equipment-inventory-guard.yml`. Las pruebas de Node verifican código, formulario, permiso mínimo, foto inicial, reemplazo administrativo y limpieza fallida. **Las pruebas CI no sustituyen las pruebas reales de Storage y autenticación en Staging.**
