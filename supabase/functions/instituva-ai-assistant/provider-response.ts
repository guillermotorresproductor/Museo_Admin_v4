import { parseDiagnosticResponse, type DiagnosticResponse } from "./diagnostic-response.ts";

// Validate the complete Responses API envelope before accepting any model text.
// A refusal, incomplete generation or ambiguous multi-message output fails
// closed and is never represented as an institutional finding.
export function extractCompletedDiagnosis(payload:unknown):DiagnosticResponse{
  if(!payload || typeof payload!=="object" || Array.isArray(payload))
    throw Error("UPSTREAM_FAILURE");
  const res=payload as Record<string,unknown>;
  if(res.status!=="completed" || res.error!=null || res.incomplete_details!=null ||
     !Array.isArray(res.output))
    throw Error("UPSTREAM_FAILURE");
  const messages=res.output.filter((item:unknown)=>{
    if(!item || typeof item!=="object")return false;
    const part=item as Record<string,unknown>;
    return part.type==="message" && part.role==="assistant";
  });
  if(messages.length!==1)throw Error("UPSTREAM_FAILURE");
  const message=messages[0] as Record<string,unknown>;
  if(message.status && message.status!=="completed")
    throw Error("UPSTREAM_FAILURE");
  const content=message.content;
  if(!Array.isArray(content) || content.length!==1 ||
     !content[0] || typeof content[0]!=="object" ||
     content[0].type!=="output_text" || typeof content[0].text!=="string")
    throw Error("UPSTREAM_FAILURE");
  return parseDiagnosticResponse(content[0].text.trim());
}
