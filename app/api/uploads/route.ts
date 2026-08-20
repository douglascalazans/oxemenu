import { apiError, requireRequestActor } from "@/lib/request-auth";
import { enforceAuthRateLimit } from "@/lib/auth/server";
import {
  assertStoreAccess,
  DataError,
  getBucket,
  saveMediaRecord,
} from "@/lib/server-data";
import {
  assertContentLength,
  assertTrustedMutation,
  hasValidImageSignature,
  MAX_UPLOAD_REQUEST_BYTES,
  RequestSecurityError,
  safeUploadFilename,
} from "@/lib/security";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;")) {
      throw new RequestSecurityError("Envie a foto como formulário.", 415);
    }
    assertContentLength(request, MAX_UPLOAD_REQUEST_BYTES, true);
    const actor = await requireRequestActor(request);
    await enforceAuthRateLimit({
      request,
      action: "upload-media",
      subject: actor.email,
      maximum: 30,
      windowMinutes: 15,
    });
    const form = await request.formData();
    const establishmentId = String(form.get("establishmentId") ?? "");
    const file = form.get("file");
    if (!establishmentId) {
      throw new DataError("Estabelecimento inválido.");
    }
    await assertStoreAccess(actor, establishmentId);
    if (!(file instanceof File)) {
      throw new DataError("Escolha uma foto.");
    }
    if (!allowedTypes.has(file.type)) {
      throw new DataError("Use uma imagem JPG, PNG, WEBP ou GIF.");
    }
    if (file.size > 6 * 1024 * 1024) {
      throw new DataError("A foto deve ter no máximo 6 MB.");
    }
    if (file.size === 0) {
      throw new DataError("A foto está vazia.");
    }
    const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!hasValidImageSignature(signature, file.type)) {
      throw new DataError("O conteúdo do arquivo não corresponde a uma imagem válida.");
    }

    const storageKey = `${establishmentId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    await getBucket().put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    const saved = await saveMediaRecord({
      establishmentId,
      uploadedByEmail: actor.email,
      storageKey,
      filename: safeUploadFilename(file.name),
      contentType: file.type,
      sizeBytes: file.size,
    });
    return Response.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
