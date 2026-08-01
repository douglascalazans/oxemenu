import AccessDenied from "@/components/access-denied";
import { MerchantDashboard } from "@/components/dashboard-experience";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function MerchantPage() {
  const actor = await requirePageActor("/painel", "merchant");
  if (!actor) return <AccessDenied area="comerciante" />;
  return <MerchantDashboard />;
}
