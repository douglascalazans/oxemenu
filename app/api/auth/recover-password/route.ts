import { isSameOrigin, recoverPassword } from "@/lib/auth/server";
import type { AppRole } from "@/lib/auth/types";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  let payload: {
    email?: string;
    recoveryCode?: string;
    newPassword?: string;
    role?: AppRole;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (
    !payload.email?.trim() ||
    !payload.recoveryCode?.trim() ||
    !payload.newPassword ||
    (payload.role !== "admin" && payload.role !== "merchant")
  ) {
    return Response.json({ error: "Preencha todos os campos." }, { status: 400 });
  }
  const result = await recoverPassword({
    email: payload.email,
    recoveryCode: payload.recoveryCode,
    newPassword: payload.newPassword,
    expectedRole: payload.role,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ recoveryCode: result.recoveryCode });
}
