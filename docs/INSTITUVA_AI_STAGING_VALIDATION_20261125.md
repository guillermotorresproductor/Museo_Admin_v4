# INSTITUVA AI — staging: validación de aislamiento
Fecha: 2026-11-25. PR #125. Proyecto: instituva staging (lonpdmxdvbxuagqxztig).
**Resultado: verificaciones de base de datos aprobadas; ensayo integral con JWT real pendiente. No autoriza producción.**

## Hallazgo y corrección
- finance_records.month es TEXT con meses fiscales en español, no entero. Se corrigió la validación y el tipado en el PR, sin cambiar datos ni esquema.
- Despliegue de Edge Function versión 5 únicamente en staging, verify_jwt=true, con validación explícita de tenant y cuota v2.
- CI INSTITUVA AI: éxito para e43c1d88eba309362772e4a8c51f0bf244122b9e.

## Verificaciones ejecutadas
- Dos museos y perfiles de prueba preexistentes, todos originalmente inactivos.
- Contexto de rol authenticated y request.jwt.claim.sub SIMULADO en transacción PostgreSQL: comprueba RLS/SQL, no login HTTP real.
- Activación transitoria exclusivamente de perfiles ficticios dentro de BEGIN/ROLLBACK.
- Museo A: museo resuelto, sin acceso a registros financieros de otro museo y sin acceso a perfiles del museo B.
- Museo B: solo perfil propio; cuota de modo product aceptada; finance.read y attendance.history.read denegados.
- La función de cuota rechazó museo extranjero y modos privados sin autorización; acceso directo a tabla de cuota denegado.
- Post verificación: ai_assistant_usage en 0 registros y dos perfiles ficticios siguieron inactivos.
- Sin cambios persistentes en museos, empleados, finanzas, ponches, documentos, ni fotografías.

## Pruebas todavía pendientes
1. Login Supabase Auth con JWT real de cuentas ficticias activas de dos museos.
2. Solicitudes HTTP autenticadas a Edge Function desde la interfaz y revisión del flujo completo.
3. Casos positivos de permisos finance.read / Asistencia con registros únicamente sintéticos.
4. Verificación de respuesta del proveedor de IA, presentación del diagnóstico y ausencia de datos sensibles.
5. Confirmar feature flag y allowlist efectiva sin exponer secretos, antes de activar IA.

## Condición para aprobar despliegue
Completar los cinco pasos pendientes. No realizar merge ni habilitar producción con estas pruebas parciales.

Nota: Marketing equipment inventory guard sigue fallando por pruebas independientes de caché de fotos y formulario; no se modificó Inventario.
## Extensión: ensayo HTTP Auth genuino preparado (no ejecutado)
- Nuevo arnés: supabase/tests/instituva-ai-auth-staging.mjs.
- Crea **dos museos y dos usuarios desechables** por la API Admin de Supabase Auth únicamente en el proyecto staging fijado; usa contraseñas aleatorias, correos example.invalid, sin correo saliente.
- Obtiene JWT firmados mediante Auth password grant, verifica endpoint /auth/v1/user, aislamiento RLS vía PostgREST, permisos financieros/laborales, denegación de RPC de cuota de otro museo y denegación de la Edge Function en modos privados.
- Evita llamadas al modelo, consultas positivas de datos de empleados y cualquier escritura operacional.
- Borra exclusivamente sus cuotas de prueba, permisos, registros de auditoría generados por sus museos, usuarios y museos desechables; registra IDs para recuperación manual si la limpieza falla.
- Requiere INSTITUVA_AI_TEST_SERVICE_KEY y INSTITUVA_AI_TEST_ANON_KEY de **staging**. No hay credenciales administrativas de prueba disponibles mediante los conectores para ejecutarlo en esta sesión, por lo que **no se afirma prueba HTTP Auth completada**.
- Validación de sintaxis incluida en CI del PR. Para ejecutarlo en entorno autorizado: `node supabase/tests/instituva-ai-auth-staging.mjs` con las dos variables secretas establecidas en el entorno (no en archivos ni en Git).
- Los escenarios positivos de Finance/Asistencia con usuarios autorizados y la respuesta IA siguen pendientes.