import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  assertStoreAccess,
  DataError,
  getBucket,
  saveMediaRecord,
} from "@/lib/server-data";

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
    const actor = await requireRequestActor(request);
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

    const storageKey = `${establishmentId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    await getBucket().put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: actor.email },
    });
    const saved = await saveMediaRecord({
      establishmentId,
      uploadedByEmail: actor.email,
      storageKey,
      filename: file.name.slice(0, 180),
      contentType: file.type,
      sizeBytes: file.size,
    });
    return Response.json(saved, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
