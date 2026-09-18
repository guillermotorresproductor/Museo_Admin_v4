// Existing operational rules: twelve months (September-August), income minus
// every expense exactly once. Stored amounts always take precedence over templates.
function financeRowTotal(row) {
  return row.values.reduce((cents,value)=>cents+Math.round(Number(value || 0)*100),0)/100;
}
function financeTotals(rows) {
  const sum=type=>rows.filter(row=>row.type===type).reduce((cents,row)=>cents+Math.round(financeRowTotal(row)*100),0);
  const income=sum('income'),expense=sum('expense');
  return {income:income/100,expense:expense/100,net:(income-expense)/100};
}
function financeRowsFromRecords(records,catalog,months,excluded) {
  const key=row=>JSON.stringify([row.type,row.category,row.concept]);
  const templates=new Map(catalog.map(row=>[key(row),row]));
  const groups=new Map();
  for(const record of records) {
    if(excluded.has(record.concept)) continue;
    const index=months.indexOf(record.month);
    if(index<0 || !['income','expense'].includes(record.record_type)) throw Error('Registro financiero con período o tipo no reconocido.');
    const identity={type:record.record_type,category:record.category,concept:record.concept},code=key(identity);
    if(!groups.has(code))groups.set(code,{...identity,id:templates.get(code)?.id || record.id,values:Array(12).fill(null),recordIds:Array(12).fill(null)});
    const row=groups.get(code);
    if(row.recordIds[index])throw Error('Hay registros financieros duplicados; no se eligió un importe por suposición.');
    if(!Number.isFinite(Number(record.amount)))throw Error('Importe financiero inválido.');
    row.values[index]=Number(record.amount);row.recordIds[index]=record.id;
  }
  const order=new Map(catalog.map((row,index)=>[key(row),index]));
  return [...groups.values()].sort((a,b)=>(order.get(key(a))??catalog.length)-(order.get(key(b))??catalog.length));
}
function financePeriodDate(startYear,monthIndex) {
  return new Date(Date.UTC(startYear,8+monthIndex,1)).toISOString().slice(0,10);
}
