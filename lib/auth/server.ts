import { headers } from "next/headers";
import {
  createRecoveryCode,
  hashOpaqueToken,
  hashPassword,
  PASSWORD_ITERATIONS,
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
import { isValidInvitationToken } from "@/lib/security";

const SESSION_COOKIE = "caruarufood_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
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

function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return "Informe um e-mail válido.";
  }
  return null;
}

function clientAddress(request: Request): string {
  const netlifyAddress = request.headers.get("x-nf-client-connection-ip");
  const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (netlifyAddress ?? forwardedAddress ?? "unknown").trim().slice(0, 64);
}

async function incrementRateLimit(input: {
  action: string;
  identity: string;
  windowMinutes: number;
}): Promise<number> {
  const database = getD1();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + input.windowMinutes * 60 * 1000,
  ).toISOString();
  const keyHash = await hashOpaqueToken(
    `${input.action}|${input.identity.slice(0, 320)}`,
  );
  const row = await database
    .prepare(
      `INSERT INTO auth_rate_limits (
         key_hash, action, attempts, window_started_at, expires_at, updated_at
       ) VALUES (?, ?, 1, ?, ?, ?)
       ON CONFLICT (key_hash) DO UPDATE SET
         attempts = CASE
           WHEN auth_rate_limits.expires_at <= excluded.window_started_at THEN 1
           ELSE auth_rate_limits.attempts + 1
         END,
         window_started_at = CASE
           WHEN auth_rate_limits.expires_at <= excluded.window_started_at
             THEN excluded.window_started_at
           ELSE auth_rate_limits.window_started_at
         END,
         expires_at = CASE
           WHEN auth_rate_limits.expires_at <= excluded.window_started_at
             THEN excluded.expires_at
           ELSE auth_rate_limits.expires_at
         END,
         updated_at = excluded.updated_at
       RETURNING attempts`,
    )
    .bind(
      keyHash,
      input.action,
      now.toISOString(),
      expiresAt,
      now.toISOString(),
    )
    .first<{ attempts: number }>();
  return Number(row?.attempts ?? 1);
}

export async function enforceAuthRateLimit(input: {
  request: Request;
  action: string;
  subject: string;
  maximum: number;
  windowMinutes?: number;
}): Promise<void> {
  await ensureSeedData();
  const address = clientAddress(input.request);
  const subject = input.subject.trim().toLowerCase().slice(0, 256);
  const windowMinutes = input.windowMinutes ?? 15;
  const [subjectAttempts, addressAttempts] = await Promise.all([
    incrementRateLimit({
      action: input.action,
      identity: `subject:${address}:${subject}`,
      windowMinutes,
    }),
    incrementRateLimit({
      action: input.action,
      identity: `address:${address}`,
      windowMinutes,
    }),
  ]);
  void getD1()
    .prepare("DELETE FROM auth_rate_limits WHERE expires_at < ?")
    .bind(new Date(Date.now() - 60_000).toISOString())
    .run()
    .catch(() => undefined);
  if (subjectAttempts > input.maximum || addressAttempts > input.maximum * 5) {
    throw new DataError(
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      429,
    );
  }
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
                password_iterations,
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
                password_iterations,
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
              u.password_iterations,
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
  await enforceAuthRateLimit({
    request: input.request,
    action: `login:${input.expectedRole}`,
    subject: normalizeEmail(input.email),
    maximum: 8,
  });
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
    row.password_iterations || 100_000,
  );
  if (!matches || row.status !== "active") {
    return { ok: false, error: "E-mail ou senha inválidos.", status: 401 };
  }

  if (row.role !== input.expectedRole) {
    return {
      ok: false,
      error: "E-mail ou senha inválidos.",
      status: 401,
    };
  }

  const upgradedPassword =
    row.password_iterations < PASSWORD_ITERATIONS
      ? await hashPassword(input.password)
      : null;
  await getD1()
    .prepare(
      `UPDATE users
          SET failed_login_count = 0, locked_until = NULL,
              password_hash = ?, password_salt = ?, password_iterations = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      upgradedPassword?.hash ?? row.password_hash,
      upgradedPassword?.salt ?? row.password_salt,
      upgradedPassword ? PASSWORD_ITERATIONS : row.password_iterations,
      now.toISOString(),
      row.id,
    )
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
  await enforceAuthRateLimit({
    request: input.request,
    action: "register-admin",
    subject: normalizeEmail(input.email),
    maximum: 5,
    windowMinutes: 30,
  });
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
    validateName(input.displayName) ??
    validateEmail(input.email) ??
    validatePassword(input.password);
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
                password_salt = ?, password_iterations = ?,
                recovery_code_hash = ?, status = 'active',
                failed_login_count = 0, locked_until = NULL, updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        input.displayName.trim(),
        passwordData.hash,
        passwordData.salt,
        PASSWORD_ITERATIONS,
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
           password_iterations, recovery_code_hash, status
         ) VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, 'active')`,
      )
      .bind(
        userId,
        email,
        input.displayName.trim(),
        passwordData.hash,
        passwordData.salt,
        PASSWORD_ITERATIONS,
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
    .prepare(
      `SELECT id, owner_email, management_mode
         FROM establishments
        WHERE id = ?
        LIMIT 1`,
    )
    .bind(input.establishmentId)
    .first<{
      id: string;
      owner_email: string | null;
      management_mode: string;
    }>();
  if (!store) throw new DataError("Estabelecimento não encontrado.", 404);
  if (store.management_mode !== "merchant" || !store.owner_email) {
    throw new DataError(
      "Defina o e-mail do comerciante antes de gerar o convite.",
    );
  }

  const token = randomToken(24);
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const ownerEmail = normalizeEmail(store.owner_email);
  const email = input.email?.trim() ? normalizeEmail(input.email) : ownerEmail;
  if (email !== ownerEmail) {
    throw new DataError(
      "O convite deve usar o e-mail vinculado ao estabelecimento.",
    );
  }
  const database = getD1();
  const now = new Date().toISOString();
  await database.batch([
    database
      .prepare(
        `UPDATE auth_invitations SET used_at = ?
          WHERE establishment_id = ? AND used_at IS NULL`,
      )
      .bind(now, input.establishmentId),
    database
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
      ),
  ]);
  const url = new URL("/painel/cadastro", input.request.url);
  url.searchParams.set("convite", token);
  return { inviteUrl: url.toString(), expiresAt };
}

