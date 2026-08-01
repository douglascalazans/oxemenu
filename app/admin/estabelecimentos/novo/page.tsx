import AccessDenied from "@/components/access-denied";
import { NewEstablishment } from "@/components/dashboard-experience";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function NewEstablishmentPage() {
  const actor = await requirePageActor("/admin/estabelecimentos/novo", "admin");
  if (!actor) return <AccessDenied area="administração" />;
  return <NewEstablishment />;
}
