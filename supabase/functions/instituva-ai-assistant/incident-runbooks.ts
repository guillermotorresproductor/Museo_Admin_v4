// Approved-source incident runbooks for INSTITUVA operations.
// Guidance only: these are NOT live diagnoses or permissions to make changes.
// Each historical source must be distinguished from actual deployed behavior.
export type IncidentRunbook = {
 id:string; title:string; keywords:readonly string[]; source:string; commit:string;
 symptoms:string; verify:readonly string[]; safeActions:readonly string[]; uncertainty:string;
};
const MAIN_SNAPSHOT="a5c9cf42ab98c0af17fa3e5e18eae104e81ecde2";
export const INCIDENT_RUNBOOKS:readonly IncidentRunbook[]=[
 {id:"attendance-open",title:"Jornada abierta o ponches bloqueados",
  keywords:["ponche","ponchar","jornada abierta","entrada","salida","almuerzo","asistencia"],
  source:"docs/HORARIOS_CRITERIOS_ACEPTACION.md",commit:MAIN_SNAPSHOT,
  symptoms:"Una jornada sin cierre o una secuencia de eventos puede requerir revisión; el síntoma por sí solo no demuestra la causa.",
  verify:["Consultar historial autorizado de ponches y la fecha de la incidencia","Distinguir turno programado de marcaciones efectivas y eventos reemplazados","Confirmar quién tiene autorización vigente de corrección antes de escalar"],
  safeActions:["Documentar fecha, pantalla, mensaje de error y evidencia comprobable","Solicitar revisión al responsable autorizado sin inventar horas ni modificar eventos desde la IA"],
  uncertainty:"El procedimiento no comprueba en vivo cuál marcación está defectuosa."},
 {id:"schedules",title:"Turnos no visibles, borradores o publicación",
  keywords:["horario","horarios","turno","turnos","publicar","borrador","mi espacio"],
  source:"docs/HORARIOS_PUBLICACION_TRANSACCIONAL.md",commit:MAIN_SNAPSHOT,
  symptoms:"Un borrador no publicado no equivale a un turno visible para el empleado; el documento citado es diseño, no prueba de despliegue.",
  verify:["Comprobar si los turnos tienen estado publicado en la versión efectivamente desplegada","Confirmar permiso schedules.manage y el museo autorizado","Revisar conflictos de fechas, jornada semanal o solapamientos sin editar"],
  safeActions:["Remitir a administración competente para revisar publicación y bitácora","No ejecutar RPC antiguas ni publicar lotes sin las validaciones vigentes"],
  uncertainty:"La especificación de publicación transaccional no certifica que esté instalada."},
 {id:"finance-budget",title:"Presupuesto que no coincide con el resumen",
  keywords:["finanzas","presupuesto","balance","gasto","ingreso","total","categoría","categoria","importe"],
  source:"docs/finance-production-recovery.md",commit:MAIN_SNAPSHOT,
  symptoms:"Una diferencia puede relacionarse con año fiscal, clasificación, celdas ausentes o doble conteo; no se puede atribuir sin cotejar registros.",
  verify:["Confirmar museo, año fiscal y si son cifras presupuestadas o movimientos reales","Comparar valores guardados, categorías, partidas excluidas y totales en centavos","Verificar que nómina y beneficios no se contabilicen dos veces"],
  safeActions:["Generar comparación de solo lectura con registros originales por un usuario autorizado","Escalar diferencias documentadas; no modificar importes ni sembrar proyecciones"],
  uncertainty:"Una suma presupuestaria no demuestra pagos realizados ni conciliación bancaria."},
 {id:"finance-checks",title:"Factura, cheque o pago sin conciliación",
  keywords:["factura","facturas","cheque","cheques","pago","conciliación","conciliacion"],
  source:"docs/INSTITUVA_V4.1_BASELINE.md",commit:MAIN_SNAPSHOT,
  symptoms:"La existencia de un cheque o factura no demuestra que una obligación esté pagada o conciliada.",
  verify:["Distinguir estado del cheque, obligación de la factura y vínculo verificable","Consultar documentación autorizada en Finanzas y bitácora cuando el permiso lo permita","Confirmar fecha, valor y estado sin inferir movimientos bancarios"],
  safeActions:["Solicitar cotejo manual al personal autorizado antes de efectuar correcciones","No marcar como pagado, emitir cheques ni anular desde el asistente"],
  uncertainty:"Sin registros de pagos autorizados no se puede determinar conciliación."},
 {id:"collections",title:"Pieza, foto o historial de colección",
  keywords:["colección","colecciones","pieza","piezas","foto","fotografía","inventario museográfico","prestamo","préstamo"],
  source:"docs/COLLECTIONS_RECOVERY_20260917.md",commit:MAIN_SNAPSHOT,
  symptoms:"Una pieza no visible puede deberse a consulta, clasificación o acceso; no presupone pérdida de información.",
  verify:["Comprobar museo y permiso collections.read antes de buscar expediente","Revisar número de pieza, registro, ubicación e historial desde la interfaz autorizada","Separar titularidad, custodia y préstamo; verificar que una foto no esté simplemente protegida"],
  safeActions:["Escalar al responsable de Colecciones con identificador y evidencia, sin divulgar fotos privadas","No borrar, reasignar, importar ni sobrescribir expedientes"],
  uncertainty:"La documentación histórica no acredita el estado actual de cada pieza."},
 {id:"access",title:"Usuario sin acceso o permiso inesperado",
  keywords:["acceso","permiso","permisos","perfil","iniciar sesión","login","autorización","autorizacion","rol"],
  source:"docs/INSTITUVA_V4.1_BASELINE.md",commit:MAIN_SNAPSHOT,
  symptoms:"Una pantalla bloqueada puede reflejar el permiso efectivo, estado de sesión u otra condición; no demuestra un fallo de la base.",
  verify:["Confirmar cuenta activa y museo, sin solicitar contraseñas ni tokens","Comparar la operación con permisos efectivos mediante el mecanismo autorizado","Distinguir el acceso al módulo de autorización para ejecutar una acción sensible"],
  safeActions:["Solicitar al administrador autorizado verificar perfiles por la interfaz existente","No recomendar elevar roles, deshabilitar RLS ni compartir credenciales"],
  uncertainty:"El asistente no inspecciona credenciales, políticas completas ni sesiones privadas."}
];
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function findIncidentRunbooks(question:string,max=2):IncidentRunbook[]{
 const q=normalize(question);
 const ranked=INCIDENT_RUNBOOKS.map(b=>{
  const score=b.keywords.reduce((n,k)=>n+(q.includes(normalize(k))?(k.includes(" ")?3:1):0),0);
  return {b,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.b.id.localeCompare(b.b.id));
 return ranked.slice(0,Math.max(1,Math.min(2,max))).map(x=>x.b);
}
