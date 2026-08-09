export type AppRuntimeEnv = {
  ASSETS?: Fetcher;
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ADMIN_EMAILS?: string;
  ADMIN_SETUP_CODE?: string;
  IMAGES?: unknown;
};

import { getPostgresD1Database } from "@/lib/postgres-d1";
import { createSupabaseBucketAdapter } from "@/lib/supabase-storage";

const ENV_KEY = "__CARUARUFOOD_RUNTIME_ENV__";

export function setRuntimeEnv(value: AppRuntimeEnv) {
  (globalThis as typeof globalThis & Record<string, unknown>)[ENV_KEY] = value;
}

export function getRuntimeEnv(): AppRuntimeEnv {
  const runtime =
    (((globalThis as typeof globalThis & Record<string, unknown>)[
      ENV_KEY
    ] as AppRuntimeEnv | undefined) ?? {});

  if (!runtime.DB && process.env.DATABASE_URL) {
    runtime.DB = getPostgresD1Database(process.env.DATABASE_URL);
  }
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.SUPABASE_DATABASE_URL;
  if (!runtime.BUCKET && supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    runtime.BUCKET = createSupabaseBucketAdapter();
  }
  runtime.ADMIN_EMAILS ??= process.env.ADMIN_EMAILS;
  runtime.ADMIN_SETUP_CODE ??= process.env.ADMIN_SETUP_CODE;
  return runtime;
}
