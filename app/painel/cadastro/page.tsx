import { AuthExperience } from "@/components/auth-experience";

export default async function MerchantRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string | string[] }>;
}) {
  const params = await searchParams;
  const invitationToken = Array.isArray(params.convite)
    ? params.convite[0]
    : params.convite;
  return (
    <AuthExperience
      mode="register-merchant"
      role="merchant"
      invitationToken={invitationToken}
    />
  );
}
