import { apiError, requireRequestActor } from "@/lib/request-auth";
import {
  createEstablishment,
  listEstablishments,
} from "@/lib/server-data";

export async function GET(request: Request) {
  try {
    await requireRequestActor(request, ["admin"]);
    return Response.json({ stores: await listEstablishments() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestActor(request, ["admin"]);
    const input = (await request.json()) as Record<string, unknown>;
    const bundle = await createEstablishment(input);
    return Response.json(bundle, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
