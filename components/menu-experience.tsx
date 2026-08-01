"use client";

import { useEffect, useMemo, useState } from "react";
import {
  digitsOnly,
  formatBRL,
  initials,
  type MenuProduct,
  type PaymentMethod,
  type ProductOption,
  type ServiceMode,
  type StoreBundle,
} from "@/lib/models";

const providerNumber = process.env.NEXT_PUBLIC_OXEMENU_WHATSAPP?.replace(/\D/g, "");
const providerUrl = providerNumber
  ? `https://wa.me/${providerNumber}?text=Ol%C3%A1%21%20Vi%20um%20card%C3%A1pio%20criado%20pela%20OxeMenu%20e%20gostaria%20de%20saber%20como%20criar%20um%20para%20o%20meu%20estabelecimento.`
  : "/";

type SelectedGroup = {
  group: string;
  options: ProductOption[];
};

type CartItem = {
  cartId: string;
  productId: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  selections: SelectedGroup[];
  note: string;
};

type CheckoutData = {
  service: ServiceMode;
  name: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  table: string;
  payment: PaymentMethod;
  changeFor: string;
  generalNote: string;
};

const initialCheckout: CheckoutData = {
  service: "entrega",
  name: "",
  phone: "",
  street: "",
  number: "",
  neighborhood: "",
  complement: "",
  table: "",
  payment: "Pix",
  changeFor: "",
  generalNote: "",
};

const serviceLabels: Record<ServiceMode, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
  local: "No local",
};

function cartStorageKey(slug: string) {
  return `caruarufood-cart-${slug}-v2`;
}

function currentRecifeDayAndMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Recife",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { day: dayMap[weekday] ?? 0, minutes: hour * 60 + minute };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function isStoreOpen(bundle: StoreBundle) {
  if (bundle.store.forcedOpenState === "open") return true;
  if (bundle.store.forcedOpenState === "closed") return false;
  const now = currentRecifeDayAndMinutes();
  const schedule = bundle.store.hours.find((hour) => hour.day === now.day);
  if (!schedule?.enabled) return false;
  return (
    now.minutes >= timeToMinutes(schedule.opens) &&
    now.minutes < timeToMinutes(schedule.closes)
  );
}

function hoursSummary(bundle: StoreBundle) {
  const active = bundle.store.hours.filter((hour) => hour.enabled);
  if (!active.length) return "Horário não informado";
  const first = active[0];
  const sameTime = active.every(
    (hour) => hour.opens === first.opens && hour.closes === first.closes,
  );
  if (sameTime && active.length === 5 && active[0].day === 1 && active[4].day === 5) {
    return `Seg–sex, ${first.opens} às ${first.closes}`;
  }
  return `${first.label}, ${first.opens} às ${first.closes}`;
}

