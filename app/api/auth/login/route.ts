import { isSameOrigin, loginWithPassword } from "@/lib/auth/server";
import type { AppRole } from "@/lib/auth/types";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  let payload: { email?: string; password?: string; role?: AppRole };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Dados de acesso inválidos." }, { status: 400 });
  }
  if (
    !payload.email?.trim() ||
    !payload.password ||
    (payload.role !== "admin" && payload.role !== "merchant")
  ) {
    return Response.json(
      { error: "Informe o e-mail e a senha." },
      { status: 400 },
    );
  }
  const result = await loginWithPassword({
    email: payload.email,
    password: payload.password,
    expectedRole: payload.role,
    request,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(
    { user: result.user },
    { headers: { "Set-Cookie": result.cookie } },
  );
}
