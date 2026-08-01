import { AdminDashboard } from "@/components/dashboard-experience";
import AccessDenied from "@/components/access-denied";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await requirePageActor("/admin", "admin");
  if (!actor) return <AccessDenied area="administração" />;
  return <AdminDashboard />;
}
