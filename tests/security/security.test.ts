import assert from "node:assert/strict";
import test from "node:test";
import { canAccessStore, hasRequiredRole } from "../../lib/access-control.ts";
import {
  createRecoveryCode,
  hashOpaqueToken,
  hashPassword,
  PASSWORD_ITERATIONS,
  verifyPassword,
} from "../../lib/auth/crypto.ts";
import {
  hasValidImageSignature,
  isSafeReturnPath,
  isTrustedMutation,
  isValidInvitationToken,
  readJsonBody,
  RequestSecurityError,
  safeUploadFilename,
  sanitizeWebUrl,
} from "../../lib/security.ts";
import {
  createSupabaseBucketAdapter,
  encodeStorageKey,
} from "../../lib/supabase-storage.ts";

function mutationRequest(
  headers: Record<string, string>,
  body = "{}",
): Request {
  return new Request("https://oxemenu.test/api/action", {
    method: "POST",
    headers,
    body,
  });
}

test("mutações aceitam apenas sinais da mesma origem", () => {
  assert.equal(
    isTrustedMutation(
      mutationRequest({ origin: "https://oxemenu.test" }),
    ),
    true,
  );
  assert.equal(
    isTrustedMutation(mutationRequest({ "sec-fetch-site": "same-origin" })),
    true,
  );
  assert.equal(
    isTrustedMutation(mutationRequest({ origin: "https://attacker.test" })),
    false,
  );
  assert.equal(isTrustedMutation(mutationRequest({})), false);
});

test("JSON exige Content-Type correto e respeita o limite real", async () => {
  const valid = mutationRequest(
    {
      origin: "https://oxemenu.test",
      "content-type": "application/json; charset=utf-8",
    },
    '{"ok":true}',
  );
  assert.deepEqual(await readJsonBody<{ ok: boolean }>(valid), { ok: true });

  await assert.rejects(
    () =>
      readJsonBody(
        mutationRequest({ origin: "https://oxemenu.test" }, '{"ok":true}'),
      ),
    (error) =>
      error instanceof RequestSecurityError && error.status === 415,
  );

  await assert.rejects(
    () =>
      readJsonBody(
        mutationRequest(
          {
            origin: "https://oxemenu.test",
            "content-type": "application/json",
          },
          '"0123456789"',
        ),
        8,
      ),
    (error) =>
      error instanceof RequestSecurityError && error.status === 413,
  );
});

test("retornos locais não permitem redirecionamento externo", () => {
  assert.equal(isSafeReturnPath("/painel?aba=produtos"), true);
  assert.equal(isSafeReturnPath("//attacker.test"), false);
  assert.equal(isSafeReturnPath("/%5c%5cattacker.test"), false);
  assert.equal(isSafeReturnPath("/\\attacker.test"), false);
  assert.equal(isSafeReturnPath("https://attacker.test"), false);
});

test("URLs armazenadas bloqueiam protocolos ativos e credenciais", () => {
  assert.equal(
    sanitizeWebUrl("https://example.com/cardapio"),
    "https://example.com/cardapio",
  );
  assert.equal(
    sanitizeWebUrl("/api/media/id", { allowRelative: true }),
    "/api/media/id",
  );
  assert.throws(() => sanitizeWebUrl("javascript:alert(1)"));
  assert.throws(() => sanitizeWebUrl("data:text/html,unsafe"));
  assert.throws(() => sanitizeWebUrl("http://example.com"));
  assert.throws(() => sanitizeWebUrl("https://user:pass@example.com"));
});

test("upload valida assinatura real e normaliza o nome", () => {
  assert.equal(
    hasValidImageSignature(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ),
    true,
  );
  assert.equal(
    hasValidImageSignature(new TextEncoder().encode("<svg onload=x>"), "image/png"),
    false,
  );
  assert.equal(safeUploadFilename("../../foto.png"), "foto.png");
});

test("proxy de Storage recebe somente a credencial restrita", async () => {
  const previous = {
    url: process.env.SUPABASE_URL,
    proxy: process.env.OXEMENU_STORAGE_PROXY_KEY,
    modern: process.env.SUPABASE_SECRET_KEY,
    legacy: process.env.SUPABASE_SERVICE_ROLE_KEY,
    fetch: globalThis.fetch,
  };
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.OXEMENU_STORAGE_PROXY_KEY = "proxy-test-secret";
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let captured: { url: string; method: string; headers: Headers } | undefined;
  globalThis.fetch = async (input, init) => {
    captured = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    };
    return new Response(null, { status: 204 });
  };

  try {
    const bucket = createSupabaseBucketAdapter();
    await bucket.put(
      "store-coffe-love/01234567-89ab-4cde-8fab-0123456789ab.png",
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
      { httpMetadata: { contentType: "image/png" } },
    );
    assert.ok(captured);
    assert.equal(
      captured.url,
      "https://project.supabase.co/functions/v1/oxemenu-storage/object/" +
        "store-coffe-love/01234567-89ab-4cde-8fab-0123456789ab.png",
    );
    assert.equal(captured.method, "PUT");
    assert.equal(
      captured.headers.get("x-oxemenu-storage-key"),
      "proxy-test-secret",
    );
    assert.equal(captured.headers.has("authorization"), false);
    assert.equal(captured.headers.has("apikey"), false);
    assert.equal(encodeStorageKey("loja A/foto 1.png"), "loja%20A/foto%201.png");
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    if (previous.proxy === undefined) delete process.env.OXEMENU_STORAGE_PROXY_KEY;
    else process.env.OXEMENU_STORAGE_PROXY_KEY = previous.proxy;
    if (previous.modern === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previous.modern;
    if (previous.legacy === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.legacy;
  }
});

test("matriz de acesso impede isolamento horizontal e vertical indevido", () => {
  const admin = { role: "admin" as const, email: "admin@oxemenu.test" };
  const owner = { role: "merchant" as const, email: "LOJA-A@EXAMPLE.COM" };
  const other = { role: "merchant" as const, email: "loja-b@example.com" };

  assert.equal(canAccessStore(admin, "loja-a@example.com"), true);
  assert.equal(canAccessStore(owner, "loja-a@example.com"), true);
  assert.equal(canAccessStore(other, "loja-a@example.com"), false);
  assert.equal(canAccessStore(other, null), false);
  assert.equal(hasRequiredRole(admin, ["admin"]), true);
  assert.equal(hasRequiredRole(other, ["admin"]), false);
});

test("convites exigem token criptográfico no formato gerado", () => {
  assert.equal(isValidInvitationToken("AbCdEf0123456789_-AbCdEf01234567"), true);
  assert.equal(isValidInvitationToken(""), false);
  assert.equal(isValidInvitationToken("codigo-curto"), false);
  assert.equal(isValidInvitationToken("../token-invalido-000000000000000"), false);
});

test("códigos de recuperação são aleatórios e armazenáveis apenas por hash", async () => {
  const codes = new Set(Array.from({ length: 100 }, () => createRecoveryCode()));
  assert.equal(codes.size, 100);
  for (const code of codes) {
    assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.notEqual(await hashOpaqueToken(code), code);
  }
});

test("hash de senha usa custo atual e verifica custo versionado", async () => {
  assert.equal(PASSWORD_ITERATIONS, 600_000);
  const password = await hashPassword("SenhaForte123", undefined, 2_000);
  assert.equal(
    await verifyPassword("SenhaForte123", password.hash, password.salt, 2_000),
    true,
  );
  assert.equal(
    await verifyPassword("SenhaErrada123", password.hash, password.salt, 2_000),
    false,
  );
});
