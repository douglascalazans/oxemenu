"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  DEFAULT_HOURS,
  formatBRL,
  initials,
  slugify,
  type ActorRole,
  type EstablishmentSummary,
  type MenuProduct,
  type OpeningHour,
  type OptionGroup,
  type PaymentMethod,
  type ServiceMode,
  type StoreBundle,
  type StoreProfile,
} from "@/lib/models";
import { AccessManager } from "@/components/access-manager";
import { BrandLogo } from "@/components/brand-logo";

type Role = "admin" | "merchant";

type ApiFailure = {
  error?: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T & ApiFailure;
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a ação.");
  }
  return data;
}

function Brand({ light = false }: { light?: boolean }) {
  return <BrandLogo light={light} />;
}

function DashboardShell({
  role,
  active,
  storeName,
  children,
}: {
  role: Role;
  active: string;
  storeName?: string;
  children: ReactNode;
}) {
  const admin = role === "admin";
  const links = admin
    ? [
        { href: "/admin", label: "Visão geral", icon: "⌂", key: "home" },
        {
          href: "/admin/estabelecimentos",
          label: "Estabelecimentos",
          icon: "▦",
          key: "stores",
        },
        {
          href: "/admin/estabelecimentos/novo",
          label: "Novo estabelecimento",
          icon: "+",
          key: "new",
        },
        { href: "/conta", label: "Minha conta", icon: "⚙", key: "account" },
      ]
    : [
        { href: "/painel", label: "Meu cardápio", icon: "▦", key: "menu" },
        {
          href: storeName ? `/${slugify(storeName)}` : "/painel",
          label: "Visualizar",
          icon: "↗",
          key: "view",
        },
        { href: "/conta", label: "Minha conta", icon: "⚙", key: "account" },
      ];

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <a className="brand-link" href="/" aria-label="OxeMenu, início">
          <Brand light />
        </a>
        <div className="sidebar-context">
          <div>{admin ? "OM" : initials(storeName || "Loja")}</div>
          <p>
            <strong>{admin ? "Administração" : storeName || "Meu negócio"}</strong>
            <span>{admin ? "Painel geral" : "Painel do comerciante"}</span>
          </p>
        </div>
        <nav aria-label="Menu do painel">
          {links.map((link) => (
            <a
              className={active === link.key ? "active" : ""}
              href={link.href}
              key={link.key}
            >
              <span>{link.icon}</span>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/coffe-love">
            <span>◎</span> Ver demonstração
          </a>
          <button
            className="sidebar-logout"
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = admin ? "/admin/login" : "/painel/login";
            }}
          >
            <span>↪</span> Sair com segurança
          </button>
        </div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-mobile-header">
          <a href="/">
            <Brand />
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = admin ? "/admin/login" : "/painel/login";
            }}
          >
            Sair
          </button>
        </header>
        {children}
      </section>
    </main>
  );
}

function LoadingPanel({ text = "Carregando dados…" }: { text?: string }) {
  return (
    <div className="panel-card dashboard-loading" aria-busy="true">
      <span className="loading-dot">O</span>
      <strong>{text}</strong>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="panel-card dashboard-error">
      <span>!</span>
      <div>
        <strong>Não foi possível carregar</strong>
        <p>{message}</p>
      </div>
      <a className="secondary-button" href="/">
        Voltar
      </a>
    </div>
  );
}

type AdminSummary = {
  stores: EstablishmentSummary[];
  stats: {
    total: number;
    active: number;
    demos: number;
    merchants: number;
    products: number;
  };
};

