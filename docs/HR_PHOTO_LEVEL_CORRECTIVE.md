# Correctivo de niveles y fotografías — 8 septiembre 2026

Base: `204f07bb5c2b2d63bdc4fa8e8203dcfee7e964a4` (main, PR31).

Recursos Humanos ahora consulta el nivel efectivo al abrir el expediente y utiliza
`assign-sensitive-role` con el nivel esperado al guardar un cambio. No incluye
`access_level` en el PATCH básico. La función conserva el RPC transaccional
`replace_employee_access_level` y comprueba cuenta Auth, correo, perfil, museo y
vínculo único antes de llamarlo. No se crean cuentas ni se envían invitaciones.

Las fotografías se suben al bucket privado `employee-photos`, en una ruta de museo,
empleado y UUID. La base conserva `storage:employee-photos/...`, no la URL firmada.
El directorio genera enlaces nuevos al consultar. PNG/JPEG/WebP, máximo 5 MB.
RLS limita lectura y subida al museo y al empleado propio o a los permisos de RH.
El RPC `set_employee_photo` comprueba objeto existente, ruta y referencia previa
para impedir sobrescrituras con datos obsoletos. Un trigger bloquea referencias
arbitrarias por PATCH directo. No se cambian las políticas de otros buckets.

Ambos formularios esperan el resultado del servidor, bloquean envíos duplicados y
la lectura incompleta del archivo, y muestran error si falla la foto. La edición
básica omite `photo_url`, por lo que no borra fotos al editar otros campos.
El diseño, CSS y disposición no cambian. Los dos HTML solo actualizan versiones
de los scripts para invalidar caché.

## Validación ejecutada

- 27 pruebas locales: `node --test supabase/tests/employee-photo-level.test.mjs supabase/tests/employee-access-wiring.test.mjs`.
- Sintaxis de ambos JS y `git diff --check` correctos.
- Staging real, ejecución `photo-level-1788840439503`: subida desde los servicios
  reales de RH y Ver Perfil; lectura privada; sesión nueva; foto propia;
  denegación a otro empleado, otro museo y anónimos; PATCH directo bloqueado;
  referencia obsoleta rechazada; identidad incorrecta rechazada; permisos
  administrativos efectivos; otro empleado sin cambios; formato inválido
  rechazado; eliminación persistente; cero invitaciones.
- Navegador, aplicación local conectada a Staging: selección mediante FileReader,
  subida y guardado desde RH y Ver Perfil, recarga de ambas páginas, cierre de
  sesión e inicio de una sesión nueva. Imagen visible y decodificada
  (`complete=true`, `naturalWidth=1`) usando un PNG sintético de 1 píxel.
- Las cuentas, expedientes y objetos de las pruebas se limpiaron. Los museos
  sintéticos vacíos sirven como contenedores de auditoría y no dan acceso.

Staging tiene desplegada la función y aplicada/registrada la migración
`202609080001`. La vista web probada es local; no se publicó el frontend en el
dominio demo ni se desplegó Producción.

## Reproducción

Desde la raíz del repositorio:

```powershell
./scripts/test-employee-photo-level-staging.ps1
node scripts/preview-staging.mjs
```

El script de pruebas fija el proyecto de Staging, obtiene credenciales del CLI
en memoria y crea únicamente datos ficticios. La vista se abre en
`http://127.0.0.1:5188/login.html?environment=staging`.

## Promoción pendiente

1. Revisar y aprobar el diff; no hacer push a main sin aprobación, porque dispara Pages.
2. Confirmar los prerrequisitos de Producción y aplicar solo la nueva migración,
   desplegar `assign-sensitive-role` y publicar los assets revisados.
3. Cambiar al empleado solicitado mediante `assign-sensitive-role` usando una
   sesión real con `roles.assign`, `expected_role: empleado` y
   `role_code: administrador`. Reconsultar antes de actuar: si cambió, detener el
   cambio y revisar. No usar un PATCH de cargo, nivel visual ni una invitación.
4. Verificar vínculo único, Auth, `profiles.role`, `employees.access_level`,
   auditoría, permisos efectivos y acceso a módulos desde una nueva sesión.
   Confirmar que los demás empleados conservan roles y permisos.
5. Subir de nuevo la foto original que no llegó a guardarse, y repetir recarga y
   nueva sesión en Producción. Un `photo_url` nulo no permite recuperar el archivo.

El cambio de nivel es transaccional; el guardado de campos básicos, foto y datos
sensibles son pasos separados. Un fallo posterior puede dejar pasos anteriores
guardados: se informa error y se conserva el ID para reintentar sin duplicar el
expediente. Las fotos son inmutables; versiones anteriores u objetos de una
subida cuyo commit falle permanecen privados para una futura política de
retención. No se ejecuta una eliminación automática de archivos históricos.
