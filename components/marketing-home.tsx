import { BrandLogo } from "@/components/brand-logo";

const contactNumber = process.env.NEXT_PUBLIC_OXEMENU_WHATSAPP?.replace(/\D/g, "");
const whatsApp = contactNumber
  ? `https://wa.me/${contactNumber}?text=Ol%C3%A1%21%20Quero%20criar%20um%20card%C3%A1pio%20digital%20para%20o%20meu%20estabelecimento.`
  : "/";

export default function MarketingHome() {
  return (
    <main className="marketing-page">
      <header className="site-header">
        <a className="brand-link" href="/" aria-label="OxeMenu, início">
          <BrandLogo priority />
        </a>
        <nav aria-label="Navegação principal">
          <a href="#beneficios">Benefícios</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="/coffe-love">Ver demonstração</a>
        </nav>
        <div className="header-actions">
          <a className="header-login" href="/painel/login">
            LOGIN
          </a>
          <a className="header-cta" href={whatsApp} target="_blank" rel="noreferrer">
            Quero meu cardápio
          </a>
        </div>
      </header>

      <section className="home-hero">
        <div className="hero-orb orb-one" />
        <div className="hero-orb orb-two" />
        <div className="hero-copy">
          <p className="hero-kicker">
            <span>✦</span> Criado em Caruaru para quem vende de verdade
          </p>
          <h1>
            Seu cardápio bonito.
            <br />
            Seu pedido <em>organizado.</em>
          </h1>
          <p className="hero-lead">
            Transforme o link da sua bio em um cardápio profissional. Seu cliente
            escolhe, monta o pedido e envia tudo pronto para o seu WhatsApp.
          </p>
          <div className="hero-buttons">
            <a className="primary-button large" href={whatsApp} target="_blank" rel="noreferrer">
              Criar meu cardápio <span>→</span>
            </a>
            <a className="secondary-button large" href="/coffe-love">
              Ver cardápio funcionando
            </a>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars">
              <span>OM</span>
              <span>CL</span>
              <span>+7</span>
            </div>
            <p>
              <strong>Feito para negócios locais</strong>
              <small>Cafeterias, lanchonetes, docerias e restaurantes</small>
            </p>
          </div>
        </div>

        <div className="hero-visual" aria-label="Exemplo do cardápio digital">
          <div className="floating-card order-card">
            <span>✓</span>
            <p>
              <small>Pedido organizado</small>
              <strong>Pronto para o WhatsApp</strong>
            </p>
          </div>
          <div className="phone-frame">
            <div className="phone-top">
              <span />
            </div>
            <div className="phone-cover">
              <img src="/images/cafe.png" alt="" />
            </div>
            <div className="phone-store">
              <div className="mini-logo">CL</div>
              <div>
                <strong>Coffe Love</strong>
                <small>Do grão à xícara</small>
              </div>
              <span className="mini-status">Aberto</span>
            </div>
            <div className="phone-search">⌕ O que você deseja?</div>
            <div className="phone-chips">
              <span>Destaques</span>
              <span>Cafés</span>
              <span>Almoço</span>
            </div>
            <div className="mini-product">
              <img src="/images/sobremesas.png" alt="" />
              <p>
                <strong>Cheesecake Artesanal</strong>
                <small>Cremoso, com cobertura à escolha</small>
                <b>R$ 16,90</b>
              </p>
              <span>+</span>
            </div>
            <div className="mini-product">
              <img src="/images/almoco.png" alt="" />
              <p>
                <strong>Executivo de Frango</strong>
                <small>Almoço completo e fresquinho</small>
                <b>R$ 24,90</b>
              </p>
              <span>+</span>
            </div>
            <div className="phone-cart">
              <span>2</span>
              <strong>Ver pedido</strong>
              <b>R$ 41,80</b>
            </div>
          </div>
          <div className="floating-card whatsapp-card">
            <span>◉</span>
            <p>
              <small>Finalização simples</small>
              <strong>Direto no WhatsApp</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <p>Menos mensagens confusas. Mais pedidos completos.</p>
        <div>
          <span>✓ Sem aplicativo</span>
          <span>✓ Fácil de atualizar</span>
          <span>✓ Feito para celular</span>
          <span>✓ Pedido pelo WhatsApp</span>
        </div>
      </section>

      <section className="benefits-section" id="beneficios">
        <div className="section-intro">
          <p className="eyebrow">Tudo em um só lugar</p>
          <h2>Uma experiência melhor para você e para seu cliente.</h2>
          <p>
            Seu negócio ganha uma presença profissional sem complicar o jeito
            simples como você já vende.
          </p>
        </div>
        <div className="benefit-grid">
          <article className="benefit-card accent">
            <span className="benefit-number">01</span>
            <div className="benefit-symbol">⌕</div>
            <h3>O cliente encontra rápido</h3>
            <p>
              Busca, categorias e fotos grandes deixam o cardápio fácil de
              navegar, mesmo com muitos produtos.
            </p>
          </article>
          <article className="benefit-card">
            <span className="benefit-number">02</span>
            <div className="benefit-symbol">＋</div>
            <h3>O pedido chega completo</h3>
            <p>
              Tamanho, sabor, adicionais, quantidade e observações chegam
              organizados em uma única mensagem.
            </p>
          </article>
          <article className="benefit-card dark">
            <span className="benefit-number">03</span>
            <div className="benefit-symbol">◉</div>
            <h3>A venda continua no WhatsApp</h3>
            <p>
              Nada muda na sua rotina. Você recebe o resumo, confirma o pedido e
              combina o pagamento.
            </p>
          </article>
        </div>
      </section>

      <section className="steps-section" id="como-funciona">
        <div className="steps-image">
          <img src="/images/almoco.png" alt="Almoço servido por um negócio local" />
          <div>
            <strong>Seu negócio, sua identidade</strong>
            <span>A OxeMenu aparece apenas como assinatura discreta.</span>
          </div>
        </div>
        <div className="steps-copy">
          <p className="eyebrow">Como funciona</p>
          <h2>Do seu Instagram para um cardápio pronto para vender.</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Conhecemos o seu negócio</strong>
                <p>
                  Você envia as informações, identidade, produtos, preços e
                  horários do estabelecimento.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Montamos o seu cardápio</strong>
                <p>
                  Organizamos categorias, adicionais e o visual para ficar com a
                  cara da sua marca.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Você divulga e começa a receber</strong>
                <p>
                  Coloque o link na bio, no status ou em um QR Code. Os pedidos
                  chegam no seu WhatsApp.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="demo-section">
        <div>
          <p className="eyebrow">Veja antes de contratar</p>
          <h2>Conheça a demonstração da Coffe Love.</h2>
          <p>
            Pesquise produtos, escolha adicionais, monte um carrinho e veja como
            o pedido chega organizado no WhatsApp.
          </p>
          <a className="primary-button large" href="/coffe-love">
            Abrir cardápio demonstrativo <span>→</span>
          </a>
        </div>
        <div className="demo-photo">
          <img src="/images/sobremesas.png" alt="Sobremesas da demonstração Coffe Love" />
          <span>Coffe Love · Demonstração</span>
        </div>
      </section>

      <section className="final-cta">
        <span className="final-cta-icon">O</span>
        <p className="eyebrow">Vamos colocar seu cardápio no ar?</p>
        <h2>Seu cliente já está no celular. Seu cardápio também precisa estar.</h2>
        <a className="light-button" href={whatsApp} target="_blank" rel="noreferrer">
          Falar com a OxeMenu <span>→</span>
        </a>
      </section>

      <footer className="site-footer">
        <a className="brand-link" href="/" aria-label="OxeMenu, início">
          <BrandLogo light />
        </a>
        <p>Cardápios digitais para pequenos negócios de Caruaru e região.</p>
        <div>
          <a href="/coffe-love">Demonstração</a>
          <a href="/painel/login">Área do comerciante</a>
        </div>
        <small>© 2026 OxeMenu. Feito em Caruaru, Pernambuco.</small>
      </footer>
    </main>
  );
}
