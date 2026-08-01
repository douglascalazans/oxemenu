import { apiError, requireRequestActor } from "@/lib/request-auth";

export async function GET(request: Request) {
  try {
    const actor = await requireRequestActor(request);
    return Response.json({ actor });
  } catch (error) {
    return apiError(error);
  }
}
