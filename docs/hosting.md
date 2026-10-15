# Hospedagem do PokéScout

Situação em 14/10/2026: aplicação e PostgreSQL executados localmente. Nenhum deploy público foi realizado ou validado.

## Caminho para publicação

A Vercel suporta [Vite](https://vercel.com/docs/frameworks/frontend/vite) e [Fastify](https://vercel.com/docs/frameworks/backend/fastify). Portanto, é possível publicar frontend e API lá; não é obrigatório trocar a arquitetura. Um PostgreSQL gerenciado, por exemplo pelas [integrações de banco da Vercel](https://vercel.com/docs/postgres), precisa armazenar os dados na nuvem. O PostgreSQL local na porta 55432 permanece para desenvolvimento.

Sugestão para este monorepo: dois projetos, frontend e API, com o banco próximo da região da API. A estrutura é suportada pela [documentação de monorepos](https://vercel.com/docs/monorepos). A configuração exata depende da conta e do provedor de banco escolhidos e ainda precisa de um deploy de prévia.

## Preparação necessária

1. Vincular o repositório e a conta de hospedagem. Selecionar projetos e plano antes de provisionar recursos pagos.
2. Provisionar um banco de produção separado, com TLS e conexão apropriada para o ambiente de funções. Configurar `DATABASE_URL` somente no backend. Nunca colocar credenciais em `VITE_*`.
3. Gerar o Prisma Client no build da API e aplicar as migrações existentes no banco de destino. Migrar os dados locais por backup/restauração compatíveis, preservando identificadores, relações e proveniência; validar contagens antes da troca. Não repetir a coleta externa para transportar dados já importados.
4. Configurar o projeto web com raiz `apps/web`, build `pnpm build` e saída `dist`, incluindo os pacotes do workspace na instalação. Manter `VITE_API_BASE_URL=/api` e configurar um rewrite de `/api/:path*` para a API publicada, removendo o prefixo `/api` no destino. O proxy do Vite atual só funciona em desenvolvimento/preview local.
5. Validar a entrada da API Fastify na Vercel. `apps/api/src/server.ts` depende do banco antes de iniciar; essa inicialização, a detecção da entrada e o ciclo de conexão Prisma precisam ser testados no runtime de hospedagem. A presença de `src/app.ts` e `src/server.ts` exige definir uma entrada inequívoca ao configurar o projeto. Para hospedagem como processo Node no Render, o servidor já aceita `API_HOST` e a porta da plataforma: configure `API_HOST=0.0.0.0`; a precedência da porta é `API_PORT`, depois `PORT`, depois `3001`. O padrão local permanece `127.0.0.1:3001`.
6. Executar uma prévia: saúde da API, busca Unicode, histórico, paginação de torneios, listas e sprites locais. Verificar erros sem segredos, HTTPS e tempos das consultas com a base ampliada. Só então publicar produção/domínio.

Os comandos de importação continuam como tarefas manuais separadas. As importações longas, o cache local e a retomada não devem depender de uma requisição da API ou do sistema de arquivos efêmero de funções. Nenhuma sincronização recorrente foi configurada.

O Codex pode preparar a configuração e executar o deploy quando a conta e o destino estiverem disponíveis. O usuário precisa realizar o login/autorizar acesso pelo fluxo do provedor; não deve enviar senhas ou tokens em mensagens. Este documento descreve o caminho de publicação, não certifica compatibilidade do deploy antes da validação de prévia.
