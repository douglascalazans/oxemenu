import { isSameOrigin, registerFirstAdmin } from "@/lib/auth/server";
import { DataError } from "@/lib/server-data";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  let payload: {
    displayName?: string;
    email?: string;
    password?: string;
    setupCode?: string;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }
  if (
    !payload.displayName?.trim() ||
    !payload.email?.trim() ||
    !payload.password ||
    !payload.setupCode?.trim()
  ) {
    return Response.json({ error: "Preencha todos os campos." }, { status: 400 });
  }
  try {
    const result = await registerFirstAdmin({
      displayName: payload.displayName,
      email: payload.email,
      password: payload.password,
      setupCode: payload.setupCode,
      request,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(
      { user: result.user, recoveryCode: result.recoveryCode },
      { status: 201, headers: { "Set-Cookie": result.cookie } },
    );
  } catch (error) {
    console.error("[auth] Failed to register the first administrator", error);
    const message =
      error instanceof DataError
        ? error.message
        : "O sistema não conseguiu concluir o cadastro agora. Tente novamente.";
    const status = error instanceof DataError ? error.status : 503;
    return Response.json({ error: message }, { status });
  }
}
