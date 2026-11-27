import {assertTenantRows} from "./tenant-guard.ts";

export type NotificationEvidenceRow={
  id:string;museum_id:string;recipient_user_id:string;
  category:unknown;read_at:unknown;created_at:unknown;
};
const acceptedCategories=["general","announcement","announcements","reminder",
  "alert","system","security","maintenance","attendance","schedule","schedules",
  "notification","activity","administration","operations"];
const categoryOf=(value:unknown)=>{
  if(typeof value!=="string")return "otro";
  const key=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().trim();
  return acceptedCategories.includes(key)?key:"otro";
};
// Only self notification metadata, scoped to a 30-day period. Never return
// title, message, related entities, recipient identifiers, or timestamps.
export function summarizeSelfNotifications(
  rows:readonly NotificationEvidenceRow[],museumId:string,userId:string,
  since:string,until:string
){
  assertTenantRows(rows,museumId);
  const start=Date.parse(since),end=Date.parse(until);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
    throw Error("UPSTREAM_FAILURE");
  const ids=new Set<string>();
  const categories=new Map<string,{count:number;unread:number}>();
  let unread=0;
  for(const row of rows){
    if(typeof row.id!=="string"||!row.id||ids.has(row.id)||
      row.recipient_user_id!==userId||typeof row.created_at!=="string"||
      (row.read_at!==null&&typeof row.read_at!=="string"))
      throw Error(row.recipient_user_id!==userId?"FORBIDDEN":"UPSTREAM_FAILURE");
    const created=Date.parse(row.created_at);
    if(!Number.isFinite(created)||created<start||created>end)throw Error("UPSTREAM_FAILURE");
    if(row.read_at!==null&&!Number.isFinite(Date.parse(row.read_at)))
      throw Error("UPSTREAM_FAILURE");
    ids.add(row.id);
    const category=categoryOf(row.category);
    const entry=categories.get(category)||{count:0,unread:0};
    entry.count++;
    if(row.read_at===null){unread++;entry.unread++;}
    categories.set(category,entry);
  }
  return {
    type:"self_notifications_readonly_summary",
    scope:"mis notificaciones de los últimos 30 días",
    notification_count:rows.length,
    unread_count:unread,
    read_count:rows.length-unread,
    categories:[...categories].sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([category,counts])=>({category,...counts})),
    warning:"La presencia de una notificación indica un registro interno, no entrega de correo, SMS ni aviso push. La ausencia de registros no prueba falla de envío. Solo se han contado notificaciones de esta misma cuenta; no se consultaron mensajes de otros empleados."
  };
}
