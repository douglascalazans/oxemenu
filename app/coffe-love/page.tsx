import type { Metadata } from "next";
import MenuExperience from "@/components/menu-experience";

export const metadata: Metadata = {
  title: "Coffe Love | Cardápio Digital",
  description:
    "Conheça o cardápio demonstrativo da Coffe Love e monte seu pedido pelo WhatsApp.",
};

export default function CoffeLovePage() {
  return <MenuExperience slug="coffe-love" />;
}
