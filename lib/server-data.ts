import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categories,
  establishments,
  media,
  optionGroups,
  productOptions,
  products,
  users,
} from "@/db/schema";
import { categories as demoCategories, defaultProducts } from "@/lib/demo-data";
import {
  DEFAULT_HOURS,
  slugify,
  type Actor,
  type EstablishmentSummary,
  type MenuProduct,
  type OptionGroup,
  type OpeningHour,
  type PaymentMethod,
  type ServiceMode,
  type StoreBundle,
  type StoreCategory,
  type StoreProfile,
} from "@/lib/models";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { isPostgresD1Database } from "@/lib/postgres-d1";
import { DataError } from "@/lib/data-error";

export { DataError } from "@/lib/data-error";

let schemaReady: Promise<void> | null = null;
let seedReady: Promise<void> | null = null;

const userAuthColumns = [
  {
    name: "password_hash",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "password_salt",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "recovery_code_hash",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    name: "status",
    definition: "TEXT NOT NULL DEFAULT 'active'",
  },
  {
    name: "failed_login_count",
    definition: "INTEGER NOT NULL DEFAULT 0",
  },
  {
    name: "locked_until",
    definition: "TEXT",
  },
] as const;

const postgresTables = [
  "auth_invitations",
  "auth_sessions",
  "categories",
  "establishments",
  "media",
  "option_groups",
  "product_options",
  "products",
  "users",
] as const;

async function hasCurrentPostgresSchema(d1: D1Database) {
  const tables = await d1
    .prepare(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'`,
    )
    .all<{ table_name: string }>();
  const existingTables = new Set(tables.results.map(({ table_name }) => table_name));
  if (!postgresTables.every((table) => existingTables.has(table))) return false;

  const columns = await d1
    .prepare(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users'`,
    )
    .all<{ column_name: string }>();
  const existingColumns = new Set(
    columns.results.map(({ column_name }) => column_name),
  );
  return userAuthColumns.every(({ name }) => existingColumns.has(name));
}

async function ensureUserAuthColumns(d1: D1Database) {
  if (isPostgresD1Database(d1)) {
    for (const column of userAuthColumns) {
      await d1
        .prepare(
          `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column.name} ${column.definition}`,
        )
        .run();
    }
    return;
  }
  const tableInfo = await d1
    .prepare("PRAGMA table_info(users)")
    .all<{ name: string }>();
  const existingColumns = new Set(
    tableInfo.results.map((column) => column.name),
  );

  for (const column of userAuthColumns) {
    if (existingColumns.has(column.name)) continue;
    try {
      await d1
        .prepare(
          `ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`,
        )
        .run();
      existingColumns.add(column.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("duplicate column")) throw error;
    }
  }
}

function adminEmails() {
  return (getRuntimeEnv().ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cents(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number * 100));
}