export async function registerMerchant(input: {
  displayName: string;
  email: string;
  password: string;
  invitationToken: string;
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
  await enforceAuthRateLimit({
    request: input.request,
    action: "register-merchant",
    subject: normalizeEmail(input.email),
    maximum: 6,
    windowMinutes: 30,
  });
  const validationError =
    validateName(input.displayName) ??
    validateEmail(input.email) ??
    validatePassword(input.password);
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }
  const email = normalizeEmail(input.email);
  const database = getD1();
  if (!isValidInvitationToken(input.invitationToken)) {
    return {
      ok: false,
      error: "Convite inválido ou expirado. Solicite um novo convite à OxeMenu.",
      status: 403,
    };
  }
  const tokenHash = await hashOpaqueToken(input.invitationToken.trim());
  const authorizedStore = await database
    .prepare(
      `SELECT e.id
         FROM auth_invitations i
         JOIN establishments e ON e.id = i.establishment_id
        WHERE i.token_hash = ?
          AND i.used_at IS NULL
          AND i.expires_at > ?
          AND i.email = ?
          AND e.owner_email = ?
          AND e.management_mode = 'merchant'
        LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString(), email, email)
    .first<{ id: string }>();
  if (!authorizedStore) {
    return {
      ok: false,
      error: "Convite inválido ou expirado. Solicite um novo convite à OxeMenu.",
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
                  password_salt = ?, password_iterations = ?,
                  recovery_code_hash = ?, status = 'active',
                  failed_login_count = 0, locked_until = NULL, updated_at = ?
            WHERE id = ?`,
        )
        .bind(
          input.displayName.trim(),
          passwordData.hash,
          passwordData.salt,
          PASSWORD_ITERATIONS,
          recoveryCodeHash,
          now,
          userId,
        )
    : database
        .prepare(
          `INSERT INTO users (
             id, email, display_name, role, password_hash, password_salt,
             password_iterations, recovery_code_hash, status
           ) VALUES (?, ?, ?, 'merchant', ?, ?, ?, ?, 'active')`,
        )
        .bind(
          userId,
          email,
          input.displayName.trim(),
          passwordData.hash,
          passwordData.salt,
          PASSWORD_ITERATIONS,
          recoveryCodeHash,
        );
  await database.batch([
    userStatement,
    database
      .prepare(
        `UPDATE auth_invitations SET used_at = ?
          WHERE token_hash = ? AND used_at IS NULL`,
      )
      .bind(now, tokenHash),
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
  request: Request;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  await enforceAuthRateLimit({
    request: input.request,
    action: "change-password",
    subject: input.user.userId,
    maximum: 8,
    windowMinutes: 30,
  });
  const passwordError = validatePassword(input.newPassword);
  if (passwordError) return { ok: false, error: passwordError, status: 400 };
  const row = await findUserById(input.user.userId);
  if (
    !row ||
    !(await verifyPassword(
      input.currentPassword,
      row.password_hash,
      row.password_salt,
      row.password_iterations || 100_000,
    ))
  ) {
    return { ok: false, error: "A senha atual está incorreta.", status: 403 };
  }
  const passwordData = await hashPassword(input.newPassword);
  const database = getD1();
  await database.batch([
    database
      .prepare(
        `UPDATE users
            SET password_hash = ?, password_salt = ?, password_iterations = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        passwordData.hash,
        passwordData.salt,
        PASSWORD_ITERATIONS,
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
  request: Request;
}): Promise<
  | { ok: true; recoveryCode: string }
  | { ok: false; error: string; status: number }
> {
  await enforceAuthRateLimit({
    request: input.request,
    action: `recover-password:${input.expectedRole}`,
    subject: normalizeEmail(input.email),
    maximum: 6,
    windowMinutes: 30,
  });
  const passwordError = validatePassword(input.newPassword);
  if (passwordError) return { ok: false, error: passwordError, status: 400 };
  if (validateEmail(input.email)) {
    return {
      ok: false,
      error: "E-mail ou código de recuperação inválidos.",
      status: 403,
    };
  }
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
            SET password_hash = ?, password_salt = ?, password_iterations = ?,
                recovery_code_hash = ?,
                failed_login_count = 0, locked_until = NULL, updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        passwordData.hash,
        passwordData.salt,
        PASSWORD_ITERATIONS,
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
