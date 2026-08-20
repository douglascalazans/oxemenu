import { recoverPassword } from "@/lib/auth/server";
import type { AppRole } from "@/lib/auth/types";
import { apiError } from "@/lib/request-auth";
import { isNonEmptyString, readJsonBody } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody<{
      email?: string;
      recoveryCode?: string;
      newPassword?: string;
      role?: AppRole;
    }>(request);
    if (
      !isNonEmptyString(payload.email, 254) ||
      !isNonEmptyString(payload.recoveryCode, 64) ||
      !isNonEmptyString(payload.newPassword, 128) ||
      (payload.role !== "admin" && payload.role !== "merchant")
    ) {
      return Response.json(
        { error: "Preencha todos os campos." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await recoverPassword({
      email: payload.email,
      recoveryCode: payload.recoveryCode,
      newPassword: payload.newPassword,
      expectedRole: payload.role,
      request,
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { recoveryCode: result.recoveryCode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
