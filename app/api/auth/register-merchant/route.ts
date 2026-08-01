import { isSameOrigin, registerMerchant } from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  let payload: {
    displayName?: string;
    email?: string;
    password?: string;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }
  if (
    !payload.displayName?.trim() ||
    !payload.email?.trim() ||
    !payload.password
  ) {
    return Response.json(
      { error: "Preencha seu nome, e-mail e senha." },
      { status: 400 },
    );
  }
  const result = await registerMerchant({
    displayName: payload.displayName,
    email: payload.email,
    password: payload.password,
    request,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(
    { user: result.user, recoveryCode: result.recoveryCode },
    { status: 201, headers: { "Set-Cookie": result.cookie } },
  );
}
