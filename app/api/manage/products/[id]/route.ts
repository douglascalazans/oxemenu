import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  assertStoreAccess,
  DataError,
  deleteProduct,
  getProductStoreId,
  updateProduct,
} from "@/lib/server-data";

async function authorize(request: Request, productId: string) {
  const actor = await requireRequestActor(request);
  const storeId = await getProductStoreId(productId);
  if (!storeId) throw new DataError("Item não encontrado.", 404);
  await assertStoreAccess(actor, storeId);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await authorize(request, id);
    const input = (await request.json()) as Record<string, unknown>;
    return Response.json(await updateProduct(id, input));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await authorize(request, id);
    return Response.json(await deleteProduct(id));
  } catch (error) {
    return apiError(error);
  }
}
