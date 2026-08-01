import { getRequestSession } from "@/lib/auth/server";
import { DataError } from "@/lib/server-data";
import type { Actor, ActorRole } from "@/lib/models";

export async function requireRequestActor(
  request: Request,
  roles: ActorRole[] = ["admin", "merchant"],
): Promise<Actor> {
  const actor = await getRequestSession(request);
  if (!actor) throw new DataError("Entre com sua conta para continuar.", 401);
  if (!actor || !roles.includes(actor.role)) {
    throw new DataError("Você não tem permissão para esta área.", 403);
  }
  return actor;
}

export function apiError(error: unknown) {
  if (error instanceof DataError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message =
    error instanceof Error ? error.message : "Não foi possível concluir a ação.";
  console.error(error);
  return Response.json({ error: message }, { status: 500 });
}
