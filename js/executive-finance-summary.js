// Calculation for the executive summary. It does not write records or change payroll.
// A month counts only when the query covers that whole calendar month and the month has started.
// Salary errors and an inactive or terminated monthly salary stay blocked. Totals stay empty.

function executiveFinanceCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function executiveFinanceMoney(cents) {
  return cents / 100;
}

function executiveFinanceLastDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function executiveFinanceMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function executiveFinanceBounds(year, month) {
  const from = `${executiveFinanceMonthKey(year, month)}-01`;
  const to = `${executiveFinanceMonthKey(year, month)}-${String(executiveFinanceLastDay(year, month)).padStart(2, "0")}`;
  return { year, month, from, to };
}

function executiveFinanceNextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function executiveFinanceBlocked(code, message, months) {
  return {
    status: "blocked",
    code,
    message,
    income: null,
    expense: null,
    payroll: null,
    net: null,
    months
  };
}

function executiveFinanceParseMonth(value) {
  const year = Number(value && value.year);
  const month = Number(value && value.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (value.day != null || value.from || value.to) return null;
  return { year, month };
}

function executiveFinanceSelectedMonths(range) {
  const start = executiveFinanceParseMonth(range && range.from);
  const end = executiveFinanceParseMonth(range && range.to);
  if (!start || !end) return { error: "PARTIAL_PERIOD" };
  if (end.year < start.year || (end.year === start.year && end.month < start.month)) return { error: "PARTIAL_PERIOD" };
  const months = [];
  let cursor = start;
  while (months.length < 13) {
    months.push(executiveFinanceBounds(cursor.year, cursor.month));
    if (cursor.year === end.year && cursor.month === end.month) break;
    cursor = executiveFinanceNextMonth(cursor.year, cursor.month);
  }
  if (months.length > 12 || months[months.length - 1].year !== end.year || months[months.length - 1].month !== end.month) {
    return { error: "RANGE_TOO_LONG" };
  }
  return { months };
}

function executiveFinanceFiscalWindow(startMonth, today) {
  const start = Number(startMonth);
  if (!Number.isInteger(start) || start < 1 || start > 12) return { error: "FISCAL_START_MISSING" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || ""))) return { error: "TODAY_MISSING" };
  const fiscalYear = financeFiscalYearFromDate(today, start);
  const months = Array.from({ length: 12 }, (_, index) => {
    const from = financePeriodDate(fiscalYear, index, start);
    const [year, month] = from.split("-").map(Number);
    return executiveFinanceBounds(year, month);
  });
  return { months };
}

function executiveFinancePayrollBlock(error) {
  const detail = String(error && (error.message || error) || "");
  if (detail.includes("FORBIDDEN") || detail.includes("42501")) {
    return ["FORBIDDEN", "No tiene permiso para consultar la nómina."];
  }
  if (detail.includes("SALARY_CONFIGURATION_INCOMPLETE")) {
    return ["SALARY_CONFIGURATION_INCOMPLETE", "Hay un sueldo fijo mensual sin importe o sin período. No se muestra un total."];
  }
  if (detail.includes("SALARY_PERIOD_UNSUPPORTED")) {
    return ["SALARY_PERIOD_UNSUPPORTED", "Hay un sueldo fijo que no es mensual. No se muestra un total."];
  }
  if (detail.includes("SALARY_CHANGE_UNDEFINED")) {
    return ["SALARY_CHANGE_UNDEFINED", "El sueldo cambió dentro del mes. No hay una regla para dividirlo."];
  }
  if (detail.includes("SALARY_HIRE_DATE_PARTIAL")) {
    return ["SALARY_HIRE_DATE_PARTIAL", "La contratación cae dentro del mes. No hay una regla para dividir el sueldo."];
  }
  return ["PAYROLL_UNAVAILABLE", "La nómina de un mes incluido no está disponible. No se sustituyó por cero."];
}

function executiveFinancePersonBlock(person) {
  const type = String(person.compensation_type || "");
  const status = String(person.employment_status || "").toLowerCase();
  if (!type || type === "unconfigured") {
    return ["SALARY_CONFIGURATION_INCOMPLETE", "Hay un empleado sin compensación configurada. No se inventó un cero."];
  }
  if (type !== "hourly" && type !== "salary") {
    return ["SALARY_PERIOD_UNSUPPORTED", "Hay una compensación que no es sueldo mensual ni tarifa por hora. No se muestra un total."];
  }
  if (person.state === "SIN TARIFA") {
    return ["SALARY_CONFIGURATION_INCOMPLETE", "Hay tiempo trabajado sin tarifa. No se inventó un cero."];
  }
  if (person.state === "PERIODO PARCIAL") {
    return ["PARTIAL_PERIOD", "Hay un período que no cubre el mes completo. No se prorrateó el sueldo."];
  }
  if (type === "salary" && (status === "inactivo" || status === "terminado")) {
    return ["EMPLOYMENT_STATUS_UNDEFINED", "Hay un sueldo mensual de un empleado inactivo o terminado. No existe una fecha de salida que indique hasta qué mes corresponde pagarlo."];
  }
  if (type === "salary" && status !== "activo") {
    return ["EMPLOYMENT_STATUS_UNDEFINED", "Hay un sueldo mensual sin una situación laboral reconocida. No se muestra un total."];
  }
  return null;
}