export function AdminDashboard() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<AdminSummary>("/api/admin/dashboard")
      .then(setData)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Erro inesperado."),
      );
  }, []);

  return (
    <DashboardShell role="admin" active="home">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Central OxeMenu</p>
          <h1>Visão geral</h1>
          <p>Acompanhe clientes, cardápios e acessos em um só lugar.</p>
        </div>
        <a className="primary-button" href="/admin/estabelecimentos/novo">
          + Novo estabelecimento
        </a>
      </div>
      {error ? (
        <ErrorPanel message={error} />
      ) : !data ? (
        <LoadingPanel />
      ) : (
        <>
          <section className="stats-grid">
            {[
              ["▦", "brown", "Estabelecimentos", data.stats.total, "Total cadastrado"],
              ["✓", "green", "Ativos", data.stats.active, "Abertos ao público"],
              ["✦", "amber", "Demonstrações", data.stats.demos, "Para prospecção"],
              ["♙", "rose", "Itens publicados", data.stats.products, `${data.stats.merchants} acessos de lojista`],
            ].map(([icon, tone, label, value, note]) => (
              <article key={String(label)}>
                <span className={`stat-icon ${tone}`}>{icon}</span>
                <p>{label}</p>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </section>
          <section className="dashboard-columns">
            <div className="panel-card">
              <header>
                <h2>Estabelecimentos recentes</h2>
                <a href="/admin/estabelecimentos">Ver todos →</a>
              </header>
              <div className="compact-list">
                {data.stores.slice(0, 6).map((store) => (
                  <a href={`/admin/estabelecimentos/${store.id}`} key={store.id}>
                    <span className="store-avatar">{initials(store.name)}</span>
                    <p>
                      <strong>{store.name}</strong>
                      <small>{store.segment} · {store.productCount} itens</small>
                    </p>
                    <span className={`table-status ${store.status}`}>
                      {store.status === "active"
                        ? "Ativo"
                        : store.status === "demo"
                          ? "Demonstração"
                          : "Inativo"}
                    </span>
                    <b>›</b>
                  </a>
                ))}
              </div>
            </div>
            <div className="panel-card activity-card">
              <header>
                <h2>Sistema operacional</h2>
              </header>
              <ol>
                <li>
                  <span>DB</span>
                  <p>
                    <strong>Dados permanentes</strong>
                    Produtos e configurações são compartilhados por todos.
                  </p>
                </li>
                <li>
                  <span>ID</span>
                  <p>
                    <strong>Acesso individual</strong>
                    Cada comerciante enxerga somente seu negócio.
                  </p>
                </li>
                <li>
                  <span>IMG</span>
                  <p>
                    <strong>Fotos na nuvem</strong>
                    Imagens permanecem disponíveis em qualquer aparelho.
                  </p>
                </li>
              </ol>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}

export function EstablishmentsList() {
  const [stores, setStores] = useState<EstablishmentSummary[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<{ stores: EstablishmentSummary[] }>("/api/admin/establishments")
      .then((data) => setStores(data.stores))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Erro inesperado."),
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR").trim();
    return stores.filter((store) => {
      const matchesText =
        !normalized ||
        `${store.name} ${store.segment} ${store.slug}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesText && (filter === "all" || store.status === filter);
    });
  }, [stores, query, filter]);

  return (
    <DashboardShell role="admin" active="stores">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Gestão de clientes</p>
          <h1>Estabelecimentos</h1>
          <p>Crie, edite e publique cardápios independentes.</p>
        </div>
        <a className="primary-button" href="/admin/estabelecimentos/novo">
          + Adicionar
        </a>
      </div>
      {error ? (
        <ErrorPanel message={error} />
      ) : loading ? (
        <LoadingPanel />
      ) : (
        <section className="panel-card store-table-card">
          <div className="table-tools">
            <label className="search-box dashboard-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, segmento ou endereço"
              />
            </label>
            <div className="filter-pills">
              {[
                ["all", "Todos"],
                ["active", "Ativos"],
                ["demo", "Demos"],
                ["inactive", "Inativos"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="desktop-table">
            <div className="table-row table-head">
              <span>Estabelecimento</span>
              <span>Endereço</span>
              <span>Itens</span>
              <span>Status</span>
              <span>Ações</span>
            </div>
            {visible.map((store) => (
              <div className="table-row" key={store.id}>
                <div className="store-cell">
                  <span className="store-avatar">{initials(store.name)}</span>
                  <p>
                    <strong>{store.name}</strong>
                    <small>{store.segment}</small>
                  </p>
                </div>
                <span className="slug-cell">/{store.slug}</span>
                <span>{store.productCount} itens</span>
                <span className={`table-status ${store.status}`}>
                  {store.status === "active"
                    ? "Ativo"
                    : store.status === "demo"
                      ? "Demonstração"
                      : "Inativo"}
                </span>
                <div className="table-actions">
                  <a href={`/${store.slug}`} target="_blank" rel="noreferrer">↗</a>
                  <a href={`/admin/estabelecimentos/${store.id}`}>Editar</a>
                </div>
              </div>
            ))}
          </div>
          {!visible.length && (
            <div className="empty-state compact-empty">
              <h3>Nenhum estabelecimento encontrado</h3>
              <p>Altere a busca ou cadastre um novo cliente.</p>
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}

export function NewEstablishment() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [segment, setSegment] = useState("Alimentação");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [managementMode, setManagementMode] =
    useState<StoreProfile["managementMode"]>("managed");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [status, setStatus] = useState<StoreProfile["status"]>("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const bundle = await requestJson<StoreBundle>("/api/admin/establishments", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: slug || slugify(name),
          segment,
          whatsapp,
          address,
          managementMode,
          ownerEmail,
          status,
        }),
      });
      window.location.href = `/admin/estabelecimentos/${bundle.store.id}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado.");
      setSaving(false);
    }
  };

  return (
    <DashboardShell role="admin" active="new">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Novo cliente</p>
          <h1>Adicionar estabelecimento</h1>
          <p>Depois do cadastro, você poderá incluir fotos, categorias e itens.</p>
        </div>
        <a className="secondary-button" href="/admin/estabelecimentos">
          Cancelar
        </a>
      </div>
      <form className="editor-layout" onSubmit={submit}>
        <section className="panel-card editor-card">
          <header>
            <h2>Informações do negócio</h2>
          </header>
          <div className="form-grid admin-form-grid">
            <label className="wide">
              <span>Nome do estabelecimento *</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slug) setSlug(slugify(event.target.value));
                }}
                placeholder="Ex.: Lanchonete da Praça"
                required
              />
            </label>
            <label>
              <span>Segmento</span>
              <input
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                placeholder="Cafeteria, pizzaria..."
              />
            </label>
            <label>
              <span>WhatsApp</span>
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder="5581999999999"
              />
            </label>
            <label className="wide">
              <span>Endereço do cardápio *</span>
              <div className="input-prefix">
                <span>oxemenu/</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(slugify(event.target.value))}
                  placeholder="nome-da-loja"
                  required
                />
              </div>
            </label>
            <label className="wide">
              <span>Endereço físico</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Rua, número e bairro"
              />
            </label>
          </div>
        </section>
        <aside className="panel-card create-summary">
          <h3>Forma de gestão</h3>
          <label className="choice-card">
            <input
              type="radio"
              checked={managementMode === "managed"}
              onChange={() => setManagementMode("managed")}
            />
            <span>
              <strong>Eu gerencio</strong>
              Somente você altera o cardápio pelo painel administrativo.
            </span>
          </label>
          <label className="choice-card">
            <input
              type="radio"
              checked={managementMode === "merchant"}
              onChange={() => setManagementMode("merchant")}
            />
            <span>
              <strong>O comerciante gerencia</strong>
              O cliente entra com a própria conta e vê apenas este negócio.
            </span>
          </label>
          {managementMode === "merchant" && (
            <label className="standalone-field">
              <span>E-mail da conta do comerciante *</span>
              <input
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="cliente@email.com"
                required
              />
            </label>
          )}
          <label className="standalone-field">
            <span>Publicação inicial</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as StoreProfile["status"])
              }
            >
              <option value="active">Ativo</option>
              <option value="demo">Demonstração</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={saving}>
            {saving ? "Criando…" : "Criar estabelecimento"}
          </button>
        </aside>
      </form>
    </DashboardShell>
  );
}

