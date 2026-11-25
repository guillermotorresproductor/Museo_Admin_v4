// Only fixed, reviewed finance categories may be included in AI evidence.
// finance_budget_lines.category is free text; database users can change it.
// Unknown labels are grouped without sending their text to the model.
const approvedCategories:Readonly<Record<string,string>>={
  "beneficios":"Beneficios",
  "gastos operacionales":"Gastos Operacionales",
  "nomina":"Nómina",
  "otros gastos":"Otros Gastos",
  "servicios contratados":"Servicios Contratados",
  "entradas al museo":"Entradas al Museo",
  "ingresos":"Ingresos"
};
export const OTHER_FINANCE_CATEGORY="Otras categorías (sin exponer etiquetas)";
export function canonicalFinanceCategory(value:unknown):string {
  if(typeof value!=="string")return OTHER_FINANCE_CATEGORY;
  const normalized=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .trim().toLowerCase().replace(/\s+/g," ");
  return Object.prototype.hasOwnProperty.call(approvedCategories,normalized)
    ? approvedCategories[normalized] : OTHER_FINANCE_CATEGORY;
}
