import type { Actor, ActorRole } from "@/lib/models";

export type AppRole = ActorRole;
export type AppUser = Actor;

export type SessionActor = Actor & {
  userId: string;
};
