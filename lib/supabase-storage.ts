import { DataError } from "./data-error.ts";

const BUCKET = "oxemenu-media";

type StorageConfiguration =
  | { kind: "direct"; baseUrl: string; serviceKey: string }
  | { kind: "proxy"; proxyUrl: string; proxyKey: string };

function storageConfiguration(): StorageConfiguration {
  const baseUrl = (
    process.env.SUPABASE_URL ?? process.env.SUPABASE_DATABASE_URL
  )?.replace(/\/$/, "");
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (baseUrl && serviceKey) {
    return { kind: "direct", baseUrl, serviceKey };
  }

  const proxyKey = process.env.OXEMENU_STORAGE_PROXY_KEY;
  const proxyUrl = (
    process.env.SUPABASE_STORAGE_PROXY_URL ??
    (baseUrl ? `${baseUrl}/functions/v1/oxemenu-storage` : undefined)
  )?.replace(/\/$/, "");
  if (!proxyUrl || !proxyKey) {
    throw new DataError("O armazenamento de fotos não está disponível.", 503);
  }
  return { kind: "proxy", proxyUrl, proxyKey };
}

function headers(contentType?: string) {
  const configuration = storageConfiguration();
  const value = new Headers();
  if (configuration.kind === "direct") {
    value.set("apikey", configuration.serviceKey);
    if (!configuration.serviceKey.startsWith("sb_secret_")) {
      value.set("Authorization", `Bearer ${configuration.serviceKey}`);
    }
  } else {
    value.set("x-oxemenu-storage-key", configuration.proxyKey);
  }
  if (contentType) value.set("Content-Type", contentType);
  return value;
}

export function encodeStorageKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function storageObjectUrl(configuration: StorageConfiguration, key: string) {
  const encodedKey = encodeStorageKey(key);
  return configuration.kind === "direct"
    ? `${configuration.baseUrl}/storage/v1/object/${BUCKET}/${encodedKey}`
    : `${configuration.proxyUrl}/object/${encodedKey}`;
}

function storageDownloadUrl(configuration: StorageConfiguration, key: string) {
  const encodedKey = encodeStorageKey(key);
  return configuration.kind === "direct"
    ? `${configuration.baseUrl}/storage/v1/object/authenticated/${BUCKET}/${encodedKey}`
    : `${configuration.proxyUrl}/object/${encodedKey}`;
}

let bucketReady: Promise<void> | null = null;

async function ensureBucket() {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const configuration = storageConfiguration();
    if (configuration.kind === "proxy") return;
    const { baseUrl } = configuration;
    const response = await fetch(`${baseUrl}/storage/v1/bucket/${BUCKET}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (response.ok) return;
    if (response.status !== 404) {
      throw new DataError("Não foi possível acessar o armazenamento de fotos.", 503);
    }
    const created = await fetch(`${baseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: headers("application/json"),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    });
    if (!created.ok && created.status !== 409) {
      throw new DataError("Não foi possível preparar o armazenamento de fotos.", 503);
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

export function createSupabaseBucketAdapter(): R2Bucket {
  return {
    async put(key, value, options) {
      await ensureBucket();
      const configuration = storageConfiguration();
      const body =
        value instanceof ReadableStream
          ? await new Response(value).arrayBuffer()
          : value;
      const response = await fetch(
        storageObjectUrl(configuration, key),
        {
          method: configuration.kind === "direct" ? "POST" : "PUT",
          headers: (() => {
            const valueHeaders = headers(
              options?.httpMetadata && "contentType" in options.httpMetadata
                ? options.httpMetadata.contentType
                : "application/octet-stream",
            );
            valueHeaders.set("x-upsert", "true");
            return valueHeaders;
          })(),
          body: body as BodyInit,
        },
      );
      if (!response.ok) {
        throw new DataError("Não foi possível enviar a foto.", 503);
      }
      return {
        key,
        version: "",
        size: Number(response.headers.get("content-length") ?? 0),
        etag: response.headers.get("etag") ?? "",
        httpEtag: response.headers.get("etag") ?? "",
        uploaded: new Date(),
        checksums: {},
        storageClass: "Standard",
        writeHttpMetadata() {},
      } as unknown as R2Object;
    },
    async get(key) {
      await ensureBucket();
      const configuration = storageConfiguration();
      const response = await fetch(
        storageDownloadUrl(configuration, key),
        { headers: headers(), cache: "no-store" },
      );
      if (response.status === 404) return null;
      if (!response.ok || !response.body) {
        throw new DataError("Não foi possível carregar a foto.", 503);
      }
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const etag = response.headers.get("etag") ?? `"${key}"`;
      return {
        key,
        version: "",
        size: Number(response.headers.get("content-length") ?? 0),
        etag,
        httpEtag: etag,
        uploaded: new Date(),
        checksums: {},
        storageClass: "Standard",
        body: response.body,
        bodyUsed: false,
        arrayBuffer: () => response.arrayBuffer(),
        text: () => response.text(),
        json: () => response.json(),
        blob: () => response.blob(),
        writeHttpMetadata(target: Headers) {
          target.set("Content-Type", contentType);
        },
      } as unknown as R2ObjectBody;
    },
  } as R2Bucket;
}
