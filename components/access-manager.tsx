"use client";

import { useEffect, useState } from "react";

type AccessSummary = {
  users: Array<{
    id: string;
    displayName: string;
    email: string;
    status: "active" | "revoked";
  }>;
  pendingInvitations: Array<{
    email: string | null;
    expiresAt: string;
  }>;
};

export function AccessManager({
  establishmentId,
  ownerEmail,
}: {
  establishmentId: string;
  ownerEmail: string;
}) {
  const [summary, setSummary] = useState<AccessSummary>({
    users: [],
    pendingInvitations: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(
      `/api/admin/invitations?estabelecimento=${encodeURIComponent(establishmentId)}`,
    )
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<AccessSummary>;
      })
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar os acessos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [establishmentId]);

  return (
    <div className="access-manager">
      <div className="merchant-invite-action">
        <div>
          <strong>Primeiro acesso do comerciante</strong>
          <small>
            O e-mail <b>{ownerEmail}</b> está liberado. No painel do comerciante,
            ele deve clicar em “Primeiro acesso” para criar a própria senha.
          </small>
        </div>
        <a
          className="secondary-button"
          href="/painel/login"
          target="_blank"
          rel="noreferrer"
        >
          Abrir tela de login
        </a>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="access-list">
        {loading ? (
          <p className="access-empty">Carregando acessos…</p>
        ) : summary.users.length ? (
          summary.users.map((user) => (
            <div className="access-user" key={user.id}>
              <span className="store-avatar">
                {user.displayName.slice(0, 2).toUpperCase()}
              </span>
              <p>
                <strong>{user.displayName}</strong>
                <small>{user.email}</small>
              </p>
              <span
                className={`table-status ${
                  user.status === "active" ? "active" : "inactive"
                }`}
              >
                {user.status === "active" ? "Ativo" : "Revogado"}
              </span>
            </div>
          ))
        ) : (
          <p className="access-empty">
            Aguardando o primeiro acesso do comerciante.
          </p>
        )}
      </div>
    </div>
  );
}
