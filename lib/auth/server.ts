import { headers } from "next/headers";
import {
  createRecoveryCode,
  hashOpaqueToken,
  hashPassword,
  randomToken,
  timingSafeEqual,
  verifyPassword,
} from "@/lib/auth/crypto";
import type {
  AppRole,
  AppUser,
  SessionActor,
} from "@/lib/auth/types";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  DataError,
  ensureSeedData,
  normalizeEmail,
} from "@/lib/server-data";

const SESSION_COOKIE = "caruarufood_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const LOGIN_LOCK_MINUTES = 15;
const MAX_LOGIN_FAILURES = 5;

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  recovery_code_hash: string;
  role: AppRole;
  status: "active" | "revoked";
  failed_login_count: number;
  locked_until: string | null;
};

function getD1(): D1Database {
  const database = getRuntimeEnv().DB;
  if (!database) {
    throw new DataError("O banco de dados não está disponível.", 503);
  }
  return database;
}

function publicActor(row: UserRow): SessionActor {
  return {
    userId: row.id,
    email: row.email,
    displayName: row.display_name || row.email,
    role: row.role,
  };
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return "Use pelo menos uma letra e um número na senha.";
  }
  if (password.length > 128) return "A senha informada é muito longa.";
  return null;
}

function validateName(displayName: string): string | null {
  const length = displayName.trim().length;
  if (length < 2) return "Informe seu nome.";
  if (length > 80) return "O nome deve ter no máximo 80 caracteres.";
  return null;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function cookieAttributes(request: Request): string[] {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    new URL(request.url).protocol === "https:" ? "Secure" : "",
  ].filter(Boolean);
}

export function clearSessionCookie(request: Request): string {
  return [
    `${SESSION_COOKIE}=`,
    ...cookieAttributes(request),
    "Max-Age=0",
  ].join("; ");
}

function sessionCookie(token: string, request: Request): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    ...cookieAttributes(request),
    `Max-Age=${SESSION_SECONDS}`,
  ].join("; ");
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  await ensureSeedData();
  return (
    (await getD1()
      .prepare(
        `SELECT id, email, display_name, password_hash, password_salt,
                recovery_code_hash, role, status, failed_login_count,
                locked_until
           FROM users
          WHERE email = ?
          LIMIT 1`,
      )
      .bind(normalizeEmail(email))
      .first<UserRow>()) ?? null
  );
}

async function findUserById(id: string): Promise<UserRow | null> {
  await ensureSeedData();
  return (
    (await getD1()
      .prepare(
        `SELECT id, email, display_name, password_hash, password_salt,
                recovery_code_hash, role, status, failed_login_count,
                locked_until
           FROM users
          WHERE id = ?
          LIMIT 1`,
      )
      .bind(id)
      .first<UserRow>()) ?? null
  );
}

