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
  const [inviteUrl, setInviteUrl] = useState("");
  const [generating, setGenerating] = useState(false);

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

  const generateInvitation = async () => {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId, email: ownerEmail }),
      });
      const data = (await response.json()) as {
        inviteUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.inviteUrl) {
        throw new Error(data.error || "Não foi possível gerar o convite.");
      }
      setInviteUrl(data.inviteUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar o convite.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="access-manager">
      <div className="merchant-invite-action">
        <div>
          <strong>Primeiro acesso do comerciante</strong>
          <small>
            Gere um link individual para <b>{ownerEmail}</b>. O link expira em
            sete dias e deixa de funcionar depois do cadastro.
          </small>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={generateInvitation}
          disabled={generating || !ownerEmail}
        >
          {generating ? "Gerando…" : "Gerar link seguro"}
        </button>
      </div>

      {inviteUrl && (
        <div className="recovery-code-card">
          <span>Link de primeiro acesso</span>
          <strong>{inviteUrl}</strong>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(inviteUrl)}
          >
            Copiar link
          </button>
        </div>
      )}

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
