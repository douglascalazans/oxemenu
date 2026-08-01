import AccessDenied from "@/components/access-denied";
import { EstablishmentsList } from "@/components/dashboard-experience";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function EstablishmentsPage() {
  const actor = await requirePageActor("/admin/estabelecimentos", "admin");
  if (!actor) return <AccessDenied area="administração" />;
  return <EstablishmentsList />;
}
