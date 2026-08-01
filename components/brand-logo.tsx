import Image from "next/image";

export function BrandLogo({
  light = false,
  priority = false,
}: {
  light?: boolean;
  priority?: boolean;
}) {
  return (
    <span className={`brand-mark ${light ? "light" : ""}`}>
      <Image
        className="brand-logo-image"
        src="/oxemenu-logo-transparent.png"
        alt="OxeMenu — Seu Cardápio Digital"
        width={680}
        height={220}
        priority={priority}
      />
    </span>
  );
}
