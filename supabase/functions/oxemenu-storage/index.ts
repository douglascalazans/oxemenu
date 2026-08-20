import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const BUCKET = "oxemenu-media";
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const EXPECTED_PROXY_KEY_HASH =
  "83e5e2b4a517c6035ca366cd31afa47c42bd5ba970e755df22c032d82dbb479b";
const CONTENT_TYPES = new Map([
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
]);

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function isAuthorized(request: Request) {
  const provided = request.headers.get("x-oxemenu-storage-key") ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(provided),
  );
  const actual = toHex(digest);
  if (actual.length !== EXPECTED_PROXY_KEY_HASH.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ EXPECTED_PROXY_KEY_HASH.charCodeAt(index);
  }
  return mismatch === 0;
}

function storageClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Storage runtime unavailable");
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).storage;
}

function objectKey(request: Request) {
  const marker = "/object/";
  const pathname = new URL(request.url).pathname;
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return null;
  let decoded: string;
  try {
    decoded = pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  } catch {
    return null;
  }
  const match = decoded.match(
    /^([a-zA-Z0-9][a-zA-Z0-9_-]{1,127})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|webp|gif)$/i,
  );
  if (!match) return null;
  return { key: decoded, extension: match[3].toLowerCase() };
}

function hasValidSignature(bytes: Uint8Array, contentType: string) {
  const startsWith = (signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (contentType === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
  if (contentType === "image/png") {
    return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/webp") {
    return startsWith([0x52, 0x49, 0x46, 0x46]) &&
      [0x57, 0x45, 0x42, 0x50].every((value, index) => bytes[index + 8] === value);
  }
  if (contentType === "image/gif") {
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }
  return false;
}

async function ensureBucket() {
  const storage = storageClient();
  const { error } = await storage.getBucket(BUCKET);
  if (!error) return storage;
  const { error: createError } = await storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Array.from(CONTENT_TYPES.values()),
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }
  return storage;
}

Deno.serve(async (request: Request) => {
  try {
    if (!(await isAuthorized(request))) {
      return textResponse("Não autorizado.", 401);
    }

    const object = objectKey(request);
    if (!object) return textResponse("Caminho inválido.", 400);
    const expectedType = CONTENT_TYPES.get(object.extension);
    if (!expectedType) return textResponse("Tipo inválido.", 415);
    const storage = await ensureBucket();

    if (request.method === "PUT") {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType !== expectedType) {
        return textResponse("Tipo de imagem inválido.", 415);
      }
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (!Number.isFinite(declaredLength) || declaredLength > MAX_FILE_SIZE) {
        return textResponse("Imagem muito grande.", 413);
      }
      const body = await request.arrayBuffer();
      if (body.byteLength === 0 || body.byteLength > MAX_FILE_SIZE) {
        return textResponse("Imagem inválida.", body.byteLength ? 413 : 400);
      }
      if (!hasValidSignature(new Uint8Array(body.slice(0, 16)), contentType)) {
        return textResponse("Conteúdo de imagem inválido.", 415);
      }
      const { error } = await storage.from(BUCKET).upload(object.key, body, {
        contentType,
        upsert: true,
      });
      if (error) throw error;
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (request.method === "GET") {
      const { data, error } = await storage.from(BUCKET).download(object.key);
      if (error) {
        if (/not found|does not exist/i.test(error.message)) {
          return textResponse("Imagem não encontrada.", 404);
        }
        throw error;
      }
      return new Response(data, {
        headers: {
          "Content-Type": data.type || expectedType,
          "Content-Length": String(data.size),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return textResponse("Método não permitido.", 405);
  } catch (error) {
    console.error("oxemenu-storage", error);
    return textResponse("Falha no armazenamento.", 503);
  }
});
