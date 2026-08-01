import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  assertStoreAccess,
  createCategory,
} from "@/lib/server-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRequestActor(request);
    const { id } = await context.params;
    await assertStoreAccess(actor, id);
    const input = (await request.json()) as { name?: string };
    const category = await createCategory(id, input);
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
