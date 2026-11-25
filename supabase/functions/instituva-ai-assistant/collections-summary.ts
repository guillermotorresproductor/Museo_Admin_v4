import {assertTenantRows} from "./tenant-guard.ts";

type Item={id:string;museum_id:string;status:string};
type Linked={museum_id:string;item_id:string};

export function summarizeCollections(
  items:readonly Item[],photos:readonly Linked[],history:readonly Linked[],
  museumId:string
){
  assertTenantRows(items,museumId);
  assertTenantRows(photos,museumId);
  assertTenantRows(history,museumId);
  const ids=new Set(items.map(item=>item.id));
  if(ids.size!==items.length || items.some(item=>!item.id))throw Error("UPSTREAM_FAILURE");
  // Even a museum-scoped photo/history row must reference one of this
  // museum's visible pieces; no cross-tenant or orphaned references.
  if([...photos,...history].some(row=>!ids.has(row.item_id)))
    throw Error("FORBIDDEN");
  const photoIds=new Set(photos.map(photo=>photo.item_id));
  const historicalIds=new Set(history.map(entry=>entry.item_id));
  const statuses=new Map<string,number>();
  for(const item of items){
    const status=String(item.status||"sin estado").replace(/[\u0000-\u001f]/g," ").trim().slice(0,50);
    statuses.set(status,(statuses.get(status)||0)+1);
  }
  // Summarize only high-level administrative counts: no titles, accession
  // numbers, owners, photos, file paths, values or histories go to the model.
  const grouped=[...statuses].sort((a,b)=>b[1]-a[1]);
  return {
    type:"collections_readonly_summary",
    item_count:items.length,
    photo_count:photos.length,
    history_count:history.length,
    items_without_photos:items.filter(item=>!photoIds.has(item.id)).length,
    items_without_history:items.filter(item=>!historicalIds.has(item.id)).length,
    statuses:grouped.slice(0,12).map(([status,count])=>({status,count})),
    other_status_count:grouped.slice(12).reduce((sum,row)=>sum+row[1],0),
    warning:"Las piezas sin foto o historial no son necesariamente errores. Se verifican contra el expediente y las reglas vigentes. No se han leído fotos ni el contenido de los movimientos."
  };
}
