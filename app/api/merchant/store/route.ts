import { apiError, requireRequestActor } from "@/lib/request-auth";
import { DataError, getMerchantStore } from "@/lib/server-data";

export async function GET(request: Request) {
  try {
    const actor = await requireRequestActor(request, ["merchant"]);
    const bundle = await getMerchantStore(actor.email);
    if (!bundle) {
      throw new DataError(
        "Nenhum estabelecimento foi vinculado a esta conta.",
        404,
      );
    }
    return Response.json({ actor, ...bundle });
  } catch (error) {
    return apiError(error);
  }
}
