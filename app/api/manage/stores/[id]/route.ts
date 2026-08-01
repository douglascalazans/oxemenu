import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  assertStoreAccess,
  DataError,
  getStoreById,
  updateEstablishment,
} from "@/lib/server-data";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRequestActor(request);
    const { id } = await context.params;
    await assertStoreAccess(actor, id);
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
    const actor = await requireRequestActor(request);
    const { id } = await context.params;
    await assertStoreAccess(actor, id);
    const input = (await request.json()) as Record<string, unknown>;
    if (actor.role !== "admin") {
      delete input.ownerEmail;
      delete input.managementMode;
      delete input.slug;
      delete input.status;
    }
    return Response.json(await updateEstablishment(id, input));
  } catch (error) {
    return apiError(error);
  }
}