function executiveFinanceSummary(input) {
  const source = input || {};
  const today = String(source.today || "");
  let window;
  if (source.range) window = executiveFinanceSelectedMonths(source.range);
  else window = executiveFinanceFiscalWindow(source.fiscalStartMonth, today);
  if (window.error === "FISCAL_START_MISSING") {
    return executiveFinanceBlocked("FISCAL_START_MISSING", "No se pudo determinar el año fiscal del museo.", []);
  }
  if (window.error === "TODAY_MISSING") {
    return executiveFinanceBlocked("TODAY_MISSING", "No se pudo determinar la fecha de hoy.", []);
  }
  if (window.error === "PARTIAL_PERIOD") {
    return executiveFinanceBlocked("PARTIAL_PERIOD", "El período debe indicarse por mes y año, de mes completo a mes completo.", []);
  }
  if (window.error === "RANGE_TOO_LONG") {
    return executiveFinanceBlocked("RANGE_TOO_LONG", "El período no puede pasar de doce meses completos.", []);
  }

  const months = window.months.map((month) => ({
    ...month,
    included: month.from <= today
  }));
  const included = months.filter((month) => month.included);
  if (!included.length) {
    return executiveFinanceBlocked("FUTURE_ONLY", "Los meses seleccionados todavía no han comenzado. No se anticipó un gasto.", months);
  }

  const payroll = source.payrollByMonth || {};
  let payrollCents = 0;
  for (const month of included) {
    const entry = payroll[month.from];
    if (!entry || entry.error) {
      const reason = executiveFinancePayrollBlock(entry && entry.error);
      return executiveFinanceBlocked(reason[0], reason[1], months);
    }
    const payload = entry.payload;
    if (!payload || payload.full_month !== true || payload.from !== month.from || payload.to !== month.to) {
      return executiveFinanceBlocked("PARTIAL_PERIOD", "La nómina recibida no corresponde a un mes calendario completo.", months);
    }
    const seen = new Set();
    for (const person of payload.employees || []) {
      if (!person || !person.employee_id || seen.has(person.employee_id)) {
        return executiveFinanceBlocked("PAYROLL_UNAVAILABLE", "La nómina de un mes incluido no se pudo leer sin duplicar empleados.", months);
      }
      seen.add(person.employee_id);
      const personBlock = executiveFinancePersonBlock(person);
      if (personBlock) return executiveFinanceBlocked(personBlock[0], personBlock[1], months);
      const cents = executiveFinanceCents(person.actual_amount);
      if (cents == null) {
        return executiveFinanceBlocked("PAYROLL_UNAVAILABLE", "La nómina devolvió un importe ilegible. No se sustituyó por cero.", months);
      }
      payrollCents += cents;
    }
  }

  let incomeCents = 0;
  let expenseCents = 0;
  const seenMovements = new Set();
  for (const movement of source.movements || []) {
    if (!movement || !movement.id || seenMovements.has(movement.id)) {
      return executiveFinanceBlocked("MOVEMENT_UNAVAILABLE", "Hay un movimiento financiero duplicado o ilegible. No se eligió un importe.", months);
    }
    seenMovements.add(movement.id);
    if (movement.voided_at) continue;
    if (movement.counts_in_operating_balance === false) continue;
    const occurred = String(movement.occurred_on || "").slice(0, 10);
    const month = included.find((item) => occurred >= item.from && occurred <= item.to);
    if (!month) continue;
    if (!movement.category || !["income", "expense"].includes(movement.record_type)) {
      return executiveFinanceBlocked("MOVEMENT_UNAVAILABLE", "Hay un movimiento financiero sin categoría o sin tipo. No se sumó por suposición.", months);
    }
    if (movement.record_type === "expense" && movement.category === "Nómina") continue;
    const cents = executiveFinanceCents(movement.amount);
    if (cents == null) {
      return executiveFinanceBlocked("MOVEMENT_UNAVAILABLE", "Hay un movimiento financiero con importe ilegible.", months);
    }
    if (movement.record_type === "income") incomeCents += cents;
    else expenseCents += cents;
  }

  const expense = expenseCents + payrollCents;
  return {
    status: "ready",
    code: null,
    message: "",
    income: executiveFinanceMoney(incomeCents),
    expense: executiveFinanceMoney(expense),
    payroll: executiveFinanceMoney(payrollCents),
    net: executiveFinanceMoney(incomeCents - expense),
    months
  };
}
