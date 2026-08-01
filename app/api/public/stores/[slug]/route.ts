import { apiError } from "@/lib/request-auth";
import { getStoreBySlug } from "@/lib/server-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const bundle = await getStoreBySlug(slug);
    if (!bundle) {
      return Response.json(
        { error: "Cardápio não encontrado." },
        { status: 404 },
      );
    }
    return Response.json(bundle, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
