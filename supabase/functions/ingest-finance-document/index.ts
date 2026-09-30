import { corsHeaders, errorResponse, json, requirePermission } from "../_shared/security.ts";
import { ingestInvoice } from "./ingest.mjs";

function isUncertain(error: { message?: string; code?: string; status?: number }) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 504
    || error?.status === 408
    || message.includes("timeout")
    || message.includes("fetch failed")
    || message.includes("network");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", error: "Método no permitido." }, 405);

  try {
    const { admin, caller, user, profile } = await requirePermission(req, "finance.write");
    const { data: canRead, error: readError } = await caller.rpc("has_permission", { requested_permission: "finance.read" });
    if (readError || canRead !== true) return json({ code: "FORBIDDEN", error: "No tiene permiso para registrar facturas." }, 403);
    const { data: administration, error: moduleError } = await caller.rpc("module_profile_allows", { module_code: "administration" });
    if (moduleError || administration !== true) {
      return json({ code: "MODULE_FORBIDDEN", error: "Esta operación pertenece a Administración." }, 403);
    }

    const form = await req.formData();
    const entry = form.get("file");
    if (!(entry instanceof File)) return json({ code: "FILE_REQUIRED", error: "Falta el archivo." }, 400);
    const bytes = new Uint8Array(await entry.arrayBuffer());

    const outcome = await ingestInvoice({
      session: {
        userId: user.id,
        museumId: profile.museum_id,
        profileStatus: profile.status,
        financeWrite: true,
        financeRead: true,
        administration: true
      },
      file: { bytes, filename: entry.name, declaredType: entry.type },
      newId: () => crypto.randomUUID(),
      db: {
        async findActiveDuplicate(museumId: string, sha256: string) {
          const { data, error } = await admin.from("finance_documents")
            .select("id")
            .eq("museum_id", museumId)
            .eq("original_sha256", sha256)
            .in("status", ["pending_review", "confirmed"])
            .limit(1);
          if (error) throw Object.assign(new Error("INGEST_FAILED"), { code: "INGEST_FAILED" });
          return data?.[0] || null;
        },
        async insertPending(row: {
          actorId: string;
          museumId: string;
          documentId: string;
          filename: string;
          mime: string;
          byteSize: number;
          sha256: string;
        }) {
          const { data, error } = await admin.rpc("create_finance_document_pending", {
            p_actor: row.actorId,
            p_museum: row.museumId,
            p_document_id: row.documentId,
            p_filename: row.filename,
            p_mime: row.mime,
            p_byte_size: row.byteSize,
            p_sha256: row.sha256
          });
          if (error) {
            const duplicate = String(error.message || "").includes("DUPLICATE_DOCUMENT") || error.code === "23505";
            throw Object.assign(new Error(duplicate ? "DUPLICATE_DOCUMENT" : "INSERT_FAILED"), {
              code: duplicate ? "DUPLICATE_DOCUMENT" : (isUncertain(error) ? "INSERT_UNCERTAIN" : "INGEST_FAILED")
            });
          }
          return data;
        },
        async findById(museumId: string, documentId: string) {
          const { data, error } = await admin.from("finance_documents")
            .select("id,status,original_filename,original_mime,original_byte_size,uploaded_at")
            .eq("museum_id", museumId)
            .eq("id", documentId)
            .maybeSingle();
          if (error) throw Object.assign(new Error("LOOKUP_FAILED"), { code: "LOOKUP_FAILED" });
          return data;
        }
      },
      storage: {
        async uploadOriginal(upload: { path: string; bytes: Uint8Array; mime: string; upsert: boolean }) {
          if (upload.upsert !== false) throw Object.assign(new Error("UPLOAD_FAILED"), { code: "UPLOAD_FAILED" });
          const { error } = await admin.storage.from("finance-documents").upload(upload.path, upload.bytes, {
            upsert: false,
            contentType: upload.mime
          });
          if (error) throw Object.assign(new Error("UPLOAD_FAILED"), { code: "UPLOAD_FAILED" });
        },
        async removeOriginal(path: string) {
          const { error } = await admin.storage.from("finance-documents").remove([path]);
          if (error) throw Object.assign(new Error("COMPENSATION_FAILED"), { code: "COMPENSATION_FAILED" });
        }
      }
    });

    return json(outcome.body, outcome.httpStatus);
  } catch (error) {
    return errorResponse(error);
  }
});