async function loadBundle(slug: string) {
  const response = await fetch(`/api/public/stores/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  const data = (await response.json()) as StoreBundle & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível abrir o cardápio.");
  return data;
}

export default function MenuExperience({ slug }: { slug: string }) {
  const [bundle, setBundle] = useState<StoreBundle | null>(null);
  const [loadError, setLoadError] = useState("");
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todos");
  const [selected, setSelected] = useState<MenuProduct | null>(null);
  const [selections, setSelections] = useState<Record<string, ProductOption[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [modalError, setModalError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutData>(initialCheckout);
  const [checkoutError, setCheckoutError] = useState("");
  const [addedMessage, setAddedMessage] = useState("");

  useEffect(() => {
    let active = true;
    loadBundle(slug)
      .then((data) => {
        if (!active) return;
        setBundle(data);
        setProducts(data.products);
        setCheckout((current) => ({
          ...current,
          service: data.store.serviceModes[0] ?? "retirada",
          payment: data.store.paymentMethods[0] ?? "Pix",
        }));
        const storedCart = window.localStorage.getItem(cartStorageKey(slug));
        if (storedCart) {
          try {
            setCart(JSON.parse(storedCart) as CartItem[]);
          } catch {
            window.localStorage.removeItem(cartStorageKey(slug));
          }
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível abrir o cardápio.",
        );
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    window.localStorage.setItem(cartStorageKey(slug), JSON.stringify(cart));
  }, [cart, slug]);

  const categoryItems = useMemo(
    () => [
      { id: "todos", label: "Todos" },
      { id: "destaques", label: "Destaques" },
      ...(bundle?.categories ?? [])
        .filter((item) => item.active)
        .map((item) => ({ id: item.slug, label: item.name })),
    ],
    [bundle],
  );

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      const categoryMatch =
        category === "todos" ||
        (category === "destaques" && product.featured) ||
        product.category === category;
      const searchMatch =
        !normalized ||
        `${product.name} ${product.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [products, query, category]);

  if (loadError) {
    return (
      <main className="menu-page menu-state-page">
        <section className="menu-state-card">
          <span>!</span>
          <h1>Cardápio indisponível</h1>
          <p>{loadError}</p>
          <a className="primary-button" href="/">
            Voltar para a OxeMenu
          </a>
        </section>
      </main>
    );
  }

  if (!bundle) {
    return (
      <main className="menu-page menu-state-page" aria-busy="true">
        <section className="menu-state-card">
          <span className="loading-dot">C</span>
          <h1>Preparando o cardápio…</h1>
          <p>Estamos organizando os itens para você.</p>
        </section>
      </main>
    );
  }

  const { store } = bundle;
  const open = isStoreOpen(bundle);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  const deliveryFee =
    checkout.service === "entrega" && cart.length ? store.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const selectedExtra =
    selected?.optionGroups?.reduce(
      (sum, group) =>
        sum +
        (selections[group.name] ?? []).reduce(
          (groupSum, option) => groupSum + option.price,
          0,
        ),
      0,
    ) ?? 0;
  const selectedTotal = ((selected?.price ?? 0) + selectedExtra) * quantity;

  const openProduct = (product: MenuProduct) => {
    if (product.available === false) return;
    setSelected(product);
    setSelections({});
    setQuantity(1);
    setNote("");
    setModalError("");
  };

  const toggleOption = (
    groupName: string,
    option: ProductOption,
    max = 1,
  ) => {
    setModalError("");
    setSelections((current) => {
      const existing = current[groupName] ?? [];
      const chosen = existing.some((item) => item.name === option.name);
      if (chosen) {
        return {
          ...current,
          [groupName]: existing.filter((item) => item.name !== option.name),
        };
      }
      if (max === 1) return { ...current, [groupName]: [option] };
      if (existing.length >= max) return current;
      return { ...current, [groupName]: [...existing, option] };
    });
  };

  const addToCart = () => {
    if (!selected) return;
    const missingGroup = selected.optionGroups?.find(
      (group) => group.required && !(selections[group.name]?.length > 0),
    );
    if (missingGroup) {
      setModalError(`Escolha uma opção em “${missingGroup.name}”.`);
      return;
    }
    const selectedGroups = Object.entries(selections)
      .filter(([, options]) => options.length)
      .map(([group, options]) => ({ group, options }));
    setCart((current) => [
      ...current,
      {
        cartId: `${selected.id}-${Date.now()}`,
        productId: selected.id,
        name: selected.name,
        image: selected.image,
        unitPrice: selected.price + selectedExtra,
        quantity,
        selections: selectedGroups,
        note,
      },
    ]);
    setSelected(null);
    setAddedMessage(`${selected.name} foi adicionado ao pedido.`);
    window.setTimeout(() => setAddedMessage(""), 2400);
  };

  const updateCartQuantity = (cartId: string, next: number) => {
    if (next < 1) {
      setCart((current) => current.filter((item) => item.cartId !== cartId));
      return;
    }
    setCart((current) =>
      current.map((item) =>
        item.cartId === cartId ? { ...item, quantity: next } : item,
      ),
    );
  };

  const finishOrder = () => {
    if (!cart.length) {
      setCheckoutError("Adicione pelo menos um item ao pedido.");
      return;
    }
    if (!checkout.name.trim() || !checkout.phone.trim()) {
      setCheckoutError("Preencha seu nome e telefone.");
      return;
    }
    if (
      checkout.service === "entrega" &&
      (!checkout.street.trim() ||
        !checkout.number.trim() ||
        !checkout.neighborhood.trim())
    ) {
      setCheckoutError("Preencha rua, número e bairro para a entrega.");
      return;
    }
    if (!digitsOnly(store.whatsapp)) {
      setCheckoutError("O WhatsApp do estabelecimento ainda não foi cadastrado.");
      return;
    }

    const itemLines = cart
      .map((item) => {
        const options = item.selections
          .map(
            (group) =>
              `${group.group}: ${group.options.map((option) => option.name).join(", ")}`,
          )
          .join("\n");
        return [
          `*${item.quantity}x ${item.name}*`,
          options || null,
          item.note ? `Observação: ${item.note}` : null,
          `Subtotal: ${formatBRL(item.unitPrice * item.quantity)}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    const serviceDetails =
      checkout.service === "entrega"
        ? `*Endereço:* ${checkout.street}, ${checkout.number} — ${checkout.neighborhood}${checkout.complement ? `, ${checkout.complement}` : ""}`
        : checkout.service === "local" && checkout.table
          ? `*Mesa:* ${checkout.table}`
          : "";
    const message = [
      `🍽️ *NOVO PEDIDO — ${store.name.toLocaleUpperCase("pt-BR")}*`,
      "",
      `*Cliente:* ${checkout.name}`,
      `*Telefone:* ${checkout.phone}`,
      `*Atendimento:* ${serviceLabels[checkout.service]}`,
      serviceDetails,
      "",
      "*ITENS DO PEDIDO*",
      itemLines,
      "",
      `*Subtotal:* ${formatBRL(subtotal)}`,
      deliveryFee ? `*Taxa de entrega:* ${formatBRL(deliveryFee)}` : null,
      `*Total:* ${formatBRL(total)}`,
      "",
      `*Pagamento:* ${checkout.payment}`,
      checkout.payment === "Dinheiro" && checkout.changeFor
        ? `*Troco para:* ${checkout.changeFor}`
        : null,
      checkout.generalNote
        ? `*Observações gerais:* ${checkout.generalNote}`
        : null,
      "",
      "_Pedido montado pelo cardápio digital OxeMenu._",
    ]
      .filter((line) => line !== null)
      .join("\n");
    window.open(
      `https://wa.me/${digitsOnly(store.whatsapp)}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setCheckoutError("");
  };

  const shareMenu = async () => {
    if (navigator.share) {
      await navigator.share({ title: store.name, url: window.location.href });
      return;
    }
    await navigator.clipboard?.writeText(window.location.href);
    setAddedMessage("Link do cardápio copiado.");
    window.setTimeout(() => setAddedMessage(""), 2400);
  };

  return (
    <main className="menu-page">
      <a
        className="provider-strip"
        href={providerUrl}
        target="_blank"
        rel="noreferrer"
      >
        Feito com <strong>OxeMenu</strong> <span>Conheça →</span>
      </a>

      <section className="menu-hero">
        <img src={store.coverUrl || "/images/cafe.png"} alt={`Capa de ${store.name}`} />
        <div className="menu-hero-shade" />
        <a className="menu-back" href="/" aria-label="Voltar para a OxeMenu">
          ←
        </a>
        <button
          className="menu-share"
          type="button"
          aria-label="Compartilhar cardápio"
          onClick={() => void shareMenu()}
        >
          ↗
        </button>
      </section>

      <section className="store-card">
        <div className="store-logo" aria-label={`Logo de ${store.name}`}>
          {store.logoUrl ? (
            <img src={store.logoUrl} alt="" />
          ) : (
            <strong>{initials(store.name)}</strong>
          )}
        </div>
        <div className="store-title-row">
          <div>
            <p className="eyebrow">{store.segment}</p>
            <h1>{store.name}</h1>
            {store.slogan && <p className="store-slogan">{store.slogan}</p>}
          </div>
          <span className={`status-pill ${open ? "open" : "closed"}`}>
            <i />
            {open ? "Aberto agora" : "Fechado agora"}
          </span>
        </div>
        <p className="store-meta">
          {hoursSummary(bundle)}
          {store.address ? ` · ${store.address}` : ""}
        </p>
        <div className="store-actions">
          {store.mapsUrl && (
            <a href={store.mapsUrl} target="_blank" rel="noreferrer">
              <span>⌖</span> Como chegar
            </a>
          )}
          {store.instagram && (
            <a href={store.instagram} target="_blank" rel="noreferrer">
              <span>◎</span> Instagram
            </a>
          )}
        </div>
      </section>

      <section className="menu-content">
        {store.status === "demo" && (
          <div className="demo-notice">
            <span>✦</span>
            <p>
              <strong>Cardápio demonstrativo.</strong> Produtos e valores são
              ilustrativos e devem ser confirmados com o estabelecimento.
            </p>
          </div>
        )}

        <div className="menu-controls">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="O que você deseja hoje?"
              aria-label="Pesquisar produtos"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}>
                ×
              </button>
            )}
          </label>
          <div className="category-scroll" aria-label="Categorias">
            {categoryItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={category === item.id ? "active" : ""}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section-heading">
          <div>
            <p className="eyebrow">Escolha com calma</p>
            <h2>
              {category === "todos"
                ? "Nosso cardápio"
                : categoryItems.find((item) => item.id === category)?.label}
            </h2>
          </div>
          <span>{visibleProducts.length} opções</span>
        </div>

        {visibleProducts.length ? (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article
                className={`product-card ${product.available === false ? "unavailable" : ""}`}
                key={product.id}
                onClick={() => openProduct(product)}
              >
                <div className="product-image">
                  <img src={product.image || store.coverUrl || "/images/cafe.png"} alt="" />
                  {product.badge && <span>{product.badge}</span>}
                  {product.available === false && (
                    <span className="sold-out">Esgotado</span>
                  )}
                </div>
                <div className="product-copy">
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                  </div>
                  <div className="product-footer">
                    <strong>{formatBRL(product.price)}</strong>
                    <button
                      type="button"
                      aria-label={`Adicionar ${product.name}`}
                      disabled={product.available === false}
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>⌕</span>
            <h3>Nenhum item encontrado</h3>
            <p>Tente outro nome ou escolha uma categoria diferente.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("todos");
              }}
            >
              Ver todo o cardápio
            </button>
          </div>
        )}
      </section>

      <footer className="menu-footer">
        <div className="store-logo small">
          {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <strong>{initials(store.name)}</strong>}
        </div>
        <p>{store.name}</p>
        <p>{hoursSummary(bundle)}</p>
        <a href="/">Criado com OxeMenu</a>
      </footer>

      {cart.length > 0 && (
        <button
          className="cart-bar"
          type="button"
          onClick={() => {
            setCheckoutOpen(false);
            setCartOpen(true);
          }}
        >
          <span className="cart-count">{cartCount}</span>
          <span>
            <small>Seu pedido</small>
            <strong>Ver carrinho</strong>
          </span>
          <strong>{formatBRL(subtotal)}</strong>
        </button>
      )}

      {addedMessage && <div className="toast">{addedMessage}</div>}

      {selected && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button
            className="modal-backdrop"
            onClick={() => setSelected(null)}
            aria-label="Fechar"
          />
          <section className="product-modal">
            <button
              className="modal-close"
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <div className="modal-image">
              <img src={selected.image || store.coverUrl} alt={selected.name} />
            </div>
            <div className="modal-body">
              <p className="eyebrow">{selected.badge || "Feito com carinho"}</p>
              <h2>{selected.name}</h2>
              <p className="modal-description">{selected.description}</p>
              {selected.optionGroups?.map((group) => (
                <fieldset className="option-group" key={group.id || group.name}>
                  <legend>
                    <span>
                      {group.name}
                      {group.required && <em>Obrigatório</em>}
                    </span>
                    <small>
                      {group.max === 1 ? "Escolha 1" : `Escolha até ${group.max}`}
                    </small>
                  </legend>
                  {group.options
                    .filter((option) => option.available !== false)
                    .map((option) => {
                      const checked = (selections[group.name] ?? []).some(
                        (item) => item.name === option.name,
                      );
                      return (
                        <label className="option-row" key={option.id || option.name}>
                          <span>
                            <input
                              type={group.max === 1 ? "radio" : "checkbox"}
                              checked={checked}
                              onChange={() =>
                                toggleOption(group.name, option, group.max)
                              }
                            />
                            {option.name}
                          </span>
                          <small>
                            {option.price
                              ? `+ ${formatBRL(option.price)}`
                              : "Incluso"}
                          </small>
                        </label>
                      );
                    })}
                </fieldset>
              ))}
              <label className="note-field">
                <span>Alguma observação?</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ex.: sem açúcar, pouco gelo..."
                  maxLength={180}
                />
              </label>
              {modalError && <p className="form-error">{modalError}</p>}
              <div className="modal-add-row">
                <div className="quantity-control">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    −
                  </button>
                  <strong>{quantity}</strong>
                  <button type="button" onClick={() => setQuantity((value) => value + 1)}>
                    +
                  </button>
                </div>
                <button className="primary-button" type="button" onClick={addToCart}>
                  Adicionar · {formatBRL(selectedTotal)}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <button
            className="modal-backdrop"
            onClick={() => setCartOpen(false)}
            aria-label="Fechar carrinho"
          />
          <aside className="cart-drawer">
            <header>
              <div>
                <p className="eyebrow">
                  {checkoutOpen ? "Última etapa" : `${cartCount} itens`}
                </p>
                <h2>{checkoutOpen ? "Finalizar pedido" : "Seu carrinho"}</h2>
              </div>
              <button type="button" onClick={() => setCartOpen(false)}>
                ×
              </button>
            </header>

            {!checkoutOpen ? (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <article className="cart-item" key={item.cartId}>
                      <img src={item.image || store.coverUrl} alt="" />
                      <div>
                        <h3>{item.name}</h3>
                        {item.selections.map((group) => (
                          <p key={group.group}>
                            {group.group}:{" "}
                            {group.options.map((option) => option.name).join(", ")}
                          </p>
                        ))}
                        {item.note && <p>Obs.: {item.note}</p>}
                        <strong>{formatBRL(item.unitPrice * item.quantity)}</strong>
                      </div>
                      <div className="quantity-control compact">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.cartId, item.quantity - 1)
                          }
                        >
                          {item.quantity === 1 ? "×" : "−"}
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.cartId, item.quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="drawer-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatBRL(subtotal)}</strong>
                  </div>
                  <p>A taxa de entrega aparece na próxima etapa.</p>
                  <button
                    className="primary-button full"
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                  >
                    Continuar
                  </button>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm("Deseja esvaziar o carrinho?")) setCart([]);
                    }}
                  >
                    Esvaziar carrinho
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="checkout-form">
                  <div className="service-tabs">
                    {store.serviceModes.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={checkout.service === value ? "active" : ""}
                        onClick={() =>
                          setCheckout((current) => ({ ...current, service: value }))
                        }
                      >
                        {serviceLabels[value]}
                      </button>
                    ))}
                  </div>
                  <div className="form-grid">
                    <label>
                      <span>Seu nome *</span>
                      <input
                        value={checkout.name}
                        onChange={(event) =>
                          setCheckout((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Como podemos chamar você?"
                      />
                    </label>
                    <label>
                      <span>Telefone *</span>
                      <input
                        inputMode="tel"
                        value={checkout.phone}
                        onChange={(event) =>
                          setCheckout((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="(81) 99999-9999"
                      />
                    </label>
                    {checkout.service === "entrega" && (
                      <>
                        <label className="wide">
                          <span>Rua *</span>
                          <input
                            value={checkout.street}
                            onChange={(event) =>
                              setCheckout((current) => ({
                                ...current,
                                street: event.target.value,
                              }))
                            }
                            placeholder="Nome da rua"
                          />
                        </label>
                        <label>
                          <span>Número *</span>
                          <input
                            value={checkout.number}
                            onChange={(event) =>
                              setCheckout((current) => ({
                                ...current,
                                number: event.target.value,
                              }))
                            }
                            placeholder="123"
                          />
                        </label>
                        <label>
                          <span>Bairro *</span>
                          <input
                            value={checkout.neighborhood}
                            onChange={(event) =>
                              setCheckout((current) => ({
                                ...current,
                                neighborhood: event.target.value,
                              }))
                            }
                            placeholder="Seu bairro"
                          />
                        </label>
                        <label className="wide">
                          <span>Complemento</span>
                          <input
                            value={checkout.complement}
                            onChange={(event) =>
                              setCheckout((current) => ({
                                ...current,
                                complement: event.target.value,
                              }))
                            }
                            placeholder="Apto., bloco ou referência"
                          />
                        </label>
                      </>
                    )}
                    {checkout.service === "local" && (
                      <label className="wide">
                        <span>Número da mesa</span>
                        <input
                          value={checkout.table}
                          onChange={(event) =>
                            setCheckout((current) => ({
                              ...current,
                              table: event.target.value,
                            }))
                          }
                          placeholder="Ex.: 08"
                        />
                      </label>
                    )}
                    <label className="wide">
                      <span>Pagamento</span>
                      <select
                        value={checkout.payment}
                        onChange={(event) =>
                          setCheckout((current) => ({
                            ...current,
                            payment: event.target.value as PaymentMethod,
                          }))
                        }
                      >
                        {store.paymentMethods.map((method) => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    {checkout.payment === "Dinheiro" && (
                      <label className="wide">
                        <span>Troco para quanto?</span>
                        <input
                          value={checkout.changeFor}
                          onChange={(event) =>
                            setCheckout((current) => ({
                              ...current,
                              changeFor: event.target.value,
                            }))
                          }
                          placeholder="Ex.: R$ 50,00"
                        />
                      </label>
                    )}
                    <label className="wide">
                      <span>Observações gerais</span>
                      <textarea
                        value={checkout.generalNote}
                        onChange={(event) =>
                          setCheckout((current) => ({
                            ...current,
                            generalNote: event.target.value,
                          }))
                        }
                        placeholder="Algo importante sobre o pedido?"
                      />
                    </label>
                  </div>
                  {checkoutError && <p className="form-error">{checkoutError}</p>}
                </div>
                <div className="drawer-summary checkout-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatBRL(subtotal)}</strong>
                  </div>
                  {checkout.service === "entrega" && (
                    <div>
                      <span>Taxa de entrega</span>
                      <strong>{formatBRL(deliveryFee)}</strong>
                    </div>
                  )}
                  <div className="grand-total">
                    <span>Total</span>
                    <strong>{formatBRL(total)}</strong>
                  </div>
                  <button
                    className="whatsapp-button"
                    type="button"
                    onClick={finishOrder}
                  >
                    <span>◉</span> Enviar pedido no WhatsApp
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setCheckoutOpen(false)}
                  >
                    Voltar ao carrinho
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
