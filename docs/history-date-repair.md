# Correção de históricos — 15/10/2026

## Causa verificada

O caso informado foi Luiz Gustavo Bianchi e Regional Recife. O resultado já estava importado nas duas fontes: Labs `0075`, Masters, identidade `5351`; Main `580`, identidade `15678`. Ambas publicam colocação 76. No Labs, o resultado registra 8–4–1 e Dragapult. As identidades continuam separadas e os dois registros não são somados como participações adicionais confirmadas.

Quatro registros de torneio/divisão importados antes da introdução de `eventDate` ainda tinham esse campo nulo. A ordenação por data colocava esses registros depois dos registros com data conhecida. Os filtros de período também os excluíam como data desconhecida. Isso fazia Recife aparecer fora da ordem esperada, embora estivesse salvo.

## Correção aplicada

O comando `pnpm scout:repair-dates` mostra uma prévia local. Com `--apply`, preenche somente `eventDate` nulo de Labs/Main quando `publicEventDate` consegue interpretar o rótulo público já armazenado. Não faz HTTP, não modifica rótulos/datas de obtenção, não reimporta resultados nem altera vínculos de jogadores. Datas não interpretáveis ou intervalos entre anos ambíguos permanecem desconhecidos. A atualização confere que o campo continua nulo e que o rótulo continua igual; a operação é transacional e idempotente.

Aplicação local: quatro registros corrigidos, sem pendências na segunda execução:

| Fonte | Evento | Divisão | Data recuperada |
| --- | --- | --- | --- |
| Labs | 0075 Recife | MA | 2026-10-03 |
| Labs | 0075 Recife | SR | 2026-10-03 |
| Labs | 0009 São Paulo | MA | 2024-11-15 |
| Labs | 0012 Bogotá | MA | 2024-12-07 |

A sincronização também consegue preencher a data pelo rótulo caso um adaptador antigo omita `eventDate`, preservando antes uma data já existente. O histórico passou a informar o intervalo exibido na página e oferece acesso/comparação de outros candidatos de mesmo nome normalizado. Essa busca de candidatos é limitada a 30 retornos, com até cinco atalhos; não é resolução de identidade nem garantia de encontrar toda variação de nome.

## Validação

- Teste PostgreSQL em schema isolado: prévia sem escrita, reparação idempotente, preservação dos demais campos de torneio/resultados/decks, datas desconhecidas/ambíguas intactas, ordenação paginada e filtro de período.
- Testes de interface com fixtures: atalhos entre fontes sem somar resultados, nomes apenas semelhantes não apresentados como o mesmo jogador, paginação explícita e layout de 320 px.
- API real após a correção: identidade Labs de Luiz mantém oito resultados; Recife aparece primeiro, com data 2026-10-03, colocação 76, recorde 8–4–1 e Dragapult. A consulta de evidências `scope=matched` de outubro de 2026 retorna Recife. Possíveis duplicações continuam acessíveis, mas podem ser excluídas das frequências conservadoras do resumo de arquétipos.

Fontes públicas conferidas: [Recife no Labs](https://labs.limitlesstcg.com/0075/standings?c=BR) e [histórico Main](https://limitlesstcg.com/players/15678/results). A correção resolve o caso verificado; não estabelece completude da carreira de todos os jogadores ou cobertura de todos os eventos externos.
