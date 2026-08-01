"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { AppRole } from "@/lib/auth/types";
import { BrandLogo } from "@/components/brand-logo";

type AuthMode = "login" | "register-admin" | "register-merchant" | "recover";

type AuthExperienceProps = {
  mode: AuthMode;
  role: AppRole;
  returnTo?: string;
  adminExists?: boolean;
};

const roleCopy = {
  admin: {
    icon: "ADM",
    eyebrow: "Gestão da plataforma",
    title: "Painel OxeMenu",
    loginLead: "Entre com o e-mail e a senha que você criou para administrar a plataforma.",
    destination: "/admin",
    loginPath: "/admin/login",
  },
  merchant: {
    icon: "LOJA",
    eyebrow: "Área do comerciante",
    title: "Acesso do comerciante",
    loginLead: "Entre com seu próprio e-mail e senha para cuidar do seu cardápio.",
    destination: "/painel",
    loginPath: "/painel/login",
  },
} as const;

function validReturnTo(value: string | undefined, fallback: string): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function AuthExperience({
  mode,
  role,
  returnTo,
  adminExists = false,
}: AuthExperienceProps) {
  const copy = roleCopy[role];
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegistration =
    mode === "register-admin" || mode === "register-merchant";
  const title =
    mode === "login"
      ? copy.title
      : mode === "register-admin"
        ? "Criar acesso administrativo"
        : mode === "register-merchant"
          ? "Criar acesso do comerciante"
          : "Recuperar sua senha";
  const lead =
    mode === "login"
      ? copy.loginLead
      : mode === "register-admin"
        ? "Escolha seu próprio e-mail e senha. A chave inicial protege a criação do primeiro administrador."
        : mode === "register-merchant"
          ? "Informe o mesmo e-mail que foi liberado pela OxeMenu no cadastro do seu cardápio e crie sua própria senha."
          : "Informe o código de recuperação entregue quando sua conta foi criada.";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if ((isRegistration || mode === "recover") && password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    setLoading(true);
    const endpoint =
      mode === "login"
        ? "/api/auth/login"
        : mode === "register-admin"
          ? "/api/auth/register-admin"
          : mode === "register-merchant"
            ? "/api/auth/register-merchant"
            : "/api/auth/recover-password";
    const body =
      mode === "login"
        ? { email, password, role }
        : mode === "register-admin"
          ? { displayName, email, password, setupCode }
          : mode === "register-merchant"
            ? {
                displayName,
                email,
                password,
              }
            : {
                email,
                recoveryCode,
                newPassword: password,
                role,
              };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const data = (contentType.includes("application/json")
        ? await response.json()
        : {}) as {
        error?: string;
        recoveryCode?: string;
      };
      if (!response.ok) {
        setError(
          data.error ??
            "O sistema não conseguiu concluir o cadastro agora. Tente novamente.",
        );
        return;
      }
      if (mode === "login") {
        window.location.href = validReturnTo(returnTo, copy.destination);
        return;
      }
      setNewRecoveryCode(data.recoveryCode ?? "");
    } catch {
      setError("Não foi possível conectar ao sistema. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (adminExists && mode === "register-admin") {
    return (
      <AuthFrame>
        <div className="login-icon">{copy.icon}</div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>Acesso já configurado</h1>
        <p className="login-lead">
          O administrador já criou o próprio login. Entre usando o e-mail e a senha cadastrados.
        </p>
        <a className="primary-button full centered-button" href="/admin/login">
          Ir para o login
        </a>
      </AuthFrame>
    );
  }

  if (newRecoveryCode) {
    return (
      <AuthFrame>
        <div className="login-icon success-icon">✓</div>
        <p className="eyebrow">Conta protegida</p>
        <h1>{mode === "recover" ? "Senha alterada" : "Seu acesso foi criado"}</h1>
        <p className="login-lead">
          Guarde este código em um local seguro. Ele permite recuperar sua senha sem depender do ChatGPT.
        </p>
        <div className="recovery-code-card">
          <span>Código de recuperação</span>
          <strong>{newRecoveryCode}</strong>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(newRecoveryCode)}
          >
            Copiar código
          </button>
        </div>
        <a
          className="primary-button full centered-button"
          href={mode === "recover" ? copy.loginPath : copy.destination}
        >
          {mode === "recover" ? "Voltar para o login" : "Entrar no painel"}
        </a>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      {role === "admin" && (
        <>
          <div className="login-icon">{copy.icon}</div>
          <p className="eyebrow">{copy.eyebrow}</p>
        </>
      )}
      <h1>{title}</h1>
      <p className="login-lead">{lead}</p>
      <form onSubmit={submit}>
        {isRegistration && (
          <label>
            <span>Seu nome</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              required
              placeholder="Como você quer ser chamado"
            />
          </label>
        )}
        <label>
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="seuemail@exemplo.com"
          />
        </label>
        {mode === "register-admin" && (
          <label>
            <span>Chave inicial da OxeMenu</span>
            <input
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              autoComplete="off"
              required
              placeholder="Informe a chave recebida"
            />
          </label>
        )}
        {mode === "recover" && (
          <label>
            <span>Código de recuperação</span>
            <input
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
              autoComplete="off"
              required
              placeholder="XXXX-XXXX-XXXX"
            />
          </label>
        )}
        <label>
          <span>{mode === "recover" ? "Nova senha" : "Senha"}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            placeholder="Mínimo de 8 caracteres"
          />
        </label>
        {mode === "login" && role === "merchant" && (
          <a className="first-access-link" href="/painel/cadastro">
            Primeiro acesso
          </a>
        )}
        {(isRegistration || mode === "recover") && (
          <label>
            <span>Confirmar senha</span>
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Digite a mesma senha"
            />
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full" type="submit" disabled={loading}>
          {loading
            ? "Aguarde…"
            : mode === "login"
              ? "Entrar no painel"
              : mode === "recover"
                ? "Criar nova senha"
                : "Criar meu acesso"}
        </button>
      </form>
      {mode === "login" && (
        <div className="auth-actions">
          <a href={`/recuperar-senha?tipo=${role}`}>Esqueci minha senha</a>
          {role === "admin" ? (
            !adminExists && <a href="/admin/cadastro">Criar acesso administrativo</a>
          ) : null}
        </div>
      )}
      {mode !== "login" && (
        <a className="back-link" href={copy.loginPath}>
          ← Voltar para o login
        </a>
      )}
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-page">
      <Link className="brand-link" href="/" aria-label="OxeMenu, início">
        <BrandLogo />
      </Link>
      <section className="login-card">{children}</section>
      <p className="login-foot">
        Acesso próprio e protegido · sem depender de conta do ChatGPT
      </p>
    </main>
  );
}
