# Nómina real — producción

Proyecto: `kfokfjngozgcwjpzxcsu`. Frontend: `mmdpr.org`. Rama: `payroll-actual-staging`.

No usar `db push`. No registrar estas sentencias en el historial de migraciones. No crear asignaciones durante este procedimiento.

## Abortar

Detener el procedimiento, sin publicar el frontend, si ocurre cualquiera de estas condiciones:

- `scripts/payroll-production-precheck.sql` termina con `PRECHECK_FAILED`.
- `scripts/payroll-production-deploy.sql` termina con error. La transacción revierte los objetos nuevos.
- `scripts/payroll-production-postcheck.sql` termina con `POSTCHECK_FAILED`.
- `finance_records` deja de tener 672 filas, suma 0, o alguno de los dos MD5 esperados.
- `employee_compensation` deja de tener exactamente 5 filas o 5 empleados distintos.
- El aviso `COMPENSATION_FINGERPRINT` del postcheck no coincide con el del precheck.
- `authenticated` pierde `SELECT` o gana `INSERT`, `UPDATE`, `DELETE` o `TRUNCATE` sobre `employee_compensation` o `employee_budget_assignments`.
- `fiscal_year_start_month` deja de ser 9.

ROLLBACK AUTOMÁTICO PERMITIDO únicamente si `employee_budget_assignments` tiene 0 filas.

Si tiene una o más filas: NO EJECUTAR `scripts/payroll-production-rollback.sql`. Se requiere un rollback manual con preservación de historial. El script aborta con `ROLLBACK_ABORT assignments_not_empty` y no borra esas filas.

Si el fallo aparece después de un deploy confirmado y la tabla sigue vacía, ejecutar `scripts/payroll-production-rollback.sql`. Antes de cualquier `DROP` exige que existan la tabla, `payroll_actual(date, date)` y `list_attendance_history(date, date, boolean)`. Retira los objetos nuevos de Nómina real y devuelve `list_attendance_history` a dos fechas. No reescribe las 5 compensaciones ni `finance_records`.

## 1. PRECHECK

Ejecutar `scripts/payroll-production-precheck.sql` contra producción. Es de solo lectura y cierra con `rollback`.

Debe terminar sin excepción. Si falla, abortar.

Copia el valor de la columna `compensation_fingerprint`. El mismo hash aparece en el aviso `COMPENSATION_FINGERPRINT`. Representa las 5 filas completas, incluida la tarifa, y no muestra tarifas ni salarios. No está guardado en el archivo. No lo inventes y no modifiques las filas.

## 2. DEPLOY SQL

Ejecutar `scripts/payroll-production-deploy.sql` en una sola transacción.

Antes de cualquier `DROP` o `CREATE`, el script aborta si el museo no es `museo-musica-pr`, si `fiscal_year_start_month` no es 9, si `finance_records` no conserva el snapshot de 672 filas, suma 0, cero nulos y los dos MD5, si no hay 5 compensaciones de 5 empleados, o si `payroll_actual` o `employee_budget_assignments` ya existen. No altera las filas de `employee_compensation`. No escribe `finance_records`. La auditoría usa `audit_logs.user_id`.

`assign_employee_budget_line` solo inserta. Si la nueva vigencia se solapa con una asignación de ese empleado, responde `EMPLOYEE_PLAZA_OVERLAP` y no modifica la fila anterior. Cambiar de plaza exige antes `close_employee_budget_assignment`. Esto no es el cierre automático que staging validó.

## 3. VALIDACIÓN DB

Ejecutar `scripts/payroll-production-postcheck.sql`. Es de solo lectura.

No edites este archivo. En la misma pestaña del SQL Editor, ejecuta primero y por separado:

```sql
select set_config('payroll.expected_compensation_fingerprint', 'PEGAR_EL_HASH', false);
```

Sustituye `PEGAR_EL_HASH` por el valor copiado del precheck. Esa sentencia no se guarda en el repositorio. Después, sin cerrar la pestaña, ejecuta `scripts/payroll-production-postcheck.sql` tal como está. El postcheck lee ese valor de la sesión. Si falta o no coincide, aborta con `POSTCHECK_FAILED compensation_fingerprint`. No lo guardes en una tabla. Las demás comprobaciones de las 5 filas no demuestran por sí solas que `hourly_rate` siguió igual.

La firma `list_attendance_history(date, date, boolean default false)` se comprueba solo como estructura. No sustituye una llamada autenticada.

Debe confirmar además el snapshot de `finance_records` sin importes nulos, `payroll_actual`, la tabla de asignaciones vacía, el año fiscal 9, `SELECT` sin escritura directa para `authenticated` en compensación y asignaciones, la ejecución autorizada de las funciones del paquete, y que `resolve_employee_compensation` y `save_employee_sensitive_details` no queden ejecutables o presentes para ese rol.

Si falla, abortar. El rollback automático solo procede si `employee_budget_assignments` tiene 0 filas.

## 4. FRONTEND

Publicar, solo después de la validación, los archivos de esta rama:

- `finanzas.html`
- `js/payroll-actual.js`
- `js/app.js`
- `css/main.css`
- `perfil-empleado.html`
- `recursos-humanos.html`

No publicar si la validación de base falló.

## 5. CACHE BUST

Las páginas que cambian ya llevan estas versiones:

- Finanzas: `css/main.css?v=payroll-assign-20260929`, `js/payroll-actual.js?v=payroll-assign-20260929`, `js/app.js?v=payroll-assign-20260929`
- Recursos Humanos: `js/app.js?v=compensation-history-20260929`
- Perfil: `js/app.js?v=compensation-history-20260929`

`js/finance-model.js?v=finance-2bc-20260928` no cambia. Confirmar en el navegador que Finanzas pide `payroll-actual.js` y no el `app.js` de `finance-2bc-20260928`.

## 6. SMOKE TEST

Sin crear ni cerrar asignaciones. Con un usuario que tenga `attendance.history.read`, llama:

- `list_attendance_history` con dos fechas;
- `list_attendance_history` con esas dos fechas y `true` en el tercer argumento.

Ambas deben responder. Un privilegio insuficiente en esa sesión no valida la firma.

Además:

- Abrir Finanzas con `compensation.manage`. El presupuesto sigue visible. Nómina real aparece. Los selectores de empleados y de plazas de Nómina cargan.
- Abrir Recursos Humanos y el perfil. La vigencia existente se lee. No guardar una vigencia nueva en esta pasada.
- Con un usuario sin `compensation.manage`, los controles de asignar y cerrar no aparecen. Una llamada directa a `assign_employee_budget_line` o `close_employee_budget_assignment` debe responder privilegio insuficiente.

Si el humo falla, dejar de usar la pantalla y retirar el frontend publicado. El rollback automático solo procede si `employee_budget_assignments` tiene 0 filas.

## 7. POSTCHECK

Ejecutar otra vez `scripts/payroll-production-postcheck.sql`.

Vuelve a ejecutar `set_config` con el mismo hash del precheck y, en esa sesión, el postcheck sin modificar. Las asignaciones deben seguir en 0. Los dos MD5 de `finance_records` deben seguir iguales y no debe haber importes nulos. Si la huella o cualquier otra comprobación falla, abortar. El rollback automático solo procede si `employee_budget_assignments` tiene 0 filas. No reescribas las compensaciones para forzar la coincidencia.
