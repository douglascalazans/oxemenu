# Continuação do projeto OxeMenu

Estado registrado em 20 de agosto de 2026 para permitir a continuação do trabalho em outra conta, sem incluir senhas, tokens ou outras credenciais.

## Projeto e produção

- Repositório: `douglascalazans/oxemenu`
- Produção: `https://oxemenu.netlify.app/`
- Netlify site ID: `58b26dc5-f51f-4166-8f8f-ee4d32264b73`
- Supabase project ref: `jskdmiwffcsbpxadbfms`
- Commit em produção: `62d1934cabfc984196fcc003b27f6fc42104d674`
- Deploy de produção: `6a8792d46747f800084619fd` (`ready`)
- Branch local desta verificação: `agent/auth-recovery-code`

## Autenticação escolhida

O projeto usa o fluxo original, sem e-mail, WhatsApp ou API externa:

1. no cadastro, o sistema gera um código permanente no formato `XXXX-XXXX-XXXX`;
2. a pessoa guarda esse código em local seguro;
3. se esquecer a senha, informa e-mail, código e senha nova;
4. após uma recuperação bem-sucedida, o código antigo é invalidado e um novo código é mostrado para ser guardado.

O código nunca é salvo em texto puro. O banco mantém apenas `recovery_code_hash`.

Não são necessárias variáveis da Brevo, Meta ou qualquer serviço de mensagens. As configurações temporárias de OTP foram retiradas do Netlify e a tabela temporária vazia foi removida do Supabase.

## Acesso administrativo

O banco possui um administrador ativo. A auditoria não usou senha nem código real. O proprietário deve confirmar login e recuperação em `https://oxemenu.netlify.app/admin/login`; depois de guardar o código de recuperação válido, pode remover `ADMIN_SETUP_CODE` da Netlify, pois a criação inicial já foi concluída.

Não registrar senha, código de recuperação ou chave inicial neste documento ou em mensagens de transferência.

## Banco e migrations

As migrations de 20 de agosto registram a tentativa descartada e sua limpeza:

- `20260820162434_whatsapp_password_reset_otp`;
- `20260820163851_email_password_reset_cleanup`;
- `20260820213820_drop_password_reset_challenges`.

O estado final não possui telefone de autenticação nem tabela de OTP. A coluna `users.recovery_code_hash` continua presente. O consultor de segurança do Supabase não apresentou alertas após a limpeza.

A migration `20260820230000_security_hardening.sql` também está aplicada: adiciona custo versionado de senha, rate limit persistente, unicidade do administrador e revoga DML direto das roles públicas.

## Armazenamento de imagens

- Edge Function `oxemenu-storage` versão 1 ativa no Supabase;
- bucket `oxemenu-media` privado, limitado a 6 MiB e imagens JPG/PNG/WebP/GIF;
- Netlify usa apenas `OXEMENU_STORAGE_PROXY_KEY` com escopo functions/runtime;
- a chave administrativa de Storage permanece dentro do runtime do Supabase;
- tipo, tamanho, extensão, caminho e assinatura do arquivo são verificados na API e novamente no proxy.

## Verificação

- Código de autenticação seguro publicado em produção.
- Deploy `6a8792d46747f800084619fd` concluído com estado `ready`.
- Página principal sem link público para a administração, com `LOGIN` do comerciante no topo.
- Texto sobre conta do ChatGPT removido das telas de autenticação.
- 10/10 testes de segurança, ESLint e TypeScript aprovados.
- Build Next.js de produção aprovado, com 18 páginas geradas.
- Produção: home 200, API admin 401 sem sessão e `/admin` redirecionando para login.
- Headers CSP, HSTS, nosniff, anti-frame e COOP confirmados.
- Secret scan do deploy: 80 arquivos examinados, zero ocorrências.

## Auditoria de segurança

O relatório completo está em `SECURITY_AUDIT.md`. A pontuação fundamentada passou de 46/100 para 91/100; não há vulnerabilidade crítica ou alta conhecida aberta no código publicado.

## Próxima sequência recomendada

1. testar o login e a recuperação com a conta real e guardar o código novo;
2. depois disso, remover `ADMIN_SETUP_CODE` da Netlify;
3. excluir na Brevo a chave de API que foi criada e não será usada;
4. executar futuramente o roteiro A/B somente em ambiente isolado com contas descartáveis;
5. confirmar se as tabelas `agent001_*` pertencem a outro componente antes de qualquer alteração.
