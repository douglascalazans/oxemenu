import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MenuExperience from "@/components/menu-experience";
import { getStoreBySlug } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cardápio Digital",
  description: "Cardápio digital criado com OxeMenu.",
};

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  return <MenuExperience slug={slug} />;
}
