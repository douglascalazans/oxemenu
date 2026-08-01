import { apiError } from "@/lib/request-auth";
import {
  getBucket,
  getMediaRecord,
} from "@/lib/server-data";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const record = await getMediaRecord(id);
    if (!record) return new Response("Imagem não encontrada.", { status: 404 });
    const object = await getBucket().get(record.storageKey, {
      onlyIf: request.headers,
    });
    if (!object) return new Response("Imagem não encontrada.", { status: 404 });
    if (!("body" in object)) return new Response(null, { status: 304 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  } catch (error) {
    return apiError(error);
  }
}
