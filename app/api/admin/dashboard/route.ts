import { apiError, requireRequestActor } from "@/lib/request-auth";
import { getAdminSummary } from "@/lib/server-data";

export async function GET(request: Request) {
  try {
    const actor = await requireRequestActor(request, ["admin"]);
    const summary = await getAdminSummary();
    return Response.json({ actor, ...summary });
  } catch (error) {
    return apiError(error);
  }
}
