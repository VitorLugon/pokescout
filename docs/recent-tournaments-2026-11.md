# Atualização de Nice, Puebla e Gdańsk — 07/11/2026

Os três eventos concluídos foram importados no **PostgreSQL local, porta 55432**, identificado pela configuração atual do projeto. Este procedimento não atualizou um banco remoto Neon/Render.

## Cobertura comprovada

| Evento | País anfitrião | Datas de 2026 no Labs | Masters | Seniors | Juniors | Main: resultados publicados |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Nice | FR | 17–18 de outubro | 2.336 | 190 | 154 | 429 |
| Puebla | MX | 24–25 de outubro | 2.234 | 152 | 82 | 369 |
| Gdańsk | PL | 31 de outubro–1 de novembro | 1.739 | 262 | 122 | 323 |

Fontes: [Nice Labs](https://labs.limitlesstcg.com/0077/standings), [Puebla Labs](https://labs.limitlesstcg.com/0078/standings), [Gdańsk Labs](https://labs.limitlesstcg.com/0079/standings); [Nice Main](https://limitlesstcg.com/tournaments/582), [Puebla Main](https://limitlesstcg.com/tournaments/583), [Gdańsk Main](https://limitlesstcg.com/tournaments/584).

São **7.271 resultados Labs e 1.121 resultados Main**, totalizando **8.392 novos registros de fonte**, em 12 registros de torneio/divisão. Esses totais incluem possíveis representações do mesmo resultado em fontes diferentes e não equivalem a participações únicas confirmadas. As edições antigas de Gdańsk foram preservadas.

As nove páginas Labs contêm o mesmo número de resultados e participantes informados; foram registradas como `COMPLETE_STANDINGS`, sem certificar resultados oficiais. O Main publicou apenas colocações selecionadas e continua `PUBLISHED_RESULTS`; seu estado de conclusão não foi inventado. Formatos e divisões desconhecidos permanecem desconhecidos. Nomes, inclusive abreviações publicadas, Unicode, países de jogador/evento e IDs de cada fonte foram preservados.

## Listas e proveniência

Arquétipos foram obtidos quando publicados. Foram preservadas **8.369 referências novas de listas disponíveis na fonte**, com orçamento zero de download de listas nesta atualização. Nenhuma nova lista completa foi importada: as nove listas anteriores, com 227 registros de cartas, permanecem intactas. O estado `PARTIAL` dos runs corresponde às listas pendentes e, no Main, à cobertura parcial/estado de conclusão desconhecido; não houve falha de gravação de resultados ou novas linhas em quarentena.

Cada registro mantém URL, fonte, identificadores e a data real da captura HTML. Páginas públicas selecionadas foram armazenadas em `.cache/recent-2026-11-07` e reutilizadas entre pré-validação e importação, com os clientes existentes, espaçamento de requisições e parada em erros. Não houve percurso automático dos históricos dos jogadores.

## Execução reproduzível

O manifesto explícito é [recent-2026-11.json](../config/recent-2026-11.json). O CLI agora aceita `--cache-dir`, mantendo o diretório anterior como padrão para os demais comandos.

```powershell
# Prévia: somente consulta ao banco, sem HTTP
pnpm scout:import-catalog --manifest config/recent-2026-11.json --cache-dir .cache/recent-2026-11-07

# Importação limitada aos 12 registros de fonte/divisão selecionados
pnpm scout:import-catalog --manifest config/recent-2026-11.json --cache-dir .cache/recent-2026-11-07 --apply --max-events 12 --stop-file .cache/recent-2026-11-07.stop
```

Repetir o comando após a conclusão não importa novamente os resultados recebidos integralmente. O cache preserva a captura, portanto uma atualização futura de uma mesma página exige uma seleção e um cache novos, com revisão da necessidade de atualizar registros já existentes.

## Validação

- Prévia inicial: 12 registros ausentes. Aplicação: 12 processados, sem interrupção por erro e zero registros restantes na prévia final.
- Estado final: 780 registros de torneio/divisão, 195.190 resultados, 75.822 entidades de jogador de fonte e nenhum run em execução. Entidades de jogador não são pessoas únicas confirmadas.
- Comparação por hash: todos os torneios, resultados, decks, cartas e jogadores existentes antes desta atualização ficaram inalterados. Todos os vínculos anteriores de identidade com fonte/ID/escopo conservaram o proprietário. Aliases e datas de consulta das identidades podem receber as novas aparições, como previsto pelo importador.
- API Fastify e serviços, com os dados reais: o histórico dos vencedores Aarni Karjala, Andrew Hedrick e Luc Gantner inclui os novos resultados; filtros no dia inicial de cada evento retornam a evidência correspondente. O catálogo com Labs prioritário apresenta os três novos Masters na primeira página.
- 69 testes offline de parsers/contratos/serviços e `pnpm typecheck` aprovados. Não houve alteração de parser nem migração de schema nesta atualização.

O relatório verificável com IDs internos, contagens, URLs, timestamps, runs e provas está em [recent-tournaments-2026-11.json](recent-tournaments-2026-11.json).
