import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  DataError,
  getStoreById,
  updateEstablishment,
} from "@/lib/server-data";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRequestActor(request, ["admin"]);
    const { id } = await context.params;
    const bundle = await getStoreById(id);
    if (!bundle) throw new DataError("Estabelecimento não encontrado.", 404);
    return Response.json(bundle);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRequestActor(request, ["admin"]);
    const { id } = await context.params;
    const input = (await request.json()) as Record<string, unknown>;
    return Response.json(await updateEstablishment(id, input));
  } catch (error) {
    return apiError(error);
  }
}
