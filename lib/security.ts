const JSON_CONTENT_TYPE = "application/json";

export const MAX_JSON_BODY_BYTES = 64 * 1024;
export const MAX_UPLOAD_REQUEST_BYTES = 7 * 1024 * 1024;

export class RequestSecurityError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestSecurityError";
    this.status = status;
  }
}

export function isNonEmptyString(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

function contentLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function isTrustedMutation(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === requestOrigin;

  // Modern browsers send Fetch Metadata even when Origin is omitted. Requests
  // without either signal are denied because every mutation is browser-only.
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function assertTrustedMutation(request: Request): void {
  if (!isTrustedMutation(request)) {
    throw new RequestSecurityError("Origem da solicitação inválida.", 403);
  }
}

export function assertContentLength(
  request: Request,
  maximumBytes: number,
  requireHeader = false,
): void {
  const length = contentLength(request);
  if (requireHeader && length === null) {
    throw new RequestSecurityError("Tamanho da solicitação não informado.", 411);
  }
  if (length !== null && length > maximumBytes) {
    throw new RequestSecurityError("A solicitação é muito grande.", 413);
  }
}

export async function readJsonBody<T>(
  request: Request,
  maximumBytes = MAX_JSON_BODY_BYTES,
): Promise<T> {
  assertTrustedMutation(request);
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith(JSON_CONTENT_TYPE)) {
    throw new RequestSecurityError("Envie os dados em formato JSON.", 415);
  }
  assertContentLength(request, maximumBytes);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new RequestSecurityError("A solicitação é muito grande.", 413);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestSecurityError("Dados inválidos.", 400);
  }
}

export function isSafeReturnPath(value: string | undefined): boolean {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return false;
    }
    const parsed = new URL(value, "https://oxemenu.invalid");
    return parsed.origin === "https://oxemenu.invalid";
  } catch {
    return false;
  }
}

export function isValidInvitationToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(value.trim());
}

export function sanitizeWebUrl(
  value: unknown,
  options: { allowRelative?: boolean; maxLength?: number } = {},
): string {
  const maximum = options.maxLength ?? 600;
  const candidate = String(value ?? "").trim();
  if (!candidate) return "";
  if (candidate.length > maximum || /[\u0000-\u001f\u007f]/.test(candidate)) {
    throw new RequestSecurityError("Informe um endereço válido.");
  }
  if (
    options.allowRelative &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
  ) {
    return candidate;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("unsafe protocol");
    }
    return parsed.toString();
  } catch {
    throw new RequestSecurityError("Use um endereço HTTPS válido.");
  }
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function hasValidImageSignature(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  if (contentType === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (contentType === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/webp") {
    return (
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
    );
  }
  if (contentType === "image/gif") {
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }
  return false;
}

export function safeUploadFilename(value: string): string {
  const leaf = value.split(/[\\/]/).pop() ?? "imagem";
  const clean = leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "imagem").slice(0, 180);
}
