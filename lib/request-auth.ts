import { getRequestSession } from "@/lib/auth/server";
import { DataError } from "@/lib/server-data";
import type { Actor, ActorRole } from "@/lib/models";
import { RequestSecurityError } from "@/lib/security";
import { hasRequiredRole } from "@/lib/access-control";

export async function requireRequestActor(
  request: Request,
  roles: ActorRole[] = ["admin", "merchant"],
): Promise<Actor> {
  const actor = await getRequestSession(request);
  if (!actor) throw new DataError("Entre com sua conta para continuar.", 401);
  if (!hasRequiredRole(actor, roles)) {
    throw new DataError("Você não tem permissão para esta área.", 403);
  }
  return actor;
}

export function apiError(error: unknown) {
  if (error instanceof DataError) {
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof RequestSecurityError) {
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("[api] Unexpected request failure", error);
  return Response.json(
    { error: "Não foi possível concluir a ação." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
