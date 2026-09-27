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
function financePeriodDate(startYear, monthIndex, startMonth) {
  const start = Number(startMonth);
  if (!Number.isInteger(start) || start < 1 || start > 12) throw Error("Mes de inicio fiscal no configurado.");
  const calendarIndex = (start - 1 + monthIndex) % 12;
  const calendarMonth = calendarIndex + 1;
  const year = calendarMonth >= start ? startYear : startYear + 1;
  return new Date(Date.UTC(year, calendarIndex, 1)).toISOString().slice(0, 10);
}
