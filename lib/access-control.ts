import type { Actor, ActorRole } from "./models.ts";

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function canAccessStore(
  actor: Pick<Actor, "email" | "role">,
  ownerEmail: string | null | undefined,
): boolean {
  return (
    actor.role === "admin" ||
    normalizedEmail(ownerEmail ?? "") === normalizedEmail(actor.email)
  );
}

export function hasRequiredRole(
  actor: Pick<Actor, "role">,
  roles: readonly ActorRole[],
): boolean {
  return roles.includes(actor.role);
}
