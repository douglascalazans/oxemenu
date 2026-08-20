import {
  clearSessionCookie,
  logoutSession,
} from "@/lib/auth/server";
import { apiError } from "@/lib/request-auth";
import { assertTrustedMutation } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await logoutSession(request);
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
