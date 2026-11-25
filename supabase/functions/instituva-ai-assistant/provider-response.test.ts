import {extractCompletedDiagnosis} from "./provider-response.ts";
const good={
  resumen:"Se observan registros autorizados sin causa confirmada.",
  hipotesis:["Podría existir una incidencia pendiente."],
  verificaciones:["Revisar la información del módulo autorizado."],
  recomendaciones_manuales:["Solicitar revisión a personal autorizado."],
  limitaciones:["El contexto disponible no prueba la causa."]
};
const envelope=(content:unknown,extra:Record<string,unknown>={})=>({
  status:"completed",error:null,incomplete_details:null,
  output:[{type:"message",role:"assistant",status:"completed",content}],
  ...extra
});
const output={type:"output_text",text:JSON.stringify(good),annotations:[]};
const fail=(value:unknown,label:string)=>{
  try{extractCompletedDiagnosis(value)}catch(e){
    if((e as Error).message==="UPSTREAM_FAILURE")return;
    throw Error(label+": unexpected exception "+String(e));
  }
  throw Error(label+": accepted unsafe provider response");
};
Deno.test("Responses API valid completed assistant output produces structured advisory diagnosis",()=>{
  const d=extractCompletedDiagnosis(envelope([output]));
  if(d.resumen!==good.resumen || d.verificaciones.length!==1 || d.limitaciones.length!==1)
    throw Error("valid response lost evidence");
});
Deno.test("refusals, incomplete generations and malformed content fail closed",()=>{
  fail(envelope([{type:"refusal",refusal:"I cannot help"}]),"refusal");
  fail(envelope([output],{status:"incomplete",incomplete_details:{reason:"max_output_tokens"}}),"incomplete");
  fail(envelope([output],{error:{code:"failed"}}),"provider error");
  fail(envelope([]),"missing content");
  fail(envelope([output,output]),"multiple content parts");
  fail(envelope([{type:"output_text",text:"not valid JSON"}]),"malformed JSON");
  fail(null,"null payload");
});
Deno.test("ambiguous assistant messages and forged non-assistant text are rejected",()=>{
  fail({status:"completed",output:[
    {type:"message",role:"assistant",content:[output]},
    {type:"message",role:"assistant",content:[output]}
  ]},"multiple assistants");
  fail({status:"completed",output:[
    {type:"message",role:"user",content:[output]}
  ]},"forged user output");
  fail({status:"completed",output:[
    {type:"message",role:"assistant",status:"incomplete",content:[output]}
  ]},"incomplete assistant message");
  fail({status:"completed",output:[
    {type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify({...good,executed:true})}]}
  ]},"extra operational authority");
});
