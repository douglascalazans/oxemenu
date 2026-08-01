import { redirect } from "next/navigation";
import { AccountExperience } from "@/components/account-experience";
import { getCurrentSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentSession();
  if (!user) redirect("/painel/login?retorno=/conta");
  return <AccountExperience user={user} />;
}
