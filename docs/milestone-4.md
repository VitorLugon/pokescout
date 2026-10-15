# Milestone 4 — MVP mobile de consulta histórica

Implementado e validado em 14/10/2026 sobre a base do Milestone 3.5. A interface usa os imports existentes. Nenhum novo torneio ou lista foi coletado; nenhuma migração ou alteração de dados foi necessária. PostgreSQL permanece em **127.0.0.1:55432**.

## Plano e decisões

1. Ler instruções, documentação, contratos, serviços e rotas; executar os **71 testes existentes** antes de implementar.
2. Adicionar `apps/web` com React, TypeScript e Vite, consumindo somente a API local. Compartilhar projeções JSON em `packages/shared`; verificar estaticamente sua compatibilidade com os retornos reais dos serviços, incluindo a serialização de Date pelo Fastify.
3. Implementar busca → escolha de identidade → histórico paginado → lista importada, com estados de carregamento, erro e ausência. Preservar os limites de evidência dos dados.
4. Validar com fixtures de API sintéticas em navegador e com a API/PostgreSQL reais, sem executar imports. Conferir capturas em largura de smartphone, teclado, TypeScript e build.

Não houve mudança nos serviços de consulta nem nos endpoints. Identidade, pesquisa e interpretação de duplicações permanecem nos serviços; componentes exibem as evidências recebidas. `presentation.ts` reúne apenas formatação de texto, estados de lista e validação de links públicos.

## Telas e endpoints

| Fluxo | Endpoint | Comportamento |
| --- | --- | --- |
| Busca e identificação | `GET /players?name=...&limit=30` | Normalização compartilhada, mínimo de dois caracteres e debounce de 350 ms. Cada alteração cancela a requisição anterior; um marcador de atividade também impede que respostas antigas sejam aplicadas. Loading, erro com retry, vazio e truncamento explícitos. |
| Histórico da identidade escolhida | `GET /players/:id/history?limit=10&offset=...` | Dez resultados por página, controles anterior/próxima, contagem de resultados publicados de fonte. Não agrega outros IDs. |
| Lista importada | `GET /entries/:id/decklist` | Somente leitura; 404 significa ausência de lista importada, sem iniciar sincronização. Erros podem ser tentados novamente. |

Busca aceita os caracteres Unicode originais e usa `nameSearchKey` existente para consulta. Não implementa transliteração nem correção aproximada de erros de digitação. Aliases, namespace/ID/escopo e países informados em resultados recentes ajudam a distinguir candidatos. Esses países são uma amostra limitada pela API, não confirmação de nacionalidade. Nomes semelhantes e revisões de identidade não unem históricos; esta interface não grava nem interpreta revisões SAME_PERSON como fusão.

Histórico mostra nome original do resultado, data publicada, país anfitrião, país do jogador informado, colocação, recorde conhecido, divisão, formato literal da fonte, arquétipo histórico, estado da lista e links de proveniência. Valores null permanecem “Não informado”; não viram zero, Masters ou Standard. Rótulos `standard-jp` permanecem distintos. W/L/T parcialmente conhecidos conservam cada parcela conhecida, sem preencher lacunas.

`PUBLISHED_RESULTS` aparece como cobertura parcial/selecionada; cobertura desconhecida tem rótulo próprio. `fullySynchronized=false` avisa sobre importação parcial independentemente da cobertura da fonte. Candidatos de duplicação de evento/resultado geram aviso para revisão e nunca participações adicionais confirmadas. Contagens permanecem resultados publicados de fonte.

Arquétipo, disponibilidade de lista na fonte, lista ainda não importada, falha de extração e importação bem-sucedida são distintos. Uma lista anterior permanece acessível se um refresh posterior falhou. Cartas mostram quantidade, nome, set, número e idioma publicados; isso não comprova a impressão física utilizada. O aplicativo identifica todas as listas e arquétipos como históricos e não afirma conhecer o deck atual.

## Navegação e apresentação

Layout de uma coluna, cores claras com cabeçalho verde, tipografia de sistema (sem fontes ou recursos externos), botões de pelo menos 44 px, labels e foco visível. Links externos são links de proveniência, não requisições de coleta. Abrem em outra aba com `noopener noreferrer`; protocolos não HTTP(S) e credenciais não são aceitos.

Rotas hash locais permitem o voltar do navegador e acesso direto a históricos/listas. A busca permanece montada durante a navegação; nome e candidatos são preservados ao voltar. O histórico permanece montado enquanto a lista está aberta, conservando a página. Navegar para outra identidade reinicia a paginação. Recarregar a página não persiste a consulta; não há armazenamento local de pesquisas. O foco vai para o título ao mudar de tela, sem capturar o foco na carga inicial. Há um botão de salto para o conteúdo, operável por teclado.

## Execução e configuração

Preserve o `.env` e o banco existentes. Não copie o exemplo sobre um `.env` já configurado.

```powershell
pnpm install
# Terminal 1, PostgreSQL existente ligado:
pnpm api:start
# Terminal 2:
pnpm web:dev
```

