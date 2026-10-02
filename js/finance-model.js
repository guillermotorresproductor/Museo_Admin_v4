// Month order comes from the museum fiscal start (1-12). Stored cell amounts
// win over any template. Operating balance follows counts_in_operating_balance.
function financeCalendarMonths() {
  return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
}
function financeMonthsFor(startMonth) {
  const start = Number(startMonth);
  if (!Number.isInteger(start) || start < 1 || start > 12) throw Error("Mes de inicio fiscal no configurado.");
  const calendar = financeCalendarMonths();
  return Array.from({ length: 12 }, (_, index) => calendar[(start - 1 + index) % 12]);
}
function financeRowTotal(row) {
  return row.values.reduce((cents, value) => cents + Math.round(Number(value || 0) * 100), 0) / 100;
}
function financeTotals(rows) {
  const sum = type => rows.filter(row => row.type === type).reduce((cents, row) => cents + Math.round(financeRowTotal(row) * 100), 0);
  const income = sum("income"), expense = sum("expense");
  return { income: income / 100, expense: expense / 100, net: (income - expense) / 100 };
}
function financeRowsFromRecords(records, catalog, months) {
  const identityKey = row => JSON.stringify([row.type, row.category, row.concept]);
  const templates = new Map((catalog || []).map(row => [identityKey(row), row]));
  const groups = new Map();
  for (const record of records) {
    if (record.counts_in_operating_balance === false) continue;
    const index = months.indexOf(record.month);
    if (index < 0 || !["income", "expense"].includes(record.record_type)) throw Error("Registro financiero con período o tipo no reconocido.");
    const identity = { type: record.record_type, category: record.category, concept: record.concept };
    const code = record.budget_line_id || identityKey(identity);
    if (!groups.has(code)) {
      groups.set(code, {
        ...identity,
        id: templates.get(identityKey(identity))?.id || record.budget_line_id || record.id,
        budgetLineId: record.budget_line_id || null,
        sortOrder: Number.isInteger(record.sort_order) ? record.sort_order : null,
        values: Array(12).fill(null),
        recordIds: Array(12).fill(null)
      });
    }
    const row = groups.get(code);
    if (row.recordIds[index]) throw Error("Hay registros financieros duplicados; no se eligió un importe por suposición.");
    if (!Number.isFinite(Number(record.amount))) throw Error("Importe financiero inválido.");
    row.values[index] = Number(record.amount);
    row.recordIds[index] = record.id;
  }
  const order = new Map((catalog || []).map((row, index) => [identityKey(row), index]));
  return [...groups.values()].sort((a, b) => {
    const ai = a.sortOrder ?? order.get(identityKey(a)) ?? 100000;
    const bi = b.sortOrder ?? order.get(identityKey(b)) ?? 100000;
    return ai - bi || identityKey(a).localeCompare(identityKey(b));
  });
}
function financeFiscalYear(calendarYear, calendarMonth, startMonth) {
  const start = Number(startMonth);
  const yearNumber = Number(calendarYear);
  const monthNumber = Number(calendarMonth);
  if (!Number.isInteger(start) || start < 1 || start > 12) throw Error("Mes de inicio fiscal no configurado.");
  if (!Number.isInteger(yearNumber) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) throw Error("Fecha fiscal no reconocida.");
  return monthNumber >= start ? yearNumber : yearNumber - 1;
}

function financeFiscalYearFromDate(isoDate, startMonth) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ""));
  if (!match) throw Error("Fecha fiscal no reconocida.");
  return financeFiscalYear(Number(match[1]), Number(match[2]), startMonth);
}

function financeMovementMonthIndex(occurredOn, fiscalYear, startMonth) {
  const start = Number(startMonth);
  const yearNumber = Number(fiscalYear);
  if (!Number.isInteger(start) || start < 1 || start > 12) throw Error("Mes de inicio fiscal no configurado.");
  if (!Number.isInteger(yearNumber)) throw Error("Año fiscal no configurado.");
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(occurredOn || ""));
  if (!match) throw Error("Movimiento financiero con fecha no reconocida.");
  const calendarYear = Number(match[1]);
  const calendarMonth = Number(match[2]);
  if (calendarMonth < 1 || calendarMonth > 12) throw Error("Movimiento financiero con fecha no reconocida.");
  const movementFiscalYear = calendarMonth >= start ? calendarYear : calendarYear - 1;
  if (movementFiscalYear !== yearNumber) return -1;
  return (calendarMonth - start + 12) % 12;
}

function financeRealFromMovements(movements, fiscalYear, startMonth) {
  const cells = new Map();
  const incomeByMonth = Array(12).fill(0);
  const expenseByMonth = Array(12).fill(0);
  let income = 0;
  let expense = 0;
  for (const movement of movements || []) {
    if (movement.voided_at) continue;
    if (movement.counts_in_operating_balance === false) continue;
    if (!["income", "expense"].includes(movement.record_type)) throw Error("Movimiento financiero con tipo no reconocido.");
    const index = financeMovementMonthIndex(movement.occurred_on, fiscalYear, startMonth);
    if (index < 0) continue;
    const cents = Math.round(Number(movement.amount) * 100);
    if (!Number.isFinite(cents)) throw Error("Importe de movimiento financiero inválido.");
    const key = `${movement.budget_line_id}|${index}`;
    cells.set(key, (cells.get(key) || 0) + cents);
    if (movement.record_type === "income") {
      income += cents;
      incomeByMonth[index] += cents;
    } else {
      expense += cents;
      expenseByMonth[index] += cents;
    }
  }
  return {
    income: income / 100,
    expense: expense / 100,
    net: (income - expense) / 100,
    amount(budgetLineId, monthIndex) {
      return (cells.get(`${budgetLineId}|${monthIndex}`) || 0) / 100;
    },
    monthIncome(monthIndex) {
      return (incomeByMonth[monthIndex] || 0) / 100;
    },
    monthExpense(monthIndex) {
      return (expenseByMonth[monthIndex] || 0) / 100;
    }
  };
}

function financeMonthReal(movementReal, payrollAmount, monthIndex) {
  const incomeCents = Math.round(Number(movementReal.monthIncome(monthIndex) || 0) * 100);
  const expenseCents = Math.round(Number(movementReal.monthExpense(monthIndex) || 0) * 100) + Math.round(Number(payrollAmount || 0) * 100);
  return {
    income: incomeCents / 100,
    expense: expenseCents / 100,
    net: (incomeCents - expenseCents) / 100
  };
}

function financePeriodDate(startYear, monthIndex, startMonth) {
  const start = Number(startMonth);
  if (!Number.isInteger(start) || start < 1 || start > 12) throw Error("Mes de inicio fiscal no configurado.");
  const calendarIndex = (start - 1 + monthIndex) % 12;
  const calendarMonth = calendarIndex + 1;
  const year = calendarMonth >= start ? startYear : startYear + 1;
  return new Date(Date.UTC(year, calendarIndex, 1)).toISOString().slice(0, 10);
}
