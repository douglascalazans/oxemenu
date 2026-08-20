import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  DataError,
  getStoreById,
  updateEstablishment,
} from "@/lib/server-data";
import { readJsonBody } from "@/lib/security";

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
    const input = await readJsonBody<Record<string, unknown>>(request);
    return Response.json(await updateEstablishment(id, input));
  } catch (error) {
    return apiError(error);
  }
}
