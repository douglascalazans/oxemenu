import { registerFirstAdmin } from "@/lib/auth/server";
import { apiError } from "@/lib/request-auth";
import { isNonEmptyString, readJsonBody } from "@/lib/security";
import { DataError } from "@/lib/server-data";

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody<{
      displayName?: string;
      email?: string;
      password?: string;
      setupCode?: string;
    }>(request);
    if (
      !isNonEmptyString(payload.displayName, 80) ||
      !isNonEmptyString(payload.email, 254) ||
      !isNonEmptyString(payload.password, 128) ||
      !isNonEmptyString(payload.setupCode, 256)
    ) {
      return Response.json(
        { error: "Preencha todos os campos." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await registerFirstAdmin({
      displayName: payload.displayName,
      email: payload.email,
      password: payload.password,
      setupCode: payload.setupCode,
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
    console.error("[auth] Failed to register the first administrator", error);
    if (error instanceof DataError) return apiError(error);
    return Response.json(
      { error: "O sistema não conseguiu concluir o cadastro agora. Tente novamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
