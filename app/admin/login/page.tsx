import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth-experience";
import { getCurrentSession, hasAdminAccount } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ retorno?: string | string[] }>;
}) {
  const user = await getCurrentSession();
  if (user) redirect(user.role === "admin" ? "/admin" : "/painel");
  const params = await searchParams;
  return (
    <AuthExperience
      mode="login"
      role="admin"
      returnTo={
        typeof params.retorno === "string" ? params.retorno : undefined
      }
      adminExists={await hasAdminAccount()}
    />
  );
}