async function createSession(
  userId: string,
  request: Request,
): Promise<{ cookie: string; user: AppUser }> {
  const user = await findUserById(userId);
  if (!user) throw new DataError("Não foi possível iniciar a sessão.", 500);
  const token = randomToken();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  const database = getD1();
  await database.batch([
    database
      .prepare(
        "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      )
      .bind(tokenHash, userId, expiresAt),
    database
      .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
      .bind(new Date().toISOString()),
  ]);
  return { cookie: sessionCookie(token, request), user: publicActor(user) };
}

export async function getSessionActorFromCookieHeader(
  cookieHeader: string | null,
): Promise<SessionActor | null> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  await ensureSeedData();
  const row = await getD1()
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.password_hash, u.password_salt,
              u.recovery_code_hash, u.role, u.status, u.failed_login_count,
              u.locked_until
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.expires_at > ?
          AND u.status = 'active'
          AND u.password_hash <> ''
        LIMIT 1`,
    )
    .bind(await hashOpaqueToken(token), new Date().toISOString())
    .first<UserRow>();
  return row ? publicActor(row) : null;
}

export async function getRequestSession(
  request: Request,
): Promise<SessionActor | null> {
  return getSessionActorFromCookieHeader(request.headers.get("cookie"));
}

export async function getCurrentSession(): Promise<SessionActor | null> {
  const requestHeaders = await headers();
  return getSessionActorFromCookieHeader(requestHeaders.get("cookie"));
}

export async function hasAdminAccount(): Promise<boolean> {
  await ensureSeedData();
  return Boolean(
    await getD1()
      .prepare(
        `SELECT id
           FROM users
          WHERE role = 'admin'
            AND status = 'active'
            AND password_hash <> ''
          LIMIT 1`,
      )
      .first<{ id: string }>(),
  );
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  expectedRole: AppRole;
  request: Request;
}): Promise<
  | { ok: true; cookie: string; user: AppUser }
  | { ok: false; error: string; status: number }
> {
  const row = await findUserByEmail(input.email);
  if (!row || !row.password_hash || !row.password_salt) {
    await hashPassword(
      input.password.slice(0, 128),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    return { ok: false, error: "E-mail ou senha inválidos.", status: 401 };
  }

  const now = new Date();
  const lockExpires = row.locked_until ? new Date(row.locked_until) : null;
  if (lockExpires && lockExpires > now) {
    return {
      ok: false,
      error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
      status: 429,
    };
  }

  const matches = await verifyPassword(
    input.password,
    row.password_hash,
    row.password_salt,
  );
  if (!matches || row.status !== "active") {
    const previousFailures =
      lockExpires && lockExpires <= now ? 0 : row.failed_login_count;
    const failures = previousFailures + 1;
    const lockedUntil =
      failures >= MAX_LOGIN_FAILURES
        ? new Date(
            Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000,
          ).toISOString()
        : null;
    await getD1()
      .prepare(
        "UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?",
      )
      .bind(failures, lockedUntil, now.toISOString(), row.id)
      .run();
    return { ok: false, error: "E-mail ou senha inválidos.", status: 401 };
  }

  if (row.role !== input.expectedRole) {
    return {
      ok: false,
      error:
        row.role === "admin"
          ? "Use a entrada do painel administrativo."
          : "Use a entrada da área do comerciante.",
      status: 403,
    };
  }

  await getD1()
    .prepare(
      "UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?",
    )
    .bind(now.toISOString(), row.id)
    .run();
  const session = await createSession(row.id, input.request);
  return { ok: true, ...session };
}

export async function registerFirstAdmin(input: {
  displayName: string;
  email: string;
  password: string;
  setupCode: string;
  request: Request;
}): Promise<
  | {
      ok: true;
      cookie: string;
      user: AppUser;
      recoveryCode: string;
    }
  | { ok: false; error: string; status: number }
> {
  const configuredCode =
    getRuntimeEnv().ADMIN_SETUP_CODE ??
    process.env.ADMIN_SETUP_CODE ??
    "";
  if (
    !configuredCode ||
    !timingSafeEqual(input.setupCode.trim(), configuredCode)
  ) {
    return { ok: false, error: "A chave inicial está incorreta.", status: 403 };
  }
  if (await hasAdminAccount()) {
    return {
      ok: false,
      error: "O acesso administrativo já foi criado. Entre com seu e-mail e senha.",
      status: 409,
    };
  }
  const validationError =
    validateName(input.displayName) ?? validatePassword(input.password);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(email);
  if (existing?.password_hash) {
    return { ok: false, error: "Este e-mail já está cadastrado.", status: 409 };
  }

  const userId = existing?.id ?? `user-${crypto.randomUUID()}`;
  const passwordData = await hashPassword(input.password);
  const recoveryCode = createRecoveryCode();
  const recoveryCodeHash = await hashOpaqueToken(recoveryCode);
  if (existing) {
    await getD1()
      .prepare(
        `UPDATE users
            SET display_name = ?, role = 'admin', password_hash = ?,
                password_salt = ?, recovery_code_hash = ?, status = 'active',
                failed_login_count = 0, locked_until = NULL, updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        input.displayName.trim(),
        passwordData.hash,
        passwordData.salt,
        recoveryCodeHash,
        new Date().toISOString(),
        userId,
      )
      .run();
  } else {
    await getD1()
      .prepare(
        `INSERT INTO users (
           id, email, display_name, role, password_hash, password_salt,
           recovery_code_hash, status
         ) VALUES (?, ?, ?, 'admin', ?, ?, ?, 'active')`,
      )
      .bind(
        userId,
        email,
        input.displayName.trim(),
        passwordData.hash,
        passwordData.salt,
        recoveryCodeHash,
      )
      .run();
  }
  const session = await createSession(userId, input.request);
  return { ok: true, ...session, recoveryCode };
}

