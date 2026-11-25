# INSTITUVA | Asistente de IA de diagnóstico (v1)

**Propiedad del servicio:** INSTITUVA, no una implementación exclusiva del Museo de la Música. Cada museo es un tenant con su propio `museum_id` y habilitación independiente.

## Alcance inicial
- Diagnóstico de **asistencia y jornadas que pueden afectar la nómina**: turno, ponches efectivos, alertas, jornadas abiertas y su significado.
- Se ingresa **nombre completo exacto, fecha y pregunta**; una sola persona y un solo día por consulta.
- No se envían al modelo salarios, expedientes médicos, teléfonos, direcciones, correos, fotografías ni otros módulos.
- No incluye todavía cálculo monetario de nómina, corrección de marcaciones, conciliaciones ni inspección de logs técnicos.
- Solo usuarios activos con **ambos** permisos existentes `attendance.history.read` y `finance.read`. No se concede permiso nuevo a ningún usuario.
- La identidad se verifica mediante Supabase Auth, nunca por el nombre enviado por el cliente.

## Arquitectura y frontera de confianza
1. Pantalla `asistente-ia.html` → POST autenticado a `instituva-ai-assistant`.
2. Endpoint valida JWT y ambos permisos con `has_permission`; obtiene `museum_id` de `profiles`.
3. Antes de consultar, exige habilitación expresa por museo mediante `INSTITUVA_AI_ENABLED=true` + `INSTITUVA_AI_MUSEUM_IDS`.
4. Consultas fijas: empleado del museo, turnos, eventos y alertas de una fecha, entradas de tiempo. Nunca se acepta SQL, nombre de tabla ni identificadores de museo proporcionados por el modelo.
5. La información de contexto va a OpenAI Responses API con `store:false`, `max_output_tokens=650` y **sin herramientas**. El modelo redacta una explicación, no accede a Supabase.
6. El navegador recibe texto tratado con `textContent` (no HTML).
7. El asistente no tiene rutas que escriban datos operacionales. El único cambio técnico es un contador de cuotas exclusivo `ai_assistant_usage`, sin mensajes ni nombres.
8. Control de cuota atómico: 500 solicitudes/mes/museo y 100/mes/usuario. Respuestas fallidas pueden consumir una cuota: se prioriza prevención de abuso.
9. Las claves `OPENAI_API_KEY` y de Supabase **solo** se almacenan como secretos de función. No se incluyen en el repositorio, mensajes, frontend o logs.
10. Recomendación operativa: usar proyecto/API key independiente de OpenAI para INSTITUVA, presupuesto y alertas de gasto configuradas en la plataforma; observar consumo antes de ampliarlo.

## Despliegue
**Sin activación automática en producción.** La función devuelve 503 cuando no hay habilitación de museo o clave. Aun con la interfaz visible, una consulta no envía datos a OpenAI hasta que las variables seguras estén correctamente configuradas.

Staging:
- Migración `20261125170000_ai_assistant_usage_quota.sql`.
- Endpoint con verificación JWT activada, secretos de OpenAI no configurados; confirmar respuesta cerrada (403/503).
- Pruebas de autorización y cuotas con rollback.
- Prueba manual del flujo desde un usuario de prueba autorizado, sin expedientes reales.

Producción (requiere validación/activación explícita):
- Configurar secretos `OPENAI_API_KEY`, `INSTITUVA_AI_ENABLED=true`, `INSTITUVA_AI_MUSEUM_IDS` para museos aprobados.
- Verificar contrato de tratamiento de datos y comunicación al cliente.
- Probar cinco escenarios: jornada abierta, ponche faltante, tardanza, registro sin problema y empleado sin permisos.
- Verificar que el usuario no pueda modificar datos ni consultar otros museos.
- Mantener una opción de desactivación inmediata: `INSTITUVA_AI_ENABLED=false`.

## Fase 2
Si v1 está validada: agregar contextos de nómina (importes y periodos), referencias a procedimientos de corrección, observabilidad sin exponer datos sensibles y un panel de consumo por museo. Antes de habilitar usuarios con permisos parciales, definir consultas específicas para cada módulo (no reducir permisos globales).
