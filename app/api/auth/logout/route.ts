import {
  clearSessionCookie,
  isSameOrigin,
  logoutSession,
} from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  await logoutSession(request);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie(request) } },
  );
}
