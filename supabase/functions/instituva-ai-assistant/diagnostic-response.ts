// Closed diagnosis response contract. The model is advisory only:
// raw model text is never directly displayed as a completed operation.
// The factual evidence summary and sources are constructed by the server.
const keys=["resumen","hipotesis","verificaciones","recomendaciones_manuales","limitaciones"] as const;
type Field=typeof keys[number];
export const DIAGNOSTIC_FORMAT={
  type:"json_schema",
  name:"instituva_incident_diagnostic_v1",
  strict:true,
  schema:{
    type:"object",
    additionalProperties:false,
    properties:{
      resumen:{type:"string"},
      hipotesis:{type:"array",items:{type:"string"}},
      verificaciones:{type:"array",items:{type:"string"}},
      recomendaciones_manuales:{type:"array",items:{type:"string"}},
      limitaciones:{type:"array",items:{type:"string"}}
    },
    required:[...keys]
  }
} as const;

export type DiagnosticResponse={
  resumen:string;hipotesis:string[];verificaciones:string[];
  recomendaciones_manuales:string[];limitaciones:string[];
};
const line=(value:unknown,max:number):string=>{
  if(typeof value!=="string"||!value.trim()||value.length>max||
    /[\u0000-\u001f\u007f]/.test(value))throw Error("UPSTREAM_FAILURE");
  return value.trim();
};
const list=(value:unknown,min:number,max:number):string[]=>{
  if(!Array.isArray(value)||value.length<min||value.length>max)
    throw Error("UPSTREAM_FAILURE");
  return value.map(v=>line(v,440));
};
export function parseDiagnosticResponse(raw:unknown):DiagnosticResponse{
  if(typeof raw!=="string"||raw.length>8000)throw Error("UPSTREAM_FAILURE");
  let data:Record<string,unknown>;
  try{data=JSON.parse(raw)}catch{throw Error("UPSTREAM_FAILURE")}
  if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).length!==keys.length||
    Object.keys(data).some(k=>!keys.includes(k as Field)))
    throw Error("UPSTREAM_FAILURE");
  return {
    resumen:line(data.resumen,900),
    hipotesis:list(data.hipotesis,0,4),
    verificaciones:list(data.verificaciones,0,5),
    recomendaciones_manuales:list(data.recomendaciones_manuales,0,5),
    limitaciones:list(data.limitaciones,0,4)
  };
}
// All guide steps come only from the parsed, bounded advisory response.
// The client advances these steps locally; no model/tool or operational action is invoked.
export type ManualGuideStep={phase:"verificar"|"accion_manual";text:string};
export function buildManualGuide(d:DiagnosticResponse):ManualGuideStep[]{
  return [
    ...d.verificaciones.map(text=>({phase:"verificar" as const,text})),
    ...d.recomendaciones_manuales.map(text=>({phase:"accion_manual" as const,text}))
  ];
}

// The API remains a verified, closed five-field JSON contract, but the user sees
// a direct answer. Empty advisory sections never become boilerplate.
export function formatDiagnosticResponse(d:DiagnosticResponse):string{
  const section=(heading:string,items:readonly string[])=>
    items.length?heading+"\n"+items.map(item=>"- "+item).join("\n"):"";
  return [
    d.resumen,
    section("Qué comprobar",d.verificaciones),
    section("Qué hacer",d.recomendaciones_manuales),
    section("Posibles causas (sin confirmar)",d.hipotesis),
    section("Dato pendiente",d.limitaciones)
  ].filter(Boolean).join("\n\n");
}
