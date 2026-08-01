import { AuthExperience } from "@/components/auth-experience";

export default async function PasswordRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <AuthExperience
      mode="recover"
      role={params.tipo === "admin" ? "admin" : "merchant"}
    />
  );
}
