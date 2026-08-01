import { AuthExperience } from "@/components/auth-experience";
import { hasAdminAccount } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminRegistrationPage() {
  return (
    <AuthExperience
      mode="register-admin"
      role="admin"
      adminExists={await hasAdminAccount()}
    />
  );
}
