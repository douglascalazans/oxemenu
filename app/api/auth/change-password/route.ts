import {
  changePassword,
  clearSessionCookie,
  getRequestSession,
  isSameOrigin,
} from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const user = await getRequestSession(request);
  if (!user) {
    return Response.json({ error: "Sua sessão expirou." }, { status: 401 });
  }
  let payload: { currentPassword?: string; newPassword?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!payload.currentPassword || !payload.newPassword) {
    return Response.json(
      { error: "Informe a senha atual e a nova senha." },
      { status: 400 },
    );
  }
  const result = await changePassword({
    user,
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie(request) } },
  );
}
