"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { AppUser } from "@/lib/auth/types";
import { BrandLogo } from "@/components/brand-logo";

export function AccountExperience({ user }: { user: AppUser }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("As duas novas senhas precisam ser iguais.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível alterar a senha.");
        return;
      }
      window.location.href =
        user.role === "admin"
          ? "/admin/login?senha=alterada"
          : "/painel/login?senha=alterada";
    } catch {
      setError("Não foi possível conectar ao sistema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="account-page">
      <section className="account-card">
        <Link className="brand-link" href="/" aria-label="OxeMenu, início">
          <BrandLogo />
        </Link>
        <p className="eyebrow">Minha conta</p>
        <h1>Dados de acesso</h1>
        <div className="account-identity">
          <span>{user.displayName.slice(0, 2).toUpperCase()}</span>
          <p>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </p>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>Senha atual</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            <span>Nova senha</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label>
            <span>Confirmar nova senha</span>
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full" type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Alterar minha senha"}
          </button>
        </form>
        <a
          className="back-link"
          href={user.role === "admin" ? "/admin" : "/painel"}
        >
          ← Voltar para o painel
        </a>
      </section>
    </main>
  );
}