export async function createMerchantInvitation(input: {
  admin: SessionActor;
  establishmentId: string;
  email?: string;
  request: Request;
}): Promise<{ inviteUrl: string; expiresAt: string }> {
  await ensureSeedData();
  const store = await getD1()
    .prepare("SELECT id FROM establishments WHERE id = ? LIMIT 1")
    .bind(input.establishmentId)
    .first<{ id: string }>();
  if (!store) throw new DataError("Estabelecimento não encontrado.", 404);

  const token = randomToken(24);
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const email = input.email?.trim()
    ? normalizeEmail(input.email)
    : null;
  await getD1()
    .prepare(
      `INSERT INTO auth_invitations (
         token_hash, establishment_id, email, created_by, expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      tokenHash,
      input.establishmentId,
      email,
      input.admin.userId,
      expiresAt,
    )
    .run();
  const url = new URL("/painel/cadastro", input.request.url);
  url.searchParams.set("convite", token);
  return { inviteUrl: url.toString(), expiresAt };
}

export async function registerMerchant(input: {
  displayName: string;
  email: string;
  password: string;
  request: Request;
}): Promise<
  | {
      ok: true;
      cookie: string;
      user: AppUser;
      recoveryCode: string;
    }
  | { ok: false; error: string; status: number }
> {
  await ensureSeedData();
  const validationError =
    validateName(input.displayName) ?? validatePassword(input.password);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }
  const email = normalizeEmail(input.email);
  const database = getD1();
  const authorizedStore = await database
    .prepare(
      `SELECT id
         FROM establishments
        WHERE owner_email = ?
          AND management_mode = 'merchant'
        LIMIT 1`,
    )
    .bind(email)
    .first<{ id: string }>();
  if (!authorizedStore) {
    return {
      ok: false,
      error:
        "Este e-mail ainda não foi liberado. Confirme com a OxeMenu o e-mail cadastrado no seu cardápio.",
      status: 403,
    };
  }
  const existing = await findUserByEmail(email);
  if (existing?.password_hash) {
    return {
      ok: false,
      error: "Este acesso já foi criado. Volte ao login e entre com sua senha.",
      status: 409,
    };
  }

  const userId = existing?.id ?? `user-${crypto.randomUUID()}`;
  const passwordData = await hashPassword(input.password);
  const recoveryCode = createRecoveryCode();
  const recoveryCodeHash = await hashOpaqueToken(recoveryCode);
  const now = new Date().toISOString();
  const userStatement = existing
    ? database
        .prepare(
          `UPDATE users
              SET display_name = ?, role = 'merchant', password_hash = ?,
                  password_salt = ?, recovery_code_hash = ?, status = 'active',
                  failed_login_count = 0, locked_until = NULL, updated_at = ?
            WHERE id = ?`,
        )
        .bind(
          input.displayName.trim(),
          passwordData.hash,
          passwordData.salt,
          recoveryCodeHash,
          now,
          userId,
        )
    : database
        .prepare(
          `INSERT INTO users (
             id, email, display_name, role, password_hash, password_salt,
             recovery_code_hash, status
           ) VALUES (?, ?, ?, 'merchant', ?, ?, ?, 'active')`,
        )
        .bind(
          userId,
          email,
          input.displayName.trim(),
          passwordData.hash,
          passwordData.salt,
          recoveryCodeHash,
        );
  await database.batch([
    userStatement,
    database
      .prepare(
        `UPDATE auth_invitations
            SET used_at = ?
          WHERE email = ?
            AND used_at IS NULL`,
      )
      .bind(now, email),
  ]);
  const session = await createSession(userId, input.request);
  return { ok: true, ...session, recoveryCode };
}

export async function logoutSession(request: Request): Promise<void> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return;
  await ensureSeedData();
  await getD1()
    .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
    .bind(await hashOpaqueToken(token))
    .run();
}

export async function changePassword(input: {
  user: SessionActor;
  currentPassword: string;
  newPassword: string;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  const passwordError = validatePassword(input.newPassword);
  if (passwordError) return { ok: false, error: passwordError, status: 400 };
  const row = await findUserById(input.user.userId);
  if (
    !row ||
    !(await verifyPassword(
      input.currentPassword,
      row.password_hash,
      row.password_salt,
    ))
  ) {
    return { ok: false, error: "A senha atual está incorreta.", status: 403 };
  }
  const passwordData = await hashPassword(input.newPassword);
  const database = getD1();
  await database.batch([
    database
      .prepare(
        "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        passwordData.hash,
        passwordData.salt,
        new Date().toISOString(),
        input.user.userId,
      ),
    database
      .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
      .bind(input.user.userId),
  ]);
  return { ok: true };
}

export async function recoverPassword(input: {
  email: string;
  recoveryCode: string;
  newPassword: string;
  expectedRole: AppRole;
}): Promise<
  | { ok: true; recoveryCode: string }
  | { ok: false; error: string; status: number }
> {
  const passwordError = validatePassword(input.newPassword);
  if (passwordError) return { ok: false, error: passwordError, status: 400 };
  const row = await findUserByEmail(input.email);
  const suppliedHash = await hashOpaqueToken(
    input.recoveryCode.trim().toUpperCase(),
  );
  if (
    !row ||
    row.role !== input.expectedRole ||
    !row.recovery_code_hash ||
    !timingSafeEqual(suppliedHash, row.recovery_code_hash)
  ) {
    return {
      ok: false,
      error: "E-mail ou código de recuperação inválidos.",
      status: 403,
    };
  }

  const passwordData = await hashPassword(input.newPassword);
  const recoveryCode = createRecoveryCode();
  const recoveryCodeHash = await hashOpaqueToken(recoveryCode);
  const database = getD1();
  await database.batch([
    database
      .prepare(
        `UPDATE users
            SET password_hash = ?, password_salt = ?, recovery_code_hash = ?,
                failed_login_count = 0, locked_until = NULL, updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        passwordData.hash,
        passwordData.salt,
        recoveryCodeHash,
        new Date().toISOString(),
        row.id,
      ),
    database.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(row.id),
  ]);
  return { ok: true, recoveryCode };
}