type ProductDraft = {
  name: string;
  categoryId: string;
  description: string;
  price: string;
  image: string;
  featured: boolean;
  available: boolean;
  badge: string;
  optionGroups: OptionGroup[];
};

function emptyProduct(categoryId = ""): ProductDraft {
  return {
    name: "",
    categoryId,
    description: "",
    price: "",
    image: "",
    featured: false,
    available: true,
    badge: "",
    optionGroups: [],
  };
}

function draftFromProduct(product: MenuProduct): ProductDraft {
  return {
    name: product.name,
    categoryId: product.categoryId,
    description: product.description,
    price: product.price.toFixed(2).replace(".", ","),
    image: product.image,
    featured: Boolean(product.featured),
    available: product.available !== false,
    badge: product.badge || "",
    optionGroups: product.optionGroups ?? [],
  };
}

async function uploadImage(file: File, establishmentId: string) {
  const form = new FormData();
  form.set("establishmentId", establishmentId);
  form.set("file", file);
  return requestJson<{ url: string }>("/api/uploads", {
    method: "POST",
    body: form,
  });
}

function ProductDialog({
  storeId,
  categories,
  product,
  onClose,
  onSaved,
}: {
  storeId: string;
  categories: StoreBundle["categories"];
  product?: MenuProduct;
  onClose(): void;
  onSaved(bundle: StoreBundle): void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(
    product ? draftFromProduct(product) : emptyProduct(categories[0]?.id),
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateGroup = (index: number, patch: Partial<OptionGroup>) => {
    setDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...patch } : group,
      ),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let image = draft.image;
      if (file) image = (await uploadImage(file, storeId)).url;
      const payload = {
        ...draft,
        image,
        price: Number(draft.price.replace(",", ".")) || 0,
      };
      const bundle = product
        ? await requestJson<StoreBundle>(
            `/api/manage/products/${encodeURIComponent(product.id)}`,
            { method: "PATCH", body: JSON.stringify(payload) },
          )
        : await requestJson<StoreBundle>(
            `/api/manage/stores/${encodeURIComponent(storeId)}/products`,
            { method: "POST", body: JSON.stringify(payload) },
          );
      onSaved(bundle);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado.");
      setSaving(false);
    }
  };

  return (
    <div className="product-create-backdrop" role="dialog" aria-modal="true">
      <section className="product-create-dialog">
        <header className="product-create-header">
          <div>
            <p className="eyebrow">{product ? "Editar item" : "Novo item"}</p>
            <h2>{product ? product.name : "Adicionar ao cardápio"}</h2>
            <p>Fotos, preço, adicionais e disponibilidade ficam salvos para todos.</p>
          </div>
          <button className="dialog-close" type="button" onClick={onClose}>×</button>
        </header>
        <form className="product-create-form" onSubmit={submit}>
          <div className="form-grid">
            <label>
              <span>Nome *</span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>
            <label>
              <span>Categoria *</span>
              <select
                value={draft.categoryId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                required
              >
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              <span>Descrição</span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                maxLength={600}
              />
            </label>
            <label>
              <span>Preço *</span>
              <div className="product-price-field">
                <span>R$</span>
                <input
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, price: event.target.value }))
                  }
                  placeholder="0,00"
                  required
                />
              </div>
            </label>
            <label>
              <span>Selo opcional</span>
              <input
                value={draft.badge}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, badge: event.target.value }))
                }
                placeholder="Mais pedido"
              />
            </label>
            <label className="wide product-image-field">
              <span>Foto do item</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <small>JPG, PNG, WEBP ou GIF, com até 6 MB.</small>
              {(file || draft.image) && (
                <img
                  src={file ? URL.createObjectURL(file) : draft.image}
                  alt="Prévia da foto"
                />
              )}
            </label>
          </div>
          <div className="product-create-switches">
            <label>
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    available: event.target.checked,
                  }))
                }
              />
              <span><strong>Disponível</strong>Pode ser adicionado ao pedido.</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    featured: event.target.checked,
                  }))
                }
              />
              <span><strong>Destaque</strong>Aparece entre os itens principais.</span>
            </label>
          </div>
          <section className="product-options-builder">
            <header>
              <div>
                <h3>Tamanhos, sabores e adicionais</h3>
                <p>Crie grupos obrigatórios ou opcionais.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    optionGroups: [
                      ...current.optionGroups,
                      {
                        name: "",
                        required: false,
                        max: 1,
                        options: [{ name: "", price: 0 }],
                      },
                    ],
                  }))
                }
              >
                + Grupo
              </button>
            </header>
            {!draft.optionGroups.length ? (
              <div className="empty-options">Este item não possui adicionais.</div>
            ) : (
              <div className="option-groups-editor">
                {draft.optionGroups.map((group, groupIndex) => (
                  <article key={`${group.id ?? "new"}-${groupIndex}`}>
                    <div className="option-group-heading">
                      <label>
                        <span>Nome do grupo</span>
                        <input
                          value={group.name}
                          onChange={(event) =>
                            updateGroup(groupIndex, { name: event.target.value })
                          }
                          placeholder="Ex.: Tamanho"
                        />
                      </label>
                      <label>
                        <span>Máximo</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={group.max ?? 1}
                          onChange={(event) =>
                            updateGroup(groupIndex, {
                              max: Number(event.target.value) || 1,
                            })
                          }
                        />
                      </label>
                      <label className="required-option">
                        <input
                          type="checkbox"
                          checked={Boolean(group.required)}
                          onChange={(event) =>
                            updateGroup(groupIndex, {
                              required: event.target.checked,
                            })
                          }
                        />
                        Obrigatório
                      </label>
                      <button
                        className="remove-group"
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            optionGroups: current.optionGroups.filter(
                              (_, index) => index !== groupIndex,
                            ),
                          }))
                        }
                      >
                        Remover
                      </button>
                    </div>
                    <div className="option-items-editor">
                      {group.options.map((option, optionIndex) => (
                        <div key={`${option.id ?? "new"}-${optionIndex}`}>
                          <input
                            value={option.name}
                            onChange={(event) =>
                              updateGroup(groupIndex, {
                                options: group.options.map((item, index) =>
                                  index === optionIndex
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              })
                            }
                            placeholder="Nome da opção"
                          />
                          <div className="product-price-field compact">
                            <span>R$</span>
                            <input
                              inputMode="decimal"
                              value={String(option.price).replace(".", ",")}
                              onChange={(event) =>
                                updateGroup(groupIndex, {
                                  options: group.options.map((item, index) =>
                                    index === optionIndex
                                      ? {
                                          ...item,
                                          price:
                                            Number(
                                              event.target.value.replace(",", "."),
                                            ) || 0,
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateGroup(groupIndex, {
                                options: group.options.filter(
                                  (_, index) => index !== optionIndex,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="add-option-line"
                      type="button"
                      onClick={() =>
                        updateGroup(groupIndex, {
                          options: [...group.options, { name: "", price: 0 }],
                        })
                      }
                    >
                      + Adicionar opção
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
          {error && <p className="form-error">{error}</p>}
          <footer className="product-create-footer">
            <span>{formatBRL(Number(draft.price.replace(",", ".")) || 0)}</span>
            <div>
              <button className="secondary-button" type="button" onClick={onClose}>
                Cancelar
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Salvando…" : product ? "Salvar alterações" : "Adicionar item"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ProductManager({
  bundle,
  onBundle,
}: {
  bundle: StoreBundle;
  onBundle(bundle: StoreBundle): void;
}) {
  const [query, setQuery] = useState("");
  const [dialogProduct, setDialogProduct] = useState<MenuProduct | "new" | null>(
    null,
  );
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [workingId, setWorkingId] = useState("");

  const visible = bundle.products.filter((product) =>
    `${product.name} ${product.description}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR").trim()),
  );

  const patchProduct = async (
    product: MenuProduct,
    patch: Partial<MenuProduct>,
  ) => {
    setWorkingId(product.id);
    try {
      onBundle(
        await requestJson<StoreBundle>(
          `/api/manage/products/${encodeURIComponent(product.id)}`,
          { method: "PATCH", body: JSON.stringify(patch) },
        ),
      );
    } finally {
      setWorkingId("");
    }
  };

  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    setCategoryError("");
    try {
      await requestJson(
        `/api/manage/stores/${encodeURIComponent(bundle.store.id)}/categories`,
        { method: "POST", body: JSON.stringify({ name: categoryName }) },
      );
      onBundle(
        await requestJson<StoreBundle>(
          `/api/manage/stores/${encodeURIComponent(bundle.store.id)}`,
        ),
      );
      setCategoryName("");
    } catch (cause) {
      setCategoryError(cause instanceof Error ? cause.message : "Erro inesperado.");
    }
  };

  const remove = async (product: MenuProduct) => {
    if (!window.confirm(`Excluir “${product.name}” do cardápio?`)) return;
    setWorkingId(product.id);
    try {
      onBundle(
        await requestJson<StoreBundle>(
          `/api/manage/products/${encodeURIComponent(product.id)}`,
          { method: "DELETE" },
        ),
      );
    } finally {
      setWorkingId("");
    }
  };

  return (
    <>
      <section className="panel-card product-editor">
        <header>
          <div>
            <h2>Itens do cardápio</h2>
            <small>{bundle.products.length} itens cadastrados</small>
          </div>
          <div className="editor-header-actions">
            <a href={`/${bundle.store.slug}`} target="_blank" rel="noreferrer">Visualizar ↗</a>
            <button
              className="primary-button add-product-trigger"
              type="button"
              onClick={() => setDialogProduct("new")}
            >
              + Adicionar item
            </button>
          </div>
        </header>
        <div className="product-tools">
          <label className="search-box dashboard-search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar item"
            />
          </label>
          <form className="category-quick-add" onSubmit={addCategory}>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Nova categoria"
            />
            <button type="submit">+ Categoria</button>
          </form>
        </div>
        {categoryError && <p className="inline-form-error">{categoryError}</p>}
        <div className="editable-products">
          {visible.map((product) => (
            <article key={product.id} className={workingId === product.id ? "working" : ""}>
              <img src={product.image || bundle.store.coverUrl || "/images/cafe.png"} alt="" />
              <div className="editable-product-copy">
                <strong>{product.name}</strong>
                <small>
                  {bundle.categories.find((category) => category.id === product.categoryId)
                    ?.name || "Sem categoria"}
                  {" · "}
                  {formatBRL(product.price)}
                </small>
              </div>
              <label className="availability-toggle">
                <input
                  type="checkbox"
                  checked={product.available !== false}
                  onChange={(event) =>
                    void patchProduct(product, { available: event.target.checked })
                  }
                />
                <span />
                {product.available === false ? "Indisponível" : "Disponível"}
              </label>
              <div className="product-row-actions">
                <button type="button" onClick={() => setDialogProduct(product)}>
                  Editar
                </button>
                <button className="danger" type="button" onClick={() => void remove(product)}>
                  Excluir
                </button>
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="empty-state compact-empty">
              <h3>Nenhum item encontrado</h3>
              <button type="button" onClick={() => setDialogProduct("new")}>
                Adicionar primeiro item
              </button>
            </div>
          )}
        </div>
      </section>
      {dialogProduct && (
        <ProductDialog
          storeId={bundle.store.id}
          categories={bundle.categories}
          product={dialogProduct === "new" ? undefined : dialogProduct}
          onClose={() => setDialogProduct(null)}
          onSaved={(next) => {
            onBundle(next);
            setDialogProduct(null);
          }}
        />
      )}
    </>
  );
}

function StoreSettings({
  bundle,
  role,
  onBundle,
}: {
  bundle: StoreBundle;
  role: ActorRole;
  onBundle(bundle: StoreBundle): void;
}) {
  const [draft, setDraft] = useState<StoreProfile>(bundle.store);
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const toggleListValue = <T extends string>(
    key: "serviceModes" | "paymentMethods",
    value: T,
    checked: boolean,
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: checked
        ? [...(current[key] as T[]), value]
        : (current[key] as T[]).filter((item) => item !== value),
    }));
  };

  const updateHour = (index: number, patch: Partial<OpeningHour>) => {
    setDraft((current) => ({
      ...current,
      hours: current.hours.map((hour, hourIndex) =>
        hourIndex === index ? { ...hour, ...patch } : hour,
      ),
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      let logoUrl = draft.logoUrl;
      let coverUrl = draft.coverUrl;
      if (logo) logoUrl = (await uploadImage(logo, draft.id)).url;
      if (cover) coverUrl = (await uploadImage(cover, draft.id)).url;
      const next = await requestJson<StoreBundle>(
        `/api/manage/stores/${encodeURIComponent(draft.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ ...draft, logoUrl, coverUrl }),
        },
      );
      onBundle(next);
      setSaved(true);
      setLogo(null);
      setCover(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-stack" onSubmit={submit}>
      {saved && <div className="save-banner">✓ Alterações publicadas no cardápio.</div>}
      <section className="panel-card editor-card">
        <header><h2>Identidade e contato</h2></header>
        <div className="form-grid admin-form-grid">
          <label>
            <span>Nome</span>
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Segmento</span>
            <input
              value={draft.segment}
              onChange={(event) =>
                setDraft((current) => ({ ...current, segment: event.target.value }))
              }
            />
          </label>
          {role === "admin" && (
            <label>
              <span>Endereço do cardápio</span>
              <input
                value={draft.slug}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slug: slugify(event.target.value),
                  }))
                }
              />
            </label>
          )}
          <label>
            <span>WhatsApp</span>
            <input
              value={draft.whatsapp}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  whatsapp: event.target.value,
                }))
              }
            />
          </label>
          <label className="wide">
            <span>Slogan</span>
            <input
              value={draft.slogan}
              onChange={(event) =>
                setDraft((current) => ({ ...current, slogan: event.target.value }))
              }
            />
          </label>
          <label className="wide">
            <span>Descrição</span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label className="wide">
            <span>Endereço físico</span>
            <input
              value={draft.address}
              onChange={(event) =>
                setDraft((current) => ({ ...current, address: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Instagram (link completo)</span>
            <input
              value={draft.instagram}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  instagram: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Google Maps (link)</span>
            <input
              value={draft.mapsUrl}
              onChange={(event) =>
                setDraft((current) => ({ ...current, mapsUrl: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Logo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
            />
            <small className="image-ratio-hint">
              Proporção 1:1 (quadrada) · Recomendado: 1000 × 1000 px.
            </small>
          </label>
          <label>
            <span>Imagem de capa</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setCover(event.target.files?.[0] ?? null)}
            />
            <small className="image-ratio-hint">
              Proporção 16:9 (horizontal) · Recomendado: 1600 × 900 px.
            </small>
          </label>
        </div>
      </section>

      <section className="panel-card editor-card">
        <header><h2>Horários e status</h2></header>
        <div className="force-status-row">
          {(["auto", "open", "closed"] as const).map((value) => (
            <button
              type="button"
              className={draft.forcedOpenState === value ? "active" : ""}
              onClick={() =>
                setDraft((current) => ({ ...current, forcedOpenState: value }))
              }
              key={value}
            >
              {value === "auto" ? "Automático" : value === "open" ? "Forçar aberto" : "Forçar fechado"}
            </button>
          ))}
        </div>
        <div className="hours-editor">
          {(draft.hours.length ? draft.hours : DEFAULT_HOURS).map((hour, index) => (
            <div className={!hour.enabled ? "closed-day" : ""} key={hour.day}>
              <strong>{hour.label}</strong>
              <label className="availability-toggle">
                <input
                  type="checkbox"
                  checked={hour.enabled}
                  onChange={(event) =>
                    updateHour(index, { enabled: event.target.checked })
                  }
                />
                <span />
                {hour.enabled ? "Aberto" : "Fechado"}
              </label>
              <input
                type="time"
                value={hour.opens}
                disabled={!hour.enabled}
                onChange={(event) => updateHour(index, { opens: event.target.value })}
              />
              <b>até</b>
              <input
                type="time"
                value={hour.closes}
                disabled={!hour.enabled}
                onChange={(event) => updateHour(index, { closes: event.target.value })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel-card editor-card">
        <header><h2>Pedidos e pagamento</h2></header>
        <div className="settings-choices">
          <fieldset>
            <legend>Formas de atendimento</legend>
            {(
              [
                ["entrega", "Entrega"],
                ["retirada", "Retirada"],
                ["local", "Consumo no local"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={draft.serviceModes.includes(value)}
                  onChange={(event) =>
                    toggleListValue<ServiceMode>(
                      "serviceModes",
                      value,
                      event.target.checked,
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Formas de pagamento</legend>
            {(["Pix", "Dinheiro", "Cartão"] as PaymentMethod[]).map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={draft.paymentMethods.includes(value)}
                  onChange={(event) =>
                    toggleListValue<PaymentMethod>(
                      "paymentMethods",
                      value,
                      event.target.checked,
                    )
                  }
                />
                {value}
              </label>
            ))}
          </fieldset>
          <label className="standalone-field">
            <span>Taxa de entrega</span>
            <div className="product-price-field">
              <span>R$</span>
              <input
                inputMode="decimal"
                value={String(draft.deliveryFee).replace(".", ",")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    deliveryFee:
                      Number(event.target.value.replace(",", ".")) || 0,
                  }))
                }
              />
            </div>
          </label>
        </div>
      </section>

      {role === "admin" && (
        <section className="panel-card editor-card">
          <header><h2>Acesso do comerciante</h2></header>
          <div className="form-grid admin-form-grid">
            <label>
              <span>Forma de gestão</span>
              <select
                value={draft.managementMode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    managementMode: event.target.value as StoreProfile["managementMode"],
                  }))
                }
              >
                <option value="managed">Gerenciado pela OxeMenu</option>
                <option value="merchant">Gerenciado pelo comerciante</option>
              </select>
            </label>
            <label>
              <span>E-mail autorizado</span>
              <input
                type="email"
                value={draft.ownerEmail}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ownerEmail: event.target.value,
                  }))
                }
                placeholder="cliente@email.com"
              />
            </label>
            <label>
              <span>Status do cardápio</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as StoreProfile["status"],
                  }))
                }
              >
                <option value="active">Ativo</option>
                <option value="demo">Demonstração</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>
          <p className="access-note">
            O comerciante terá uma conta própria e continuará vendo somente este
            estabelecimento.
          </p>
          <AccessManager
            establishmentId={bundle.store.id}
            ownerEmail={draft.ownerEmail}
          />
        </section>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="settings-save-bar">
        <a className="secondary-button" href={`/${bundle.store.slug}`} target="_blank" rel="noreferrer">
          Ver cardápio ↗
        </a>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar e publicar"}
        </button>
      </div>
    </form>
  );
}

function StoreWorkspace({
  initial,
  role,
}: {
  initial: StoreBundle;
  role: ActorRole;
}) {
  const [bundle, setBundle] = useState(initial);
  const [tab, setTab] = useState<"products" | "settings">("products");

  return (
    <>
      <div className="dashboard-heading">
        <div className="editor-title">
          <span className="store-avatar large-avatar">
            {bundle.store.logoUrl ? (
              <img src={bundle.store.logoUrl} alt="" />
            ) : (
              initials(bundle.store.name)
            )}
          </span>
          <div>
            <p className="eyebrow">
              {role === "admin" ? "Gerenciar estabelecimento" : "Meu negócio"}
            </p>
            <h1>{bundle.store.name}</h1>
            <p>/{bundle.store.slug} · {bundle.products.length} itens</p>
          </div>
        </div>
        <div className="heading-actions">
          <span className={`table-status ${bundle.store.status}`}>
            {bundle.store.status === "active"
              ? "Ativo"
              : bundle.store.status === "demo"
                ? "Demonstração"
                : "Inativo"}
          </span>
          <a className="secondary-button" href={`/${bundle.store.slug}`} target="_blank" rel="noreferrer">
            Abrir cardápio ↗
          </a>
        </div>
      </div>
      <nav className="editor-tabs">
        <button
          className={tab === "products" ? "active" : ""}
          type="button"
          onClick={() => setTab("products")}
        >
          Produtos e categorias
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          type="button"
          onClick={() => setTab("settings")}
        >
          Informações, horários e acesso
        </button>
      </nav>
      {tab === "products" ? (
        <ProductManager bundle={bundle} onBundle={setBundle} />
      ) : (
        <StoreSettings bundle={bundle} role={role} onBundle={setBundle} />
      )}
    </>
  );
}

export function MerchantDashboard() {
  const [bundle, setBundle] = useState<StoreBundle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<StoreBundle>("/api/merchant/store")
      .then(setBundle)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Erro inesperado."),
      );
  }, []);

  return (
    <DashboardShell role="merchant" active="menu" storeName={bundle?.store.name}>
      {error ? (
        <ErrorPanel message={error} />
      ) : !bundle ? (
        <LoadingPanel text="Carregando seu estabelecimento…" />
      ) : (
        <StoreWorkspace initial={bundle} role="merchant" />
      )}
    </DashboardShell>
  );
}

export function EstablishmentEditor({ id }: { id: string }) {
  const [bundle, setBundle] = useState<StoreBundle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<StoreBundle>(
      `/api/admin/establishments/${encodeURIComponent(id)}`,
    )
      .then(setBundle)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Erro inesperado."),
      );
  }, [id]);

  return (
    <DashboardShell role="admin" active="stores">
      {error ? (
        <ErrorPanel message={error} />
      ) : !bundle ? (
        <LoadingPanel text="Carregando estabelecimento…" />
      ) : (
        <StoreWorkspace initial={bundle} role="admin" />
      )}
    </DashboardShell>
  );
}