function clampText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function ensureSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    const d1 = getRuntimeEnv().DB;
    if (!d1) throw new DataError("O banco de dados não está disponível.", 503);

    // Production uses a least-privilege Supabase role. The schema is managed
    // separately, so avoid issuing owner-only DDL on every serverless cold start.
    if (isPostgresD1Database(d1) && (await hasCurrentPostgresSchema(d1))) {
      return;
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'merchant',
        password_hash TEXT NOT NULL DEFAULT '',
        password_salt TEXT NOT NULL DEFAULT '',
        recovery_code_hash TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        failed_login_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)",
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id)",
      "CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx ON auth_sessions (expires_at)",
      `CREATE TABLE IF NOT EXISTS establishments (
        id TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        segment TEXT NOT NULL DEFAULT 'Alimentação',
        slogan TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        whatsapp TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        instagram TEXT NOT NULL DEFAULT '',
        maps_url TEXT NOT NULL DEFAULT '',
        logo_url TEXT NOT NULL DEFAULT '',
        cover_url TEXT NOT NULL DEFAULT '',
        owner_email TEXT,
        management_mode TEXT NOT NULL DEFAULT 'managed',
        status TEXT NOT NULL DEFAULT 'active',
        forced_open_state TEXT NOT NULL DEFAULT 'auto',
        hours_json TEXT NOT NULL DEFAULT '[]',
        service_modes_json TEXT NOT NULL DEFAULT '["entrega","retirada"]',
        payment_methods_json TEXT NOT NULL DEFAULT '["Pix","Dinheiro","Cartão"]',
        delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS establishments_slug_unique ON establishments (slug)",
      "CREATE INDEX IF NOT EXISTS establishments_owner_email_idx ON establishments (owner_email)",
      "CREATE INDEX IF NOT EXISTS establishments_status_idx ON establishments (status)",
      `CREATE TABLE IF NOT EXISTS auth_invitations (
        token_hash TEXT PRIMARY KEY NOT NULL,
        establishment_id TEXT NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
        email TEXT,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS auth_invitations_store_idx ON auth_invitations (establishment_id)",
      "CREATE INDEX IF NOT EXISTS auth_invitations_expires_idx ON auth_invitations (expires_at)",
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        establishment_id TEXT NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS categories_store_slug_unique ON categories (establishment_id, slug)",
      "CREATE INDEX IF NOT EXISTS categories_store_idx ON categories (establishment_id)",
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        establishment_id TEXT NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_cents INTEGER NOT NULL DEFAULT 0,
        image_url TEXT NOT NULL DEFAULT '',
        featured INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL DEFAULT 1,
        badge TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS products_store_idx ON products (establishment_id)",
      "CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id)",
      `CREATE TABLE IF NOT EXISTS option_groups (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 0,
        max_selections INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      "CREATE INDEX IF NOT EXISTS option_groups_product_idx ON option_groups (product_id)",
      `CREATE TABLE IF NOT EXISTS product_options (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      "CREATE INDEX IF NOT EXISTS product_options_group_idx ON product_options (group_id)",
      `CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY NOT NULL,
        establishment_id TEXT NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
        uploaded_by_email TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS media_storage_key_unique ON media (storage_key)",
      "CREATE INDEX IF NOT EXISTS media_store_idx ON media (establishment_id)",
    ];

    await d1.batch(statements.map((statement) => d1.prepare(statement)));
    await ensureUserAuthColumns(d1);
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

async function upsertUser(actor: Actor) {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .insert(users)
    .values({
      id: `user-${crypto.randomUUID()}`,
      email: normalizeEmail(actor.email),
      displayName: actor.displayName,
      role: actor.role,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        displayName: actor.displayName,
        role: actor.role,
        updatedAt: now,
      },
    });
}

export async function ensureSeedData() {
  if (seedReady) return seedReady;

  seedReady = (async () => {
    await ensureSchema();
    const db = getDb();

    for (const email of adminEmails()) {
      await upsertUser({
        email,
        displayName: "Administração OxeMenu",
        role: "admin",
      });
    }

    const demoId = "store-coffe-love";
    await db
      .insert(establishments)
      .values({
        id: demoId,
        slug: "coffe-love",
        name: "Coffe Love",
        segment: "Cafeteria artesanal",
        slogan: "Do grão à xícara.",
        description:
          "Cafés, sobremesas e refeições preparados com carinho em Caruaru.",
        whatsapp: (process.env.DEMO_WHATSAPP ?? "").replace(/\D/g, ""),
        address: "Rua Saldanha Marinho, 380 · Caruaru",
        instagram: "https://instagram.com/cafeteria_coffelove",
        mapsUrl:
          "https://maps.google.com/?q=Rua+Saldanha+Marinho+380+Caruaru+PE",
        coverUrl: "/images/cafe.png",
        managementMode: "managed",
        status: "demo",
        forcedOpenState: "auto",
        hoursJson: JSON.stringify(DEFAULT_HOURS),
        serviceModesJson: JSON.stringify(["entrega", "retirada", "local"]),
        paymentMethodsJson: JSON.stringify(["Pix", "Dinheiro", "Cartão"]),
        deliveryFeeCents: 500,
      })
      .onConflictDoNothing();

    const seededCategories = demoCategories.filter(
      (category) => !["todos", "destaques"].includes(category.id),
    );
    for (const [index, category] of seededCategories.entries()) {
      await db
        .insert(categories)
        .values({
          id: `cat-coffe-love-${category.id}`,
          establishmentId: demoId,
          slug: category.id,
          name: category.label,
          sortOrder: index,
          active: true,
        })
        .onConflictDoNothing();
    }

    for (const [productIndex, product] of defaultProducts.entries()) {
      await db
        .insert(products)
        .values({
          id: product.id,
          establishmentId: demoId,
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          priceCents: cents(product.price),
          imageUrl: product.image,
          featured: product.featured ?? false,
          available: product.available ?? true,
          badge: product.badge ?? "",
          sortOrder: productIndex,
        })
        .onConflictDoNothing();

      for (const [groupIndex, group] of (product.optionGroups ?? []).entries()) {
        const groupId = `${product.id}-group-${groupIndex}`;
        await db
          .insert(optionGroups)
          .values({
            id: groupId,
            productId: product.id,
            name: group.name,
            required: group.required ?? false,
            maxSelections: group.max ?? 1,
            sortOrder: groupIndex,
          })
          .onConflictDoNothing();

        for (const [optionIndex, option] of group.options.entries()) {
          await db
            .insert(productOptions)
            .values({
              id: `${groupId}-option-${optionIndex}`,
              groupId,
              name: option.name,
              priceCents: cents(option.price),
              available: option.available ?? true,
              sortOrder: optionIndex,
            })
            .onConflictDoNothing();
        }
      }
    }
  })().catch((error) => {
    seedReady = null;
    throw error;
  });

  return seedReady;
}

export async function resolveActor(
  email: string,
  displayName = "",
): Promise<Actor | null> {
  await ensureSeedData();
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const db = getDb();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  if (
    existingUser?.role === "admin" &&
    existingUser.status === "active" &&
    existingUser.passwordHash
  ) {
    return {
      email: normalized,
      displayName: displayName || existingUser.displayName || normalized,
      role: "admin",
    };
  }

  const ownedStore = await db.query.establishments.findFirst({
    where: and(
      eq(establishments.ownerEmail, normalized),
      eq(establishments.managementMode, "merchant"),
    ),
  });
  if (
    !ownedStore ||
    !existingUser?.passwordHash ||
    existingUser.status !== "active"
  ) {
    return null;
  }

  const actor: Actor = {
    email: normalized,
    displayName: displayName || existingUser?.displayName || normalized,
    role: "merchant",
  };
  await upsertUser(actor);
  return actor;
}

export async function assertStoreAccess(actor: Actor, establishmentId: string) {
  await ensureSeedData();
  const db = getDb();
  const store = await db.query.establishments.findFirst({
    where: eq(establishments.id, establishmentId),
  });
  if (!store) throw new DataError("Estabelecimento não encontrado.", 404);
  if (
    actor.role !== "admin" &&
    normalizeEmail(store.ownerEmail ?? "") !== normalizeEmail(actor.email)
  ) {
    throw new DataError("Você não tem acesso a este estabelecimento.", 403);
  }
  return store;
}

function rowToStore(
  row: typeof establishments.$inferSelect,
): StoreProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    segment: row.segment,
    slogan: row.slogan,
    description: row.description,
    whatsapp: row.whatsapp,
    address: row.address,
    instagram: row.instagram,
    mapsUrl: row.mapsUrl,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    ownerEmail: row.ownerEmail ?? "",
    managementMode: row.managementMode,
    status: row.status,
    forcedOpenState: row.forcedOpenState,
    hours: parseJson<OpeningHour[]>(row.hoursJson, DEFAULT_HOURS),
    serviceModes: parseJson<ServiceMode[]>(row.serviceModesJson, [
      "entrega",
      "retirada",
    ]),
    paymentMethods: parseJson<PaymentMethod[]>(row.paymentMethodsJson, ["Pix"]),
    deliveryFee: row.deliveryFeeCents / 100,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function buildBundle(
  storeRow: typeof establishments.$inferSelect,
): Promise<StoreBundle> {
  const db = getDb();
  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.establishmentId, storeRow.id))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.establishmentId, storeRow.id))
    .orderBy(asc(products.sortOrder), desc(products.createdAt));
  const productIds = productRows.map((product) => product.id);
  const groupRows = productIds.length
    ? await db
        .select()
        .from(optionGroups)
        .where(inArray(optionGroups.productId, productIds))
        .orderBy(asc(optionGroups.sortOrder))
    : [];
  const groupIds = groupRows.map((group) => group.id);
  const optionRows = groupIds.length
    ? await db
        .select()
        .from(productOptions)
        .where(inArray(productOptions.groupId, groupIds))
        .orderBy(asc(productOptions.sortOrder))
    : [];
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));

  const mappedCategories: StoreCategory[] = categoryRows.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    sortOrder: category.sortOrder,
    active: category.active,
  }));

  const mappedProducts: MenuProduct[] = productRows.map((product) => {
    const productGroups = groupRows
      .filter((group) => group.productId === product.id)
      .map<OptionGroup>((group) => ({
        id: group.id,
        name: group.name,
        required: group.required,
        max: group.maxSelections,
        options: optionRows
          .filter((option) => option.groupId === group.id)
          .map((option) => ({
            id: option.id,
            name: option.name,
            price: option.priceCents / 100,
            available: option.available,
          })),
      }));
    const category = product.categoryId
      ? categoryMap.get(product.categoryId)
      : undefined;
    return {
      id: product.id,
      categoryId: product.categoryId ?? "",
      category: category?.slug ?? "sem-categoria",
      name: product.name,
      description: product.description,
      price: product.priceCents / 100,
      image: product.imageUrl || storeRow.coverUrl || "/images/cafe.png",
      featured: product.featured,
      available: product.available,
      badge: product.badge,
      sortOrder: product.sortOrder,
      optionGroups: productGroups,
    };
  });

  return {
    store: rowToStore(storeRow),
    categories: mappedCategories,
    products: mappedProducts,
  };
}

export async function getStoreBySlug(
  slug: string,
  includeInactive = false,
): Promise<StoreBundle | null> {
  await ensureSeedData();
  const db = getDb();
  const store = await db.query.establishments.findFirst({
    where: eq(establishments.slug, slugify(slug)),
  });
  if (!store || (!includeInactive && store.status === "inactive")) return null;
  return buildBundle(store);
}

export async function getStoreById(id: string): Promise<StoreBundle | null> {
  await ensureSeedData();
  const db = getDb();
  const store = await db.query.establishments.findFirst({
    where: eq(establishments.id, id),
  });
  return store ? buildBundle(store) : null;
}

export async function getMerchantStore(email: string) {
  await ensureSeedData();
  const db = getDb();
  const store = await db.query.establishments.findFirst({
    where: and(
      eq(establishments.ownerEmail, normalizeEmail(email)),
      eq(establishments.managementMode, "merchant"),
    ),
    orderBy: [desc(establishments.updatedAt)],
  });
  return store ? buildBundle(store) : null;
}

export async function listEstablishments(): Promise<EstablishmentSummary[]> {
  await ensureSeedData();
  const db = getDb();
  const rows = await db
    .select()
    .from(establishments)
    .orderBy(desc(establishments.updatedAt), asc(establishments.name));

  return Promise.all(
    rows.map(async (row) => {
      const [countRow] = await db
        .select({ value: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.establishmentId, row.id));
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        segment: row.segment,
        status: row.status,
        ownerEmail: row.ownerEmail ?? "",
        managementMode: row.managementMode,
        logoUrl: row.logoUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        productCount: Number(countRow?.value ?? 0),
      };
    }),
  );
}

export async function getAdminSummary() {
  const stores = await listEstablishments();
  return {
    stores,
    stats: {
      total: stores.length,
      active: stores.filter((store) => store.status === "active").length,
      demos: stores.filter((store) => store.status === "demo").length,
      merchants: stores.filter(
        (store) => store.managementMode === "merchant" && store.ownerEmail,
      ).length,
      products: stores.reduce((sum, store) => sum + store.productCount, 0),
    },
  };
}

type EstablishmentInput = Partial<StoreProfile> & {
  name?: string;
  slug?: string;
};

export async function createEstablishment(input: EstablishmentInput) {
  await ensureSeedData();
  const db = getDb();
  const name = clampText(input.name, 90);
  const slug = slugify(clampText(input.slug || name, 80));
  if (!name) throw new DataError("Informe o nome do estabelecimento.");
  if (slug.length < 3) throw new DataError("Informe um endereço válido.");

  const existing = await db.query.establishments.findFirst({
    where: eq(establishments.slug, slug),
  });
  if (existing) throw new DataError("Esse endereço já está sendo usado.", 409);

  const id = `store-${crypto.randomUUID()}`;
  const ownerEmail = normalizeEmail(input.ownerEmail ?? "");
  const managementMode =
    input.managementMode === "merchant" ? "merchant" : "managed";
  if (managementMode === "merchant" && !ownerEmail.includes("@")) {
    throw new DataError(
      "Informe o e-mail do comerciante para liberar o painel.",
    );
  }

  await db.insert(establishments).values({
    id,
    slug,
    name,
    segment: clampText(input.segment || "Alimentação", 80),
    slogan: clampText(input.slogan, 140),
    description: clampText(input.description, 600),
    whatsapp: clampText(input.whatsapp, 30).replace(/\D/g, ""),
    address: clampText(input.address, 220),
    instagram: clampText(input.instagram, 240),
    mapsUrl: clampText(input.mapsUrl, 500),
    logoUrl: clampText(input.logoUrl, 600),
    coverUrl: clampText(input.coverUrl, 600),
    ownerEmail: ownerEmail || null,
    managementMode,
    status:
      input.status === "demo" || input.status === "inactive"
        ? input.status
        : "active",
    forcedOpenState: "auto",
    hoursJson: JSON.stringify(input.hours?.length ? input.hours : DEFAULT_HOURS),
    serviceModesJson: JSON.stringify(
      input.serviceModes?.length ? input.serviceModes : ["entrega", "retirada"],
    ),
    paymentMethodsJson: JSON.stringify(
      input.paymentMethods?.length ? input.paymentMethods : ["Pix", "Dinheiro"],
    ),
    deliveryFeeCents: cents(input.deliveryFee),
  });

  const baseCategories = [
    { slug: "principais", name: "Principais" },
    { slug: "bebidas", name: "Bebidas" },
    { slug: "sobremesas", name: "Sobremesas" },
  ];
  for (const [index, category] of baseCategories.entries()) {
    await db.insert(categories).values({
      id: `cat-${crypto.randomUUID()}`,
      establishmentId: id,
      slug: category.slug,
      name: category.name,
      sortOrder: index,
      active: true,
    });
  }

  return getStoreById(id);
}

export async function updateEstablishment(
  id: string,
  input: EstablishmentInput,
) {
  await ensureSeedData();
  const db = getDb();
  const existing = await db.query.establishments.findFirst({
    where: eq(establishments.id, id),
  });
  if (!existing) throw new DataError("Estabelecimento não encontrado.", 404);

  const nextSlug = input.slug ? slugify(input.slug) : existing.slug;
  if (nextSlug.length < 3) throw new DataError("Informe um endereço válido.");
  if (nextSlug !== existing.slug) {
    const conflict = await db.query.establishments.findFirst({
      where: eq(establishments.slug, nextSlug),
    });
    if (conflict) throw new DataError("Esse endereço já está sendo usado.", 409);
  }

  const nextMode =
    input.managementMode === "merchant"
      ? "merchant"
      : input.managementMode === "managed"
        ? "managed"
        : existing.managementMode;
  const nextOwner =
    input.ownerEmail === undefined
      ? existing.ownerEmail
      : normalizeEmail(input.ownerEmail) || null;
  if (nextMode === "merchant" && !nextOwner?.includes("@")) {
    throw new DataError(
      "Informe o e-mail do comerciante para liberar o painel.",
    );
  }

  await db
    .update(establishments)
    .set({
      slug: nextSlug,
      name:
        input.name === undefined
          ? existing.name
          : clampText(input.name, 90) || existing.name,
      segment:
        input.segment === undefined
          ? existing.segment
          : clampText(input.segment, 80),
      slogan:
        input.slogan === undefined
          ? existing.slogan
          : clampText(input.slogan, 140),
      description:
        input.description === undefined
          ? existing.description
          : clampText(input.description, 600),
      whatsapp:
        input.whatsapp === undefined
          ? existing.whatsapp
          : clampText(input.whatsapp, 30).replace(/\D/g, ""),
      address:
        input.address === undefined
          ? existing.address
          : clampText(input.address, 220),
      instagram:
        input.instagram === undefined
          ? existing.instagram
          : clampText(input.instagram, 240),
      mapsUrl:
        input.mapsUrl === undefined
          ? existing.mapsUrl
          : clampText(input.mapsUrl, 500),
      logoUrl:
        input.logoUrl === undefined
          ? existing.logoUrl
          : clampText(input.logoUrl, 600),
      coverUrl:
        input.coverUrl === undefined
          ? existing.coverUrl
          : clampText(input.coverUrl, 600),
      ownerEmail: nextOwner,
      managementMode: nextMode,
      status:
        input.status === "active" ||
        input.status === "demo" ||
        input.status === "inactive"
          ? input.status
          : existing.status,
      forcedOpenState:
        input.forcedOpenState === "open" ||
        input.forcedOpenState === "closed" ||
        input.forcedOpenState === "auto"
          ? input.forcedOpenState
          : existing.forcedOpenState,
      hoursJson:
        input.hours === undefined
          ? existing.hoursJson
          : JSON.stringify(input.hours),
      serviceModesJson:
        input.serviceModes === undefined
          ? existing.serviceModesJson
          : JSON.stringify(input.serviceModes),
      paymentMethodsJson:
        input.paymentMethods === undefined
          ? existing.paymentMethodsJson
          : JSON.stringify(input.paymentMethods),
      deliveryFeeCents:
        input.deliveryFee === undefined
          ? existing.deliveryFeeCents
          : cents(input.deliveryFee),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(establishments.id, id));

  return getStoreById(id);
}

export async function createCategory(
  establishmentId: string,
  input: { name?: string },
) {
  await ensureSeedData();
  const db = getDb();
  const name = clampText(input.name, 60);
  const slug = slugify(name);
  if (!name || !slug) throw new DataError("Informe o nome da categoria.");
  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.establishmentId, establishmentId),
      eq(categories.slug, slug),
    ),
  });
  if (existing) throw new DataError("Essa categoria já existe.", 409);
  const [last] = await db
    .select({ value: sql<number>`coalesce(max(${categories.sortOrder}), -1)` })
    .from(categories)
    .where(eq(categories.establishmentId, establishmentId));
  const id = `cat-${crypto.randomUUID()}`;
  await db.insert(categories).values({
    id,
    establishmentId,
    slug,
    name,
    sortOrder: Number(last?.value ?? -1) + 1,
    active: true,
  });
  return { id, slug, name, sortOrder: Number(last?.value ?? -1) + 1, active: true };
}

type ProductInput = Partial<MenuProduct> & {
  name?: string;
  categoryId?: string;
};

async function saveOptionGroups(productId: string, groups: OptionGroup[]) {
  const db = getDb();
  await db.delete(optionGroups).where(eq(optionGroups.productId, productId));
  for (const [groupIndex, group] of groups.entries()) {
    const name = clampText(group.name, 80);
    if (!name) continue;
    const groupId = `group-${crypto.randomUUID()}`;
    await db.insert(optionGroups).values({
      id: groupId,
      productId,
      name,
      required: Boolean(group.required),
      maxSelections: Math.max(1, Math.min(20, Number(group.max) || 1)),
      sortOrder: groupIndex,
    });
    for (const [optionIndex, option] of group.options.entries()) {
      const optionName = clampText(option.name, 80);
      if (!optionName) continue;
      await db.insert(productOptions).values({
        id: `option-${crypto.randomUUID()}`,
        groupId,
        name: optionName,
        priceCents: cents(option.price),
        available: option.available !== false,
        sortOrder: optionIndex,
      });
    }
  }
}

export async function createProduct(
  establishmentId: string,
  input: ProductInput,
) {
  await ensureSeedData();
  const db = getDb();
  const name = clampText(input.name, 100);
  if (!name) throw new DataError("Informe o nome do item.");
  if (!input.categoryId) throw new DataError("Escolha uma categoria.");
  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, input.categoryId),
      eq(categories.establishmentId, establishmentId),
    ),
  });
  if (!category) throw new DataError("Categoria inválida.");
  const [last] = await db
    .select({ value: sql<number>`coalesce(max(${products.sortOrder}), -1)` })
    .from(products)
    .where(eq(products.establishmentId, establishmentId));
  const id = `product-${crypto.randomUUID()}`;
  await db.insert(products).values({
    id,
    establishmentId,
    categoryId: category.id,
    name,
    description: clampText(input.description, 600),
    priceCents: cents(input.price),
    imageUrl: clampText(input.image, 600),
    featured: Boolean(input.featured),
    available: input.available !== false,
    badge: clampText(input.badge, 40),
    sortOrder: Number(last?.value ?? -1) + 1,
  });
  await saveOptionGroups(id, input.optionGroups ?? []);
  return getStoreById(establishmentId);
}

export async function updateProduct(id: string, input: ProductInput) {
  await ensureSeedData();
  const db = getDb();
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  if (!existing) throw new DataError("Item não encontrado.", 404);
  let categoryId = existing.categoryId;
  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, input.categoryId),
        eq(categories.establishmentId, existing.establishmentId),
      ),
    });
    if (!category) throw new DataError("Categoria inválida.");
    categoryId = category.id;
  }
  await db
    .update(products)
    .set({
      categoryId,
      name:
        input.name === undefined
          ? existing.name
          : clampText(input.name, 100) || existing.name,
      description:
        input.description === undefined
          ? existing.description
          : clampText(input.description, 600),
      priceCents:
        input.price === undefined ? existing.priceCents : cents(input.price),
      imageUrl:
        input.image === undefined
          ? existing.imageUrl
          : clampText(input.image, 600),
      featured:
        input.featured === undefined ? existing.featured : Boolean(input.featured),
      available:
        input.available === undefined
          ? existing.available
          : Boolean(input.available),
      badge:
        input.badge === undefined ? existing.badge : clampText(input.badge, 40),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(products.id, id));
  if (input.optionGroups !== undefined) {
    await saveOptionGroups(id, input.optionGroups);
  }
  return getStoreById(existing.establishmentId);
}

export async function deleteProduct(id: string) {
  await ensureSeedData();
  const db = getDb();
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  if (!existing) throw new DataError("Item não encontrado.", 404);
  await db.delete(products).where(eq(products.id, id));
  return getStoreById(existing.establishmentId);
}

export async function getProductStoreId(productId: string) {
  await ensureSeedData();
  const db = getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  return product?.establishmentId ?? null;
}

export async function saveMediaRecord(input: {
  establishmentId: string;
  uploadedByEmail: string;
  storageKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  await ensureSeedData();
  const db = getDb();
  const id = `media-${crypto.randomUUID()}`;
  await db.insert(media).values({ id, ...input });
  return { id, url: `/api/media/${encodeURIComponent(id)}` };
}

export async function getMediaRecord(id: string) {
  await ensureSchema();
  const db = getDb();
  return db.query.media.findFirst({ where: eq(media.id, id) });
}

export function getBucket() {
  const bucket = getRuntimeEnv().BUCKET;
  if (!bucket) throw new DataError("O armazenamento de fotos não está disponível.", 503);
  return bucket;
}
