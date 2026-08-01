import type { Metadata } from "next";
import MenuExperience from "@/components/menu-experience";

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
  return <MenuExperience slug={slug} />;
}
