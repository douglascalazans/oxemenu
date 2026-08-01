import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  assertStoreAccess,
  createProduct,
} from "@/lib/server-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRequestActor(request);
    const { id } = await context.params;
    await assertStoreAccess(actor, id);
    const input = (await request.json()) as Record<string, unknown>;
    return Response.json(await createProduct(id, input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
