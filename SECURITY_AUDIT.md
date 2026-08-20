# Auditoria de segurança — OxeMenu

**Data:** 20 de agosto de 2026

**Escopo:** código e configurações do projeto aberto, banco Supabase/Postgres associado, configuração legível da hospedagem Netlify e repositório GitHub associado

**Base auditada:** commit inicial `959fa47`; correções publicadas no commit `62d1934`

**Referenciais:** [OWASP Top 10:2025](https://owasp.org/Top10/2025/), [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/), OWASP Cheat Sheet Series e documentação oficial das tecnologias detectadas

## 1. Resumo executivo

Antes da correção, o projeto possuía duas falhas de severidade alta confirmadas: o cadastro de comerciante podia ser concluído sem consumir um convite secreto válido e campos de URL gravados por usuários privilegiados aceitavam esquemas ativos, criando risco de XSS armazenado/phishing. Também foram confirmadas deficiências de proteção contra força bruta, CSRF, uploads forjados, respostas de erro, privilégios de banco, custo de hash de senha, limites de entrada e hardening do navegador.

As falhas críticas e altas identificadas foram corrigidas. Foram adicionados controles no servidor, migração versionada, testes negativos, headers de segurança e um proxy de Storage de privilégio restrito. A migração foi aplicada com sucesso no banco associado, sem alteração nas contagens de dados de negócio. O código corrigido passou em 10/10 testes de segurança, ESLint, TypeScript e build de produção do Next.js.

**Estado atual:** não há vulnerabilidade crítica ou alta conhecida aberta dentro do código examinado. A versão corrigida está publicada em produção no deploy Netlify `6a8792d46747f800084619fd`, ligado ao commit `62d1934`, com estado `ready`. A função privada de Storage está ativa no Supabase e a Netlify recebeu somente a credencial restrita do proxy, não uma chave administrativa do projeto.

### Pontuação fundamentada

| Área | Peso | Antes | Depois | Fundamentação resumida |
|---|---:|---:|---:|---|
| Autenticação e autorização | 20 | 9 | 17 | Convite passou a ser obrigatório e consumido; papéis e propriedade continuam verificados no servidor; falta MFA opcional e teste E2E com contas descartáveis. |
| Banco, isolamento e storage | 15 | 8 | 14 | RLS ativo, roles públicas sem DML e Storage intermediado por proxy restrito; papel interno do banco ainda é amplo por causa da autenticação própria. |
| Entradas, APIs e uploads | 15 | 6 | 15 | Schemas/limites, origem, Content-Type, URLs e magic bytes são validados no servidor e novamente no proxy de imagens. |
| Senhas e recuperação | 10 | 5 | 9 | PBKDF2-SHA256 600 mil, upgrade progressivo e código de recuperação criptográfico, hash-only e uso único. |
| Segredos e privacidade | 10 | 7 | 9 | Nenhum segredo confirmado no código/bundle/histórico; proxy evita colocar chave administrativa do Supabase na Netlify. |
| Navegador e headers | 10 | 3 | 8 | CSP, HSTS, anti-clickjacking, nosniff, COOP e no-store; CSP ainda usa `unsafe-inline` por compatibilidade atual. |
| Supply chain e build | 10 | 5 | 9 | Lock íntegro e versões corrigidas dos pacotes principais; auditoria automática do registry não pôde ser executada na sandbox. |
| Testes e operação | 10 | 3 | 10 | Testes negativos, lint, tipos, build e verificações HTTP/DB concluídos. |
| **Total** | **100** | **46** | **91** | A nota restante representa riscos arquiteturais e melhorias opcionais explicitadas nas seções 9 e 10. |

Esta pontuação é uma avaliação técnica do escopo observado, não uma certificação formal ASVS nem garantia de ausência de vulnerabilidades desconhecidas.

## 2. Mapa da arquitetura e superfícies

### Stack detectada

- Frontend/backend: Next.js 16.2.6 App Router, React/React DOM 19.2.6, TypeScript 5.9.3 e Node.js 24.x.
- Persistência: Postgres do Supabase, Drizzle ORM 0.45.2 e driver `postgres` 3.4.7.
- Hospedagem: Netlify com runtime Next.js; site público atualmente em `https://oxemenu.netlify.app`.
- Autenticação: implementação própria no servidor, com usuários, sessões por cookie, papéis `admin`/`merchant`, convite de comerciante e código de recuperação de acesso.
- Arquivos: bucket privado `oxemenu-media`, limitado a 6 MiB e JPEG/PNG/WebP/GIF; acesso intermediado pela aplicação e pela Edge Function `oxemenu-storage`, autenticada por uma credencial aleatória exclusiva cujo valor não está no repositório.
- Repositório: GitHub público associado ao projeto.

### Páginas

| Classe | Rotas principais | Proteção esperada |
|---|---|---|
| Públicas | `/`, `/[slug]`, `/coffe-love` | Conteúdo de marketing/cardápio explicitamente público. |
| Autenticação | `/admin/login`, `/admin/cadastro`, `/painel/login`, `/painel/cadastro`, `/recuperar-senha` | Mutações protegidas por origem, limites e rate limit. Cadastro de comerciante exige convite. |
| Comerciante | `/painel`, `/conta` | Sessão válida e isolamento por e-mail proprietário do estabelecimento. |
| Administrativas | `/admin`, `/admin/estabelecimentos`, `/admin/estabelecimentos/[id]`, `/admin/estabelecimentos/novo` | Sessão e papel `admin` verificados no servidor. A ausência de link público não é usada como controle de autorização. |

### APIs

- Públicas de leitura: `/api/public/stores/[slug]` e mídia pública do cardápio em `/api/media/[id]`.
- Sessão/autenticação: `/api/session` e `/api/auth/{login,logout,register-admin,register-merchant,recover-password,change-password}`.
- Administrativas: `/api/admin/dashboard`, `/api/admin/establishments`, `/api/admin/establishments/[id]` e `/api/admin/invitations`.
- Comerciante: `/api/merchant/store`, `/api/manage/stores/[id]`, categorias/produtos e `/api/manage/products/[id]`.
- Upload: `/api/uploads`, autenticado e mediado pelo servidor.

### Modelo de dados da aplicação

`users`, `auth_sessions`, `auth_invitations`, `auth_rate_limits`, `establishments`, `categories`, `products`, `option_groups`, `product_options` e `media`.

Todas essas tabelas estão com RLS ativo. `anon` e `authenticated` não mantêm privilégios DML sobre elas; o papel interno `oxemenu_netlify` é usado apenas pelo backend. Não foram encontradas views ou funções `SECURITY DEFINER` pertencentes à aplicação. Quatro tabelas `agent001_*` também existem no mesmo projeto, têm RLS e política por token de header, mas não possuem código correspondente neste repositório e não foram alteradas para evitar quebra de um componente externo não identificado.

### Fluxo de identidade e recuperação

1. O primeiro administrador usa a chave inicial do ambiente uma única vez; índice parcial garante apenas um administrador ativo.
2. O administrador cadastra um estabelecimento e gera um link de convite aleatório, com token armazenado somente por hash.
3. O comerciante precisa apresentar exatamente esse convite, compatível com o e-mail e estabelecimento, dentro da validade e ainda não consumido.
4. Login cria sessão no servidor e cookie protegido; endpoints sensíveis validam sessão, papel e propriedade.
5. Na recuperação, o usuário informa o código recebido ao criar sua conta. O banco guarda somente o hash; o uso troca a senha, rotaciona o código e invalida sessões anteriores.

## 3. Achados e correções

| ID | Severidade | Vulnerabilidade | Local afetado | Impacto | Evidência segura | Correção aplicada | Teste executado | Status |
|---|---|---|---|---|---|---|---|---|
| SEC-001 | Alta | Cadastro de comerciante sem consumo obrigatório de convite | `lib/auth/server.ts`, `/api/auth/register-merchant`, `/painel/cadastro` | Uma pessoa que conhecesse o e-mail proprietário poderia tentar assumir o acesso da loja. | O fluxo anterior localizava a loja pelo e-mail, sem validar token secreto de convite. | Token CSPRNG de 32 caracteres, hash-only, expiração, vínculo loja/e-mail, uso único e invalidação dos convites anteriores. | Formato do token, fluxo do servidor, lint/tipos/build e UI sem convite. | **Corrigido** |
| SEC-002 | Alta | URLs armazenadas aceitavam protocolos ativos/inseguros | `lib/server-data.ts`, campos de site/redes/logo/imagem | XSS armazenado, phishing ou navegação para conteúdo ativo quando o valor fosse renderizado. | Não havia allowlist de protocolo comum aos campos persistidos. | Sanitização central: apenas HTTPS e caminhos relativos estritamente controlados; bloqueio de credenciais, controles e esquemas ativos. | Casos negativos para `javascript:`, `data:`, HTTP e URL com credenciais. | **Corrigido** |
| SEC-003 | Média | Proteção de força bruta incompleta e suscetível a bloqueio por conta | `lib/auth/server.ts`, login/cadastro/recuperação | Automação abusiva; o contador por usuário também podia ser explorado para indisponibilizar uma conta conhecida. | O login dependia principalmente de falhas associadas à conta e outros fluxos não tinham proteção persistente equivalente. | Rate limit persistente por ação, IP e sujeito, chaves com hash e janelas/expiração; novas falhas não prolongam o bloqueio legado por conta. | Verificação de schema/migração, lint/tipos/build e inspeção dos fluxos. | **Corrigido** |
| SEC-004 | Média | Mutações sem validação uniforme de origem/CSRF | Rotas `/api/auth`, `/api/admin`, `/api/manage`, upload e logout | Um navegador autenticado poderia ser induzido a enviar uma mutação de outro site. | Algumas rotas aceitavam requisições sem `Origin` ou não verificavam origem. | Validação deny-by-default de `Origin` ou Fetch Metadata `same-origin` em toda mutação; Content-Type JSON exigido. | Origem válida 200/fluxo normal; origem cruzada e origem ausente 403; teste unitário negativo. | **Corrigido** |
| SEC-005 | Média | PBKDF2-SHA256 com 100 mil iterações | `lib/auth/crypto.ts`, `users` | Custo menor contra quebra offline caso hashes fossem obtidos. | O custo fixo era 100.000, abaixo da recomendação atual usada como baseline. | Novas senhas em 600.000 iterações, versão por usuário e rehash transparente no login de hashes legados. | Verificação positiva/negativa de senha e constante 600.000. | **Corrigido** |
| SEC-006 | Média | Grants amplos para roles públicas, ainda que bloqueados por RLS | Banco Supabase/Postgres | Camada desnecessária de permissão aumentava impacto de futura política RLS incorreta. | `anon`/`authenticated` possuíam grants DML em tabelas da aplicação. | Revogação completa de DML público; RLS mantido; acesso apenas para backend interno. | Consultas de privilégios/RLS e advisor de segurança sem alertas; contagens de negócio inalteradas. | **Corrigido** |
| SEC-007 | Média | Upload confiava excessivamente no MIME informado | `/api/uploads`, storage | Arquivo ativo/disfarçado, abuso de tamanho ou nomes de caminho malformados. | Tipo declarado pelo cliente não era comparado à assinatura real. | Limite/rate limit, magic bytes, allowlist, nome normalizado e proxy restrito que repete tipo, extensão, assinatura, caminho e tamanho antes do bucket. | PNG válido aceito; SVG disfarçado rejeitado; path normalizado; adaptador testado sem chave administrativa. | **Corrigido** |
| SEC-008 | Média | Erro interno retornava `Error.message` | `lib/request-auth.ts` e consumidores | Vazamento de detalhes internos, caminhos, SQL ou dados de integração. | Exceções inesperadas eram serializadas na resposta. | Mensagem genérica ao cliente, detalhe somente no log do servidor e respostas sensíveis `no-store`. | Revisão de código, tipos e build. | **Corrigido** |
| SEC-009 | Baixa | Ausência de política completa de headers e cache privado | `next.config.ts` | Menor proteção contra clickjacking, MIME sniffing, vazamento por referrer/cache e exploração de XSS. | Produção não enviava o conjunto completo configurado agora. | CSP, `frame-ancestors 'none'`, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS e `private, no-store` em áreas sensíveis. | Servidor local: headers presentes e páginas autenticadas sem cache compartilhado. | **Corrigido com ressalva CSP** |
| SEC-010 | Baixa | Mensagem de login revelava incompatibilidade de papel | Fluxo de login admin/comerciante | Enumeração parcial do tipo de conta. | Mensagens diferentes permitiam inferir papel associado ao e-mail. | Resposta de credenciais inválidas uniformizada. | Inspeção de fluxo, lint/tipos/build. | **Corrigido** |
| SEC-011 | Baixa | Condição de corrida na criação do primeiro administrador | `users`, `lib/auth/server.ts` | Duas requisições simultâneas poderiam disputar a criação inicial. | A unicidade era verificada apenas pela aplicação. | Índice único parcial para um único administrador ativo e tratamento de conflito. | Migração aplicada e índice verificado. | **Corrigido** |
| SEC-012 | Média | Limites e validações inconsistentes em corpos e regras de negócio | APIs e `lib/server-data.ts` | Overposting, consumo excessivo e dados malformados ou fora da faixa. | Rotas faziam `request.json()` sem limite uniforme; listas/preços tinham limites frouxos. | JSON máximo de 64 KiB, rejeição de Content-Type incorreto, campos extras não usados, limites de strings/listas/opções/preço e sanitização central. | 415 para tipo incorreto, 413 para corpo acima do limite e testes unitários. | **Corrigido** |

As escolhas de senha seguem a [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); a proteção de origem segue a [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html); o banco foi endurecido de acordo com a [documentação de RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security); e a CSP considera as restrições documentadas no [guia CSP do Next.js](https://nextjs.org/docs/app/guides/content-security-policy).

## 4. Matriz de acesso verificada

| Ator | Conteúdo público | Página/API admin | Loja própria | Loja de terceiro | Criar conta de comerciante | Operação interna de banco |
|---|---|---|---|---|---|---|
| Visitante | Permitido | Redirecionamento na página; API 401 | Negado | Negado | Somente com convite válido | Negado: roles públicas sem DML |
| Usuário/comerciante A | Permitido | Negado pelo papel | Permitido | Negado pela verificação de propriedade | Somente convite vinculado | Sem acesso direto |
| Usuário/comerciante B | Permitido | Negado pelo papel | Permitido na própria loja | Negado à loja A | Somente convite vinculado | Sem acesso direto |
| Administrador | Permitido | Permitido | Permitido | Permitido | Gera convite para loja/e-mail definidos no servidor | Via aplicação |
| Serviço interno `oxemenu_netlify` | N/A | N/A | Conforme decisão da API | Conforme decisão da API | N/A | DML permitido; não exposto ao cliente |

**Evidência dinâmica e negativa:** sem sessão, `/api/admin/dashboard` respondeu 401; `/admin` respondeu 307 para login; mutação de origem cruzada e mutação sem sinais de origem responderam 403; JSON com tipo incorreto respondeu 415; corpo grande respondeu 413. O teste automatizado confirmou administrador permitido, proprietário permitido, terceiro negado e comerciante negado para papel administrativo.

Não foram criadas contas descartáveis no banco de produção nem alteradas contas reais. A travessia E2E completa usuário A/usuário B não foi executada com credenciais reais; o resultado acima combina teste dinâmico seguro sem sessão, teste automatizado de autorização e verificação direta de grants/RLS, sem inventar um login que não foi executado.

## 5. Banco e storage

A migration `20260820230000_security_hardening.sql` foi aplicada e está registrada. Depois da aplicação:

- as 10 tabelas da aplicação permaneceram com RLS ativo;
- `anon` e `authenticated` ficaram sem `SELECT`, `INSERT`, `UPDATE` ou `DELETE` direto;
- o papel interno recebeu somente o acesso necessário à tabela nova de rate limit, além dos acessos existentes de backend;
- `password_iterations` foi incluído com default legado 100.000, permitindo upgrade sem quebrar usuários existentes;
- o índice parcial de administrador e a tabela `auth_rate_limits` foram criados;
- o advisor de segurança do Supabase não apresentou alerta;
- as contagens de dados verificadas permaneceram: 1 usuário, 0 sessões, 0 convites, 1 estabelecimento e 0 mídias.

O bucket `oxemenu-media` está privado, limitado a 6 MiB e a JPEG/PNG/WebP/GIF. Não há política pública de `storage.objects`. A Edge Function `oxemenu-storage` está ativa e usa a chave administrativa apenas dentro do runtime do Supabase; a Netlify chama o proxy com uma credencial aleatória separada, armazenada como secret apenas em `functions`/`runtime`. O endpoint de mídia pública continua necessário para imagens de cardápios explicitamente públicos.

## 6. Supply chain, segredos e hospedagem

- O lockfile v3 contém integridade para os pacotes resolvidos, usa somente o registry oficial do npm e não apresentou divergência entre dependências diretas e instaladas.
- Scripts de instalação encontrados pertencem somente a dependências nativas esperadas (`sharp` e `unrs-resolver`).
- As versões principais estão fora das faixas vulneráveis conhecidas examinadas: [Next.js 16.2.6 corrige GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6), [React 19.2.6 corrige GHSA-rv78-f8rc-xrxh](https://github.com/advisories/GHSA-rv78-f8rc-xrxh) e [Drizzle ORM 0.45.2 corrige GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9).
- A auditoria automática do registry npm não pôde alcançar o serviço a partir da sandbox; por isso ela não é declarada como executada. Foi feita a revisão do lock e de advisories oficiais relevantes.
- Varreduras por padrões de segredo no código atual, histórico Git disponível, bundle estático e deploy de produção não confirmaram chave real, senha administrativa ou token administrativo exposto. A varredura da Netlify examinou 80 arquivos e retornou zero ocorrências.
- Variáveis privadas da Netlify estão marcadas como secret e restritas à produção; nenhuma privada usa prefixo público do Next.js. Os valores não foram incluídos neste relatório.
- `DATABASE_URL` e a chave inicial de administrador também possuem escopo de build, desnecessário para a arquitetura atual. Pela natureza write-only dos valores na Netlify, o ajuste seguro deve ser feito pelo proprietário com os valores originais, seguindo o [Secrets Controller da Netlify](https://docs.netlify.com/build/environment-variables/secrets-controller/).

## 7. Arquivos alterados pela auditoria

### Novos

- `lib/security.ts` — controles de origem, corpo, URL, convite e upload.
- `lib/access-control.ts` — regras puras e testáveis de papel/propriedade.
- `tests/security/security.test.ts` — 10 testes negativos/positivos de segurança.
- `supabase/functions/oxemenu-storage/index.ts` — proxy privado com credencial própria e validação redundante de imagens.
- `supabase/migrations/20260820230000_security_hardening.sql` — hash versionado, rate limit, unicidade administrativa e redução de grants.
- `SECURITY_AUDIT.md` — este relatório.

### Modificados

- `lib/auth/crypto.ts`, `lib/auth/server.ts`, `lib/request-auth.ts` — senha, recuperação, convite, sessão, rate limit e erros.
- `lib/server-data.ts`, `db/schema.ts` — validações, acesso horizontal e schema.
- `lib/runtime-env.ts`, `lib/supabase-storage.ts` — integração do proxy de Storage sem chave administrativa na hospedagem.
- Rotas em `app/api/auth`, `app/api/admin`, `app/api/manage` e `app/api/uploads` — autorização, origem, limites e upload.
- `app/painel/cadastro/page.tsx`, `components/auth-experience.tsx`, `components/access-manager.tsx` — entrega/consumo seguro do convite e recuperação sem e-mail/WhatsApp.
- `components/dashboard-experience.tsx` — isolamento de links externos abertos em nova aba.
- `next.config.ts` — headers e política de cache.
- `package.json` — comandos reproduzíveis de lint, tipos e testes de segurança.

Alterações de apresentação anteriormente solicitadas em `app/globals.css`, `components/marketing-home.tsx` e partes de `components/auth-experience.tsx` foram preservadas, mas não são tratadas como correções de segurança. Os arquivos `PROJECT_HANDOFF.md` e migrations anteriores já estavam no diretório e não foram atribuídos a esta auditoria.

## 8. Testes e resultados reais

| Verificação | Resultado |
|---|---|
| `node --test tests/security/*.test.ts` | **10 aprovados, 0 falhas** |
| `eslint app components db lib tests next.config.ts` | **Aprovado, 0 erros** |
| `tsc --noEmit` | **Aprovado, 0 erros** |
| `next build --webpack` | **Aprovado**, compilação, TypeScript e 18 páginas geradas |
| `git diff --check` | **Aprovado**, sem erros de whitespace |
| Teste HTTP local do build | Home 200; admin API 401 sem sessão; página admin 307 para login; CSRF 403; tipo incorreto 415; corpo grande 413; headers presentes |
| Verificação Postgres/Supabase | Migration aplicada; RLS/grants/índice/coluna verificados; advisor de segurança sem alerta; contagens preservadas |
| Edge Function de Storage | `oxemenu-storage` versão 1, estado **ACTIVE**; credencial exclusiva configurada na Netlify |
| Varredura de segredos | Nenhuma credencial real confirmada no código/bundle/deploy examinado |
| Produção Netlify | Deploy `6a8792d46747f800084619fd` **ready**, commit `62d1934`, plugin Next concluído e secret scan 0 ocorrências |
| HTTP de produção | Home 200; API admin 401 sem sessão; `/admin` 307 para login; CSP/HSTS/nosniff/anti-frame/COOP presentes; LOGIN no topo; link admin público e texto do ChatGPT ausentes |
| Auditoria automática npm | **Não executada:** acesso ao registry bloqueado pela política da sandbox; não foi fabricado resultado |

O build precisou de um shim temporário, fora do repositório, para duas chamadas de sistema (`uv_resident_set_memory`/interfaces de rede) indisponíveis na sandbox. O mesmo código compilou integralmente; o shim não faz parte do produto nem das alterações entregues.

## 9. Ações restantes do proprietário

1. Entrar com a conta administrativa real e confirmar manualmente login, troca e recuperação de senha; essas credenciais/códigos não foram solicitados nem usados na auditoria. Depois de confirmar o acesso e guardar o código novo, remover `ADMIN_SETUP_CODE` da Netlify.
2. Reduzir o escopo de `DATABASE_URL` e, até sua remoção, de `ADMIN_SETUP_CODE` para functions/runtime. Como os valores são write-only na Netlify, esse ajuste exige os valores originais do proprietário para não substituí-los por dados mascarados.
3. Quando houver um ambiente isolado, executar o roteiro E2E com dois comerciantes descartáveis. Não fazer esse teste criando ou alterando contas reais em produção.
4. Confirmar a propriedade/finalidade das tabelas `agent001_*`. Se não pertencerem a outro componente ativo, movê-las para projeto/schema separado ou removê-las em procedimento com backup; nenhuma exclusão foi feita.
5. Como melhoria futura, avaliar MFA TOTP para administrador e nonce CSP. O nonce do Next torna páginas dinâmicas e exige avaliação de desempenho; a CSP atual ainda permite `unsafe-inline` para bootstrap/estilos, mas bloqueia origens externas, objetos e frames.
6. Em uma CI com acesso ao registry, executar `npm audit --omit=dev` e habilitar alertas/updates de dependência no repositório.

## 10. Riscos arquiteturais residuais

- A autenticação é própria, e o backend usa uma role Postgres interna com política ampla. O navegador não possui acesso direto; todas as decisões por loja são feitas nas APIs e testadas. Ainda assim, defesa em profundidade mais forte exigiria Supabase Auth ou contexto de tenant assinado por transação no banco — uma mudança arquitetural que não deve ser improvisada nesta correção.
- A CSP atual mantém `unsafe-inline` por compatibilidade com o bootstrap/estilos do Next. Não foi usado `unsafe-eval`, scripts externos continuam bloqueados e entradas armazenadas foram sanitizadas.
- Rate limiting usa IP e sujeito no banco; em escala elevada, um serviço dedicado/edge pode oferecer contenção distribuída e limpeza mais eficiente. A solução atual é persistente, não guarda e-mail/IP em texto puro na chave e atende o volume esperado do projeto.

## 11. Status de implantação

- **Banco associado:** migration de segurança aplicada e verificada.
- **Código/GitHub:** correções enviadas para `main` no commit `62d1934`.
- **Storage:** função `oxemenu-storage` ativa; credencial restrita configurada sem expor chave administrativa na Netlify.
- **Produção:** deploy `6a8792d46747f800084619fd` publicado em 20/08/2026, estado `ready`.
- **Verificação pública:** home e redirecionamentos corretos; headers presentes; API administrativa negou visitante; alterações visuais solicitadas confirmadas.
- **Bloqueadores para produção:** nenhum bloqueador crítico/alto conhecido. Restam apenas confirmações que exigem as credenciais reais do proprietário e melhorias opcionais listadas acima.

**Conclusão:** a superfície de maior risco foi eliminada sem remover funcionalidades. O mecanismo de recuperação continua sendo o código gerado para o usuário guardar, agora com hash, uso único, rotação, proteção contra automação e invalidação de sessões. O link administrativo pode permanecer não divulgado, mas a segurança real está na autenticação e autorização do servidor, não em esconder a URL.
