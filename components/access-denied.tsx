"use client";

import { BrandLogo } from "@/components/brand-logo";

export default function AccessDenied({
  area,
}: {
  area: "administração" | "comerciante";
}) {
  return (
    <main className="login-page">
      <a className="brand-link" href="/" aria-label="OxeMenu, início">
        <BrandLogo />
      </a>
      <section className="login-card">
        <div className="login-icon">!</div>
        <p className="eyebrow">Acesso não liberado</p>
        <h1>Esta conta não pertence à área de {area}</h1>
        <p className="login-lead">
          Entre com a conta autorizada para este painel. Se você é comerciante,
          o e-mail precisa estar vinculado ao seu estabelecimento.
        </p>
        <button
          className="primary-button full"
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href =
              area === "administração" ? "/admin/login" : "/painel/login";
          }}
        >
          Sair e entrar com outra conta
        </button>
        <a className="back-link" href="/">
          ← Voltar para o site
        </a>
      </section>
    </main>
  );
}
