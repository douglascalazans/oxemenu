import {
  changePassword,
  clearSessionCookie,
  getRequestSession,
} from "@/lib/auth/server";
import { apiError } from "@/lib/request-auth";
import { isNonEmptyString, readJsonBody } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody<{
      currentPassword?: string;
      newPassword?: string;
    }>(request);
    const user = await getRequestSession(request);
    if (!user) {
      return Response.json(
        { error: "Sua sessão expirou." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      !isNonEmptyString(payload.currentPassword, 128) ||
      !isNonEmptyString(payload.newPassword, 128)
    ) {
      return Response.json(
        { error: "Informe a senha atual e a nova senha." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await changePassword({
      user,
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
      request,
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": clearSessionCookie(request),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
