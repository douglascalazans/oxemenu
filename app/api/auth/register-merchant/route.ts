import { registerMerchant } from "@/lib/auth/server";
import { apiError } from "@/lib/request-auth";
import { isNonEmptyString, readJsonBody } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody<{
      displayName?: string;
      email?: string;
      password?: string;
      invitationToken?: string;
    }>(request);
    if (
      !isNonEmptyString(payload.displayName, 80) ||
      !isNonEmptyString(payload.email, 254) ||
      !isNonEmptyString(payload.password, 128) ||
      !isNonEmptyString(payload.invitationToken, 128)
    ) {
      return Response.json(
        { error: "Abra o link de convite e preencha todos os campos." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await registerMerchant({
      displayName: payload.displayName,
      email: payload.email,
      password: payload.password,
      invitationToken: payload.invitationToken,
      request,
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { user: result.user, recoveryCode: result.recoveryCode },
      {
        status: 201,
        headers: {
          "Set-Cookie": result.cookie,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
