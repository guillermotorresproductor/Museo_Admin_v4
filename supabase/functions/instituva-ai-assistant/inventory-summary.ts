import {assertTenantRows} from "./tenant-guard.ts";

export type InventoryEvidenceRow={
  id:string;museum_id:string;record_type:unknown;status:unknown;
  quantity:unknown;archived_at:unknown;
};
const canonical=(value:unknown,allowed:readonly string[])=>{
  if(typeof value!=="string")return "otro";
  const key=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().trim();
  return allowed.includes(key)?key:"otro";
};
const statusNames=["activo","inactivo","archivado","retirado","mantenimiento","prestado","perdido"];
const typeNames=["individual","lote","consumible","equipo","grupo"];

export function summarizeInventory(
  items:readonly InventoryEvidenceRow[],museumId:string,
  missingPhotoCount:number
){
  assertTenantRows(items,museumId);
  if(!Number.isSafeInteger(missingPhotoCount)||missingPhotoCount<0||
    missingPhotoCount>items.length)throw Error("UPSTREAM_FAILURE");
  const ids=new Set<string>();
  const statuses=new Map<string,number>();
  const types=new Map<string,number>();
  let totalQuantity=0;
  let archivedRecords=0;
  for(const item of items){
    if(typeof item.id!=="string"||!item.id||ids.has(item.id)||
       !Number.isSafeInteger(item.quantity)||
       (item.quantity as number)<0||(item.quantity as number)>1000000||
       (item.archived_at!==null&&typeof item.archived_at!=="string"))
      throw Error("UPSTREAM_FAILURE");
    ids.add(item.id);
    totalQuantity+=item.quantity as number;
    if(!Number.isSafeInteger(totalQuantity))throw Error("UPSTREAM_FAILURE");
    const status=canonical(item.status,statusNames);
    const kind=canonical(item.record_type,typeNames);
    statuses.set(status,(statuses.get(status)||0)+1);
    types.set(kind,(types.get(kind)||0)+1);
    if(item.archived_at!==null||status==="archivado")archivedRecords++;
  }
  return {
    type:"inventory_readonly_summary",
    record_count:items.length,
    quantity_total:totalQuantity,
    missing_photo_records:missingPhotoCount,
    archived_records:archivedRecords,
    statuses:[...statuses].sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([status,count])=>({status,count})),
    record_types:[...types].sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([record_type,count])=>({record_type,count})),
    warning:"Los datos indican registros administrativos, no una inspección física. Ausencia de foto, estado archivado o cantidad cero no prueban pérdida de equipos. No se han leído números de serie, costos, responsables, ubicaciones ni imágenes."
  };
}
