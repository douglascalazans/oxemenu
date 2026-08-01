import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/server";
import type { ActorRole } from "@/lib/models";

export async function requirePageActor(
  returnTo: string,
  role: ActorRole,
) {
  const actor = await getCurrentSession();
  if (!actor) {
    const login = role === "admin" ? "/admin/login" : "/painel/login";
    redirect(`${login}?retorno=${encodeURIComponent(returnTo)}`);
  }
  return actor?.role === role ? actor : null;
}
