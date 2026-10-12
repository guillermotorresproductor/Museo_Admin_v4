# Resumen financiero ejecutivo — meses completos

**Estado:** cálculo listo en la rama `fix/payroll-monthly-salary`. Nómina mensual aplicada solo en Staging. Sin fusión, sin `db push` y sin cambios en Producción.

## Criterio aprobado

Opción A: un sueldo `salary + monthly` entra una vez por mes calendario completo ya comenzado. No hay prorrateo, ni conversión a tarifa por hora, ni horas inventadas.

## Qué consume Mi Espacio

`js/executive-finance-summary.js` prepara el resumen. No está conectado a la pantalla. Finanzas, Recursos Humanos y el portal siguen igual.

- Vista global: doce meses del año fiscal activo. Solo entran los meses cuyo día 1 ya llegó en `America/Puerto_Rico`.
- Desde–Hasta: mes y año inicial hasta mes y año final, inclusive, como máximo doce meses. Una fecha diaria o un tramo que no cubre el mes se bloquea.
- Ingresos: movimientos reales de ingreso, no anulados y que cuentan en el balance.
- Gastos: esos mismos movimientos de gasto, más `payroll_actual`. La categoría `Nómina` no se suma otra vez. Beneficios sí, porque no salen de la nómina.
- Balance: ingresos menos gastos, en centavos.
- Un mes futuro no aporta importe. Si todos los meses seleccionados son futuros, no se muestra cero.
- Si falta la nómina de un mes incluido, o la compensación está incompleta, el total queda vacío.
- Alta o cambio de sueldo dentro del mes conservan `SALARY_HIRE_DATE_PARTIAL` y `SALARY_CHANGE_UNDEFINED`.

## Situación laboral

`payroll_actual` no recorta el sueldo por `inactivo` o `terminado`. El estado es una marca actual. `terminated_at` existe y la aplicación no lo usa como fecha de salida. Por eso el resumen ejecutivo devuelve `EMPLOYMENT_STATUS_UNDEFINED` y no muestra totales cuando un sueldo mensual pertenece a alguien inactivo o terminado.

La nómina por hora no cambia: quien ya terminó y tiene ponches sigue cobrando solo esas horas. El ensayo anterior lo exige.

## Mi Espacio Ejecutivo

La vista está en `employee-portal.html` y solo se activa con un único `access_profile = director_ejecutivo` ligado a la sesión. Los demás perfiles conservan el portal personal. No se carga geolocalización ni ponche para el director.

Asistencia, calendario y directorio reutilizan las consultas existentes. La asistencia omite al director, distingue «Sin turno» de «No ha ponchado» y colapsa varios turnos por prioridad. El resumen financiero usa `js/executive-finance-summary.js`. Si falta permiso, configuración o una regla de salida, muestra «Resumen financiero no disponible» y ningún importe.

## Reversión

Restaurar `public.payroll_actual` en Staging con `supabase/backups/payroll_actual_staging_before_202610120001.sql`. El resumen ejecutivo es un archivo nuevo; quitarlo no toca Finanzas.
