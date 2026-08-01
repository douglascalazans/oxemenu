export type ActorRole = "admin" | "merchant";

export type Actor = {
  email: string;
  displayName: string;
  role: ActorRole;
};

export type OpeningHour = {
  day: number;
  label: string;
  enabled: boolean;
  opens: string;
  closes: string;
};

export type ServiceMode = "entrega" | "retirada" | "local";
export type PaymentMethod = "Pix" | "Dinheiro" | "Cartão";

export type StoreProfile = {
  id: string;
  slug: string;
  name: string;
  segment: string;
  slogan: string;
  description: string;
  whatsapp: string;
  address: string;
  instagram: string;
  mapsUrl: string;
  logoUrl: string;
  coverUrl: string;
  ownerEmail: string;
  managementMode: "managed" | "merchant";
  status: "active" | "demo" | "inactive";
  forcedOpenState: "auto" | "open" | "closed";
  hours: OpeningHour[];
  serviceModes: ServiceMode[];
  paymentMethods: PaymentMethod[];
  deliveryFee: number;
  createdAt: string;
  updatedAt: string;
};

export type StoreCategory = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type ProductOption = {
  id?: string;
  name: string;
  price: number;
  available?: boolean;
};

export type OptionGroup = {
  id?: string;
  name: string;
  required?: boolean;
  max?: number;
  options: ProductOption[];
};

export type MenuProduct = {
  id: string;
  categoryId: string;
  category: string;
  name: string;
  description: string;
  price: number;
  image: string;
  featured?: boolean;
  available?: boolean;
  badge?: string;
  sortOrder?: number;
  optionGroups?: OptionGroup[];
};

export type StoreBundle = {
  store: StoreProfile;
  categories: StoreCategory[];
  products: MenuProduct[];
};

export type EstablishmentSummary = Pick<
  StoreProfile,
  | "id"
  | "slug"
  | "name"
  | "segment"
  | "status"
  | "ownerEmail"
  | "managementMode"
  | "logoUrl"
  | "createdAt"
  | "updatedAt"
> & {
  productCount: number;
};

export const DEFAULT_HOURS: OpeningHour[] = [
  { day: 0, label: "Domingo", enabled: false, opens: "08:00", closes: "17:00" },
  { day: 1, label: "Segunda-feira", enabled: true, opens: "08:00", closes: "17:00" },
  { day: 2, label: "Terça-feira", enabled: true, opens: "08:00", closes: "17:00" },
  { day: 3, label: "Quarta-feira", enabled: true, opens: "08:00", closes: "17:00" },
  { day: 4, label: "Quinta-feira", enabled: true, opens: "08:00", closes: "17:00" },
  { day: 5, label: "Sexta-feira", enabled: true, opens: "08:00", closes: "17:00" },
  { day: 6, label: "Sábado", enabled: false, opens: "08:00", closes: "17:00" },
];

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
