import {
  createMerchantInvitation,
  getEstablishmentAccess,
  getRequestSession,
  isSameOrigin,
} from "@/lib/auth/server";
import { normalizeEmail } from "@/lib/server-data";

export async function GET(request: Request) {
  const user = await getRequestSession(request);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const establishmentId =
    new URL(request.url).searchParams.get("estabelecimento")?.trim() ?? "";
  if (!establishmentId) {
    return Response.json({ error: "Estabelecimento inválido." }, { status: 400 });
  }
  return Response.json(await getEstablishmentAccess(establishmentId));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const user = await getRequestSession(request);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  let payload: { email?: string; establishmentId?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const establishmentId = payload.establishmentId?.trim() ?? "";
  if (!establishmentId) {
    return Response.json({ error: "Estabelecimento inválido." }, { status: 400 });
  }
  const email = payload.email?.trim() ? normalizeEmail(payload.email) : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  try {
    const invitation = await createMerchantInvitation({
      admin: user,
      establishmentId,
      email,
      request,
    });
    return Response.json(invitation, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível gerar o convite.";
    return Response.json({ error: message }, { status: 400 });
  }
}
