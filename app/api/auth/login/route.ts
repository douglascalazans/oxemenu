import { loginWithPassword } from "@/lib/auth/server";
import type { AppRole } from "@/lib/auth/types";
import { apiError } from "@/lib/request-auth";
import { isNonEmptyString, readJsonBody } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody<{
      email?: string;
      password?: string;
      role?: AppRole;
    }>(request);
    if (
      !isNonEmptyString(payload.email, 254) ||
      !isNonEmptyString(payload.password, 128) ||
      (payload.role !== "admin" && payload.role !== "merchant")
    ) {
      return Response.json(
        { error: "Informe o e-mail e a senha." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await loginWithPassword({
      email: payload.email,
      password: payload.password,
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
      { user: result.user },
      {
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
