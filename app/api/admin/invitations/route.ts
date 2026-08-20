import {
  createMerchantInvitation,
  getEstablishmentAccess,
  getRequestSession,
} from "@/lib/auth/server";
import { apiError } from "@/lib/request-auth";
import { isNonEmptyString, readJsonBody } from "@/lib/security";
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
  try {
    const payload = await readJsonBody<{
      email?: string;
      establishmentId?: string;
    }>(request);
    const user = await getRequestSession(request);
    if (!user || user.role !== "admin") {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const establishmentId = isNonEmptyString(payload.establishmentId, 128)
      ? payload.establishmentId.trim()
      : "";
    if (!establishmentId) {
      return Response.json(
        { error: "Estabelecimento inválido." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const email = isNonEmptyString(payload.email, 254)
      ? normalizeEmail(payload.email)
      : "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: "Informe um e-mail válido." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const invitation = await createMerchantInvitation({
      admin: user,
      establishmentId,
      email,
      request,
    });
    return Response.json(invitation, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