export async function getEstablishmentAccess(establishmentId: string): Promise<{
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
}> {
  await ensureSeedData();
  const database = getD1();
  const [usersResult, invitesResult] = await database.batch([
    database
      .prepare(
        `SELECT u.id, u.display_name, u.email, u.status
           FROM establishments e
           JOIN users u ON u.email = e.owner_email
          WHERE e.id = ? AND u.role = 'merchant'
          ORDER BY u.created_at DESC`,
      )
      .bind(establishmentId),
    database
      .prepare(
        `SELECT email, expires_at
           FROM auth_invitations
          WHERE establishment_id = ?
            AND used_at IS NULL
            AND expires_at > ?
          ORDER BY created_at DESC`,
      )
      .bind(establishmentId, new Date().toISOString()),
  ]);
  const userRows = (usersResult.results ?? []) as Array<
    Record<string, unknown>
  >;
  const inviteRows = (invitesResult.results ?? []) as Array<
    Record<string, unknown>
  >;
  return {
    users: userRows.map((row) => ({
      id: String(row.id),
      displayName: String(row.display_name),
      email: String(row.email),
      status: row.status === "revoked" ? "revoked" : "active",
    })),
    pendingInvitations: inviteRows.map((row) => ({
      email: row.email ? String(row.email) : null,
      expiresAt: String(row.expires_at),
    })),
  };
}
