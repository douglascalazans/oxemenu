import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    role: text("role", { enum: ["admin", "merchant"] })
      .notNull()
      .default("merchant"),
    passwordHash: text("password_hash").notNull().default(""),
    passwordSalt: text("password_salt").notNull().default(""),
    recoveryCodeHash: text("recovery_code_hash").notNull().default(""),
    status: text("status", { enum: ["active", "revoked"] })
      .notNull()
      .default("active"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: text("locked_until"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const establishments = sqliteTable(
  "establishments",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    segment: text("segment").notNull().default("Alimentação"),
    slogan: text("slogan").notNull().default(""),
    description: text("description").notNull().default(""),
    whatsapp: text("whatsapp").notNull().default(""),
    address: text("address").notNull().default(""),
    instagram: text("instagram").notNull().default(""),
    mapsUrl: text("maps_url").notNull().default(""),
    logoUrl: text("logo_url").notNull().default(""),
    coverUrl: text("cover_url").notNull().default(""),
    ownerEmail: text("owner_email"),
    managementMode: text("management_mode", {
      enum: ["managed", "merchant"],
    })
      .notNull()
      .default("managed"),
    status: text("status", { enum: ["active", "demo", "inactive"] })
      .notNull()
      .default("active"),
    forcedOpenState: text("forced_open_state", {
      enum: ["auto", "open", "closed"],
    })
      .notNull()
      .default("auto"),
    hoursJson: text("hours_json").notNull().default("[]"),
    serviceModesJson: text("service_modes_json")
      .notNull()
      .default('["entrega","retirada"]'),
    paymentMethodsJson: text("payment_methods_json")
      .notNull()
      .default('["Pix","Dinheiro","Cartão"]'),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("establishments_slug_unique").on(table.slug),
    index("establishments_owner_email_idx").on(table.ownerEmail),
    index("establishments_status_idx").on(table.status),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const authInvitations = sqliteTable(
  "auth_invitations",
  {
    tokenHash: text("token_hash").primaryKey(),
    establishmentId: text("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    email: text("email"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("auth_invitations_store_idx").on(table.establishmentId),
    index("auth_invitations_expires_idx").on(table.expiresAt),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    establishmentId: text("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("categories_store_slug_unique").on(
      table.establishmentId,
      table.slug,
    ),
    index("categories_store_idx").on(table.establishmentId),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    establishmentId: text("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull().default(0),
    imageUrl: text("image_url").notNull().default(""),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    badge: text("badge").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("products_store_idx").on(table.establishmentId),
    index("products_category_idx").on(table.categoryId),
  ],
);

export const optionGroups = sqliteTable(
  "option_groups",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    maxSelections: integer("max_selections").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("option_groups_product_idx").on(table.productId)],
);

export const productOptions = sqliteTable(
  "product_options",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("product_options_group_idx").on(table.groupId)],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    establishmentId: text("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    uploadedByEmail: text("uploaded_by_email").notNull(),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("media_storage_key_unique").on(table.storageKey),
    index("media_store_idx").on(table.establishmentId),
  ],
);
