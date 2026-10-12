// Calculation for the executive summary. It does not write records or change payroll.
// A month counts only when the query covers that whole calendar month and the month has started.
// Registered movements stay visible. Calculated payroll is not treated as a payment.

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

function executiveFinancePersonNotice(person) {
  const type = String(person.compensation_type || "");
  const status = String(person.employment_status || "").toLowerCase();
  if (!type || type === "unconfigured") return "unconfigured";
  if (person.state === "SIN TARIFA") return "no-rate";
  if (person.state === "PERIODO PARCIAL") return "partial";
  if (type !== "hourly" && type !== "salary") return "unsupported";
  if (type === "salary" && status !== "activo") return "inactive-salary";
  return "calculated";
}

function executiveFinanceAmountLabel(cents) {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${fraction}`;
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

  let incomeCents = 0;
  let expenseCents = 0;
  let registeredPayrollCents = 0;
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
    const cents = executiveFinanceCents(movement.amount);
    if (cents == null) {
      return executiveFinanceBlocked("MOVEMENT_UNAVAILABLE", "Hay un movimiento financiero con importe ilegible.", months);
    }
    if (movement.record_type === "income") incomeCents += cents;
    else {
      expenseCents += cents;
      if (movement.category === "Nómina") registeredPayrollCents += cents;
    }
  }

  const payroll = source.payrollByMonth || {};
  const notices = [];
  let calculatedCents = 0;
  let calculationComplete = true;
  const note = (text) => { if (!notices.includes(text)) notices.push(text); };
  for (const month of included) {
    const entry = payroll[month.from];
    if (!entry || entry.error) {
      calculationComplete = false;
      note("La nómina calculada no está disponible para uno o más meses. No se sustituyó por un pago.");
      continue;
    }
    const payload = entry.payload;
    if (!payload || payload.full_month !== true || payload.from !== month.from || payload.to !== month.to) {
      calculationComplete = false;
      note("La nómina calculada no cubre un mes completo. No se usó como pago.");
      continue;
    }
    const seen = new Set();
    for (const person of payload.employees || []) {
      if (!person || !person.employee_id || seen.has(person.employee_id)) {
        calculationComplete = false;
        note("La nómina calculada no se pudo leer sin duplicar empleados. No se usó como pago.");
        continue;
      }
      seen.add(person.employee_id);
      const kind = executiveFinancePersonNotice(person);
      if (kind === "unconfigured") {
        calculationComplete = false;
        note("Hay empleados sin compensación configurada. No se les añadió un gasto salarial.");
        continue;
      }
      if (kind === "no-rate") {
        calculationComplete = false;
        note("Hay tiempo trabajado sin tarifa. No se inventó un pago.");
        continue;
      }
      if (kind === "partial") {
        calculationComplete = false;
        note("Hay un período de sueldo que no cubre el mes completo. No se prorrateó ni se contó como pago.");
        continue;
      }
      if (kind === "unsupported") {
        calculationComplete = false;
        note("Hay compensaciones que no corresponden a un pago registrado. No se sumaron.");
        continue;
      }
      if (kind === "inactive-salary") {
        calculationComplete = false;
        note("Hay un sueldo mensual de un empleado que no está activo. No se contó como pago.");
        continue;
      }
      const cents = executiveFinanceCents(person.actual_amount);
      if (cents == null) {
        calculationComplete = false;
        note("La nómina calculada devolvió un importe ilegible. No se sustituyó por un pago.");
        continue;
      }
      calculatedCents += cents;
    }
  }
  if (calculationComplete && calculatedCents !== registeredPayrollCents) {
    note(`La nómina calculada del período es ${executiveFinanceAmountLabel(calculatedCents)} y los pagos de nómina registrados son ${executiveFinanceAmountLabel(registeredPayrollCents)}. El cálculo no se sumó como pago.`);
  }

  return {
    status: "ready",
    code: null,
    message: notices.join(" "),
    income: executiveFinanceMoney(incomeCents),
    expense: executiveFinanceMoney(expenseCents),
    payroll: executiveFinanceMoney(registeredPayrollCents),
    net: executiveFinanceMoney(incomeCents - expenseCents),
    months
  };
}
