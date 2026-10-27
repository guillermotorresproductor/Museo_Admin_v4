# HORARIOS — protocolo de aceptación sin datos reales
2026-10-27 · PR #102 · NO desplegado

## Restricción inviolable
No se ejecutarán INSERT, UPDATE, DELETE, UPSERT ni RPC de escritura sobre empleados reales en producción ni staging. Los ensayos de escritura requieren un entorno aislado con empleados ficticios y autenticación de prueba. No copiar datos reales al entorno de ensayo.

## Verificaciones estáticas completadas
- Protección de acceso en el enrutador y página, permiso schedules.manage.
- Registro de página en perfil de módulo administración.
- Inicialización de HORARIOS después de app-ready, evitando carreras con carga de permisos.
- Uso de list_employee_shifts y list_my_assigned_shifts; Mi Espacio no fue modificado.
- Usar employee_shifts existing; no tablas duplicadas, no cambios a nómina ni ponches.
- Funciones de producción y staging comparadas: schedule_employee_shift difiere; no presumir equivalencia.
- Horas programadas, no horas pagadas.
- Confirmación explícita antes de operaciones de escritura.

## Casos aritméticos aislados (sin acceso a DB)
1. 13:00–22:00, almuerzo 60: 480 min (8 h) — pasa.
2. 13:00–21:00, almuerzo 60: 420 min (7 h) — pasa.
3. 22:00–07:00, almuerzo 60: 480 min (8 h) — pasa.
4. 08:00–18:00, almuerzo 60: 540 min (9 h) — rechazo ordinario.
5. 09:00–17:00, almuerzo 0: 480 min (8 h) — cálculo aritmético; cumplimiento de pausa debe evaluarse por política/ley.

## Pruebas de integración todavía obligatorias
- Cada uno de los tres roles autorizados accede; otros roles no.
- Cuenta con permiso de módulo pero sin schedules.manage recibe denegación.
- Concurrencia: expected_updated_at obsoleto rechaza cambios.
- Turnos dobles, próximos, completados y cancelados.
- Semana con 40h exactas y 40h+1min.
- Días libres; confirmación antes de guardar; no autoprogramación.
- Mi Espacio refleja solamente turnos asignados efectivamente publicados.
- Regresión sobre ponches y nómina.
- Mobile PWA y versión impresa.
- Staging aislado sin datos reales para pruebas de escritura.

## Advertencia de producto
La vista actual utiliza las RPC existentes, que publican inmediatamente cada cambio. El requisito 'borrador semanal / publicar toda la semana' NO está implementado. No permitir despliegue si se considera obligatorio. Se requiere implementar contrato transaccional aislado y permisos de lectura antes de activar esa característica.

## Go/No Go
No hacer merge ni desplegar mientras falten las pruebas anteriores y el flujo de publicación diferida.