Abrir [http://127.0.0.1:5173](http://127.0.0.1:5173) e ativar a visualização responsiva do navegador. Se necessário, `pnpm db:up` inicia o banco existente sem reset. A API permanece em `127.0.0.1:3001` por padrão. Não é necessário importar novamente.

Configuração opcional em `apps/web/.env` baseada no `.env.example` local:

- `VITE_API_BASE_URL=/api`: endereço usado pelo navegador, incorporado ao bundle no build. Nunca incluir segredos em VITE_*.
- `API_PROXY_TARGET=http://127.0.0.1:3001`: destino do proxy Vite, limitado à configuração da API do projeto. Não aponta para fontes externas.

O proxy cobre somente o caminho `/api`, removendo esse prefixo ao encaminhar. Dev e preview usam o mesmo proxy; não se adiciona CORS irrestrito na API. `pnpm web:build` gera `apps/web/dist`; `pnpm web:preview` serve o bundle em `127.0.0.1:4173`. Hospedagem definitiva deve configurar reverse proxy próprio para a API. O bind padrão é loopback; acesso por telefone físico/rede local não foi configurado ou alegado como testado.

A configuração segue a [documentação oficial de proxy do Vite](https://vite.dev/config/server-options.html#server-proxy). A dimensão de viewport e o navegador dos testes seguem a [configuração do Playwright](https://playwright.dev/docs/test-use-options).

## Validação

Os testes de navegador usam Chromium por padrão. Instalar uma vez com `pnpm --filter @tcg-scout/web exec playwright install chromium`, ou selecionar Edge instalado com `$env:PLAYWRIGHT_CHANNEL='msedge'` (opção utilizada nesta máquina).

```powershell
pnpm test
pnpm test:db
pnpm test:web
pnpm typecheck
pnpm web:build
pnpm scout:proof
# API real em execução, sem novos imports:
$env:POKESCOUT_LIVE_API='1'
pnpm test:web
Remove-Item Env:POKESCOUT_LIVE_API
```

- **41 testes offline anteriores aprovados**, sem modificar/remover os casos existentes.
- **30 testes PostgreSQL anteriores aprovados**, em schema isolado, sem limpar dados da aplicação.
- **10 novos testes de navegador com fixtures de API sintéticas aprovados**: Unicode/aliases e candidatos ambíguos; debounce e respostas antigas; nulos, formato regional e países distintos; cobertura parcial e duplicações; paginação e voltar preservado; lista/impressões/idioma; lista ausente; disponibilidade/falha pendente; erro/retry/vazio/truncamento; falhas de histórico/lista e preservação de lista anterior; teclado, toque e largura de 320 px.
- **Dois testes de navegador com API/PostgreSQL reais aprovados**: busca por Jooho → identidade Main → histórico parcial coreano → lista existente de 60 cartas; busca por Francisco Osorio com os IDs Labs 5391 e 57170 separados. As fixtures são explicitamente sintéticas; não atribuem nomes japoneses inventados a jogadores reais.
- **83 testes aprovados ao todo**, em execuções separadas dos grupos offline e real. Os dois testes reais ficam desabilitados por padrão; a execução real desabilita os dez simulados para deixar clara a origem da evidência.
- TypeScript do backend e frontend aprovado; build de produção aprovado; prova offline original preservada e aprovada.
- Capturas verificadas visualmente em **390 × 844** e **320 × 740**, sem rolagem horizontal nos fluxos verificados. Teclado e tamanho de alvo também são verificados por Playwright. Isso não equivale a auditoria completa de acessibilidade nem teste em aparelho físico.

Capturas locais (ignoradas pelo Git) ficam em `.cache/milestone-4-history-mobile.png`, `.cache/milestone-4-search-320.png`, `.cache/milestone-4-real-search-mobile.png`, `.cache/milestone-4-real-history-mobile.png` e `.cache/milestone-4-real-deck-mobile.png`. Traces de falhas ficam em `.cache/web-test-results`. Nenhum teste precisa de websites de torneios online.

O Vite/esbuild precisou executar fora do sandbox de leitura desta sessão para resolver diretórios; o navegador usado foi Edge headless local. Uma falha inicial de foco de teclado foi corrigida e a suíte completa repetida. Não houve bypass de controle de fonte nem mudança na porta do banco.

## Arquivos e limites

Criados: `apps/web` (configuração, cliente HTTP, hook de consultas, navegação, componentes, estilos e testes), `packages/shared/src/query-contracts.ts`, verificação estática `apps/api/src/query-contracts.ts` e este documento. Atualizados: exports compartilhados, scripts/configuração TypeScript da raiz, lockfile, README e visão arquitetural.

Cobertura continua restrita aos eventos/listas já importados, inclusive resultados asiáticos selecionados. A busca retorna até 30 candidatos; países resumem os resultados recentes limitados pela API. Links de proveniência podem mudar fora do controle do projeto. A API continua sendo contrato local de inspeção, não uma API pública versionada. A interface lista os candidatos de duplicação como avisos, sem painel de revisão detalhada. Não há novos crawlers, sincronização recorrente, previsões, IA, autenticação, pagamentos ou fusões de identidade.
