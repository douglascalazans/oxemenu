# OxeMenu — Seu Cardápio Digital

Sistema de cardápios digitais com página pública, carrinho para pedidos pelo WhatsApp, painel administrativo e painel do comerciante.

## Tecnologias

- Next.js 16 com App Router
- React 19 e TypeScript
- PostgreSQL do Supabase
- Supabase Storage privado para as imagens
- Netlify com OpenNext para hospedagem

## Configuração

Crie um arquivo `.env.local` a partir de `.env.example` e informe:

- `DATABASE_URL`: conexão PostgreSQL do pooler transacional do Supabase
- `SUPABASE_URL`: URL do projeto Supabase
- `OXEMENU_STORAGE_PROXY_KEY`: credencial restrita ao proxy privado do bucket `oxemenu-media` (recomendado na Netlify)
- `SUPABASE_SECRET_KEY`: alternativa de acesso direto ao Storage, usada somente no servidor
- `ADMIN_SETUP_CODE`: chave única para criar a primeira conta administrativa
- `ADMIN_EMAILS`: e-mails administrativos separados por vírgula, quando necessário
- `NEXT_PUBLIC_SITE_URL`: endereço público do site
- `NEXT_PUBLIC_OXEMENU_WHATSAPP`: contato comercial da OxeMenu com DDI e DDD
- `DEMO_WHATSAPP`: número que receberá pedidos feitos na demonstração Coffe Love

Nunca publique `.env.local`, `OXEMENU_STORAGE_PROXY_KEY`, `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` no GitHub.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Verificação

```bash
npm test
npm run build
```

As tabelas e o bucket privado `oxemenu-media` são preparados automaticamente na primeira utilização com as credenciais configuradas.

## Publicação

O projeto está configurado para publicação dinâmica no Netlify:

- comando de build: `npm run build`
- diretório de publicação: `.next`
- runtime: Node.js 24
- App Router, SSR, APIs e otimização de imagens preservados pelo adaptador OpenNext

As variáveis sigilosas devem ser cadastradas no painel do Netlify, nunca no repositório.
