# OxeMenu — Seu Cardápio Digital

Sistema de cardápios digitais com página pública, carrinho para pedidos pelo WhatsApp, painel administrativo e painel do comerciante.

## Tecnologias

- Next.js 16 com App Router
- React 19 e TypeScript
- PostgreSQL do Supabase
- Supabase Storage privado para as imagens
- Vercel para hospedagem

## Configuração

Crie um arquivo `.env.local` a partir de `.env.example` e informe:

- `DATABASE_URL`: conexão PostgreSQL do pooler transacional do Supabase
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço usada apenas no servidor
- `ADMIN_SETUP_CODE`: chave única para criar a primeira conta administrativa
- `ADMIN_EMAILS`: e-mails administrativos separados por vírgula, quando necessário
- `NEXT_PUBLIC_SITE_URL`: endereço público do site
- `NEXT_PUBLIC_OXEMENU_WHATSAPP`: contato comercial da OxeMenu com DDI e DDD
- `DEMO_WHATSAPP`: número que receberá pedidos feitos na demonstração Coffe Love

Nunca publique `.env.local` nem a chave `SUPABASE_SERVICE_ROLE_KEY` no GitHub.

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
