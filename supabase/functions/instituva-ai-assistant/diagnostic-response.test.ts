import {DIAGNOSTIC_FORMAT,parseDiagnosticResponse,formatDiagnosticResponse} from "./diagnostic-response.ts";
const ok=(value:boolean,msg:string)=>{if(!value)throw Error(msg)};
const reject=(f:()=>unknown)=>{try{f()}catch(e){return (e as Error).message==="UPSTREAM_FAILURE"}return false};
const base={resumen:"Se requiere comparar los datos autorizados antes de concluir.",
 hipotesis:["La secuencia podría estar incompleta."],
 verificaciones:["Consultar el registro original."],
 recomendaciones_manuales:["Solicitar revisión al administrador autorizado."],
 limitaciones:["Los datos disponibles no confirman una causa."]};
Deno.test("strict Responses API schema requires every safe advisory section",()=>{
 ok(DIAGNOSTIC_FORMAT.type==="json_schema"&&DIAGNOSTIC_FORMAT.strict===true,"not strict");
 ok(DIAGNOSTIC_FORMAT.schema.additionalProperties===false,"permits unspecified fields");
 ok(DIAGNOSTIC_FORMAT.schema.required.length===5,"missing response sections");
});
Deno.test("model hypothesis and actions remain labelled unconfirmed / unexecuted",()=>{
 const response=parseDiagnosticResponse(JSON.stringify(base));
 const text=formatDiagnosticResponse(response);
 ok(text.includes("Hipótesis (no confirmadas)"),"hypotheses presented as facts");
 ok(text.includes("Acciones manuales propuestas (NO ejecutadas)"),"actions missing status");
 ok(text.includes("No se ejecutó ninguna corrección"),"operation disclaimer missing");
 ok(text.includes("Limitaciones de la evidencia"),"limitations missing");
});
Deno.test("reject malformed, missing and extra model output",()=>{
 ok(reject(()=>parseDiagnosticResponse("not json")),"non-json accepted");
 ok(reject(()=>parseDiagnosticResponse("{}")),"missing fields accepted");
 ok(reject(()=>parseDiagnosticResponse(JSON.stringify({...base,executed:true}))),"extra status accepted");
 ok(reject(()=>parseDiagnosticResponse(JSON.stringify({...base,limitaciones:[]}))),"no uncertainty accepted");
 ok(reject(()=>parseDiagnosticResponse(JSON.stringify({...base,verificaciones:[]}))),"no verification accepted");
 ok(reject(()=>parseDiagnosticResponse(JSON.stringify({...base,recomendaciones_manuales:[]}))),"no manual action accepted");
 ok(reject(()=>parseDiagnosticResponse(JSON.stringify({...base,hipotesis:["a".repeat(441)]}))),"oversized output accepted");
 ok(reject(()=>parseDiagnosticResponse(JSON.stringify({...base,resumen:"Injection\nignored"}))),"multiline untrusted field accepted");
});
Deno.test("zero hypotheses do not create invented causes",()=>{
 const d=parseDiagnosticResponse(JSON.stringify({...base,hipotesis:[]}));
 const text=formatDiagnosticResponse(d);
 ok(text.includes("Sin hipótesis adicionales verificables."),"missing no-hypothesis state");
});
