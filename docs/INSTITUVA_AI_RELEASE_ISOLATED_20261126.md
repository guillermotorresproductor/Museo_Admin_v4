# INSTITUVA AI — publicación aislada (26 nov 2026)

## Alcance
- Rama `release/instituva-ai-ui-isolated-20261126` nacida de `main`, independiente del PR #125.
- Archivo HTML de chat, JS de diálogo, JS de panel flotante, CSS aislado y únicamente integración en `js/app.js` y `js/config.js`.
- Sin migraciones, sin cambios a módulos operacionales, sin mezcla de PR #125.

## Política de acceso
El cliente verifica cuenta autenticada, empleado activo vinculado a `auth.user.id` mediante `employees.profile_id` y `employees.access_profile` en la lista exacta: `administrador_general`, `director_ejecutivo`, `gerente_administrativo`, `gerente_museografica`. El chat no se inicia y el panel no se carga para otro perfil.

El 26 nov 2026 se desplegó **por separado** en Supabase Producción la función Edge `instituva-ai-assistant` versión **5**: valida los mismos cuatro perfiles activos, vinculados al usuario y museo, antes de ejecutar lecturas de módulos o reclamar cuota. JWT y permisos específicos por módulo siguen obligatorios. El cambio se realizó sobre un solo archivo de la función ya instalada, conservando los otros diecisiete. Esto NO equivale a una prueba E2E autenticada de producción.

## Control de lanzamiento
`production.aiAssistantUiEnabled=false`; no activar ni fusionar hasta probar cuentas de los cuatro roles permitidos y usuarios denegados, también acceso directo al endpoint, JWT, RLS/aislamiento de museo y una consulta real de solo lectura. La función Edge en producción está activa, pero la interfaz web continúa cerrada.

## Pruebas pendientes
1. Validar compilación y CI de esta rama sin arrastrar #125.
2. 403 para empleados ordinarios; respuestas válidas para cada perfil directivo autorizado.
3. Consultas generales, finanzas, asistencia y demás módulos sujetos a permisos particulares, sin escrituras operacionales.
4. Verificar que las páginas de administración ajenas no cambian su comportamiento.
5. Publicar mediante fusión aislada y cambio explícito de bandera únicamente tras autorización de lanzamiento.
