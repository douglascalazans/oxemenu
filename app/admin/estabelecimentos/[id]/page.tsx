import AccessDenied from "@/components/access-denied";
import { EstablishmentEditor } from "@/components/dashboard-experience";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

async function ProtectedEditor({ id }: { id: string }) {
  const actor = await requirePageActor(
    `/admin/estabelecimentos/${encodeURIComponent(id)}`,
    "admin",
  );
  if (!actor) return <AccessDenied area="administração" />;
  return <EstablishmentEditor id={id} />;
}

export default async function EstablishmentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProtectedEditor id={id} />;
}
