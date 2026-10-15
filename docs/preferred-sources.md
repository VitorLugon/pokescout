# Labs prioritário, Main complementar — 15/10/2026

Esta alteração organiza a apresentação. Nenhum registro importado é excluído, nenhuma identidade é fundida e nenhum evento externo é coletado novamente. Os formatos, divisões, países de jogador/evento, nomes originais, URLs, IDs e datas de obtenção continuam associados à fonte original.

## Busca

A busca padrão pede `GET /players?name=...&view=labs-first`. Um nome com exatamente uma identidade Labs e uma Main recebe um cartão principal do Labs e um detalhe com a identidade Main, seu histórico e a seleção para comparação. A igualdade segue as regras do histórico conjunto: Unicode NFC, maiúsculas/minúsculas e espaços, preservando acentos, pontuação e alfabetos. Uma avaliação `DIFFERENT_PEOPLE` impede o agrupamento visual.

Nomes exclusivos do Main continuam visíveis. Grupos com múltiplas identidades na mesma fonte permanecem separados, para não ocultar homônimos ambíguos. O cartão deixa claro que a correspondência pelo nome não confirma identidade. **Mostrar identidades separadas por fonte** restaura a busca original e mantém a seleção de comparação.

Até 100 candidatos da busca original são examinados antes de agrupar e limitar a resposta a até 30 cartões na interface. `truncated` informa a necessidade de refinar a busca; `presentation.inspectedMatchesLimited` distingue o limite dessa pré-seleção. Um equivalente fora do recorte pode continuar aparecendo como cartão separado. O endpoint sem `view` mantém a resposta original.

## Catálogo

A visão padrão pede `GET /tournament-catalog?view=labs-first`. Só agrupa pares entre Labs e Main quando existe candidato de duplicação de evento com pelo menos um candidato de resultado associado, e a correspondência de eventos é um a um. Nome, data ou país isolados não bastam. Muitos-para-muitos e casos sem essa evidência ficam visíveis separadamente.

O cartão inicial usa o Labs. **Resultados e detalhes complementares do site principal** abre a representação Main com sua própria cobertura, contagem, formato, divisão, URL e obtenção. Resultados e listas exclusivos do Main permanecem disponíveis nos históricos e endpoints originais, mesmo quando o cartão do evento é agrupado. As contagens das fontes não são somadas como participações únicas.

O agrupamento ocorre antes da paginação. A consulta lê os metadados do catálogo importado e os pares candidatos em um snapshot consistente; não carrega todos os jogadores nem resultados do banco. A resposta informa grupos de consulta, registros de fonte e pares agrupados. A coleção de metadados é carregada inteira para permitir essa paginação; uma base muito maior poderá exigir uma projeção materializada, sem alterar as regras de identidade.

**Mostrar torneios separados por fonte**, ou o endpoint sem `view`, preserva acesso aos registros individuais. Os três registros de divisão do Labs continuam distintos; uma divisão desconhecida do Main não recebe um valor inventado.

## Histórico e listas

O histórico conjunto anterior continua priorizando Labs em pares de resultados um a um, com a representação Main expansível. Resultados exclusivos de qualquer fonte continuam na linha do tempo. Quando só a alternativa possui uma lista importada, há agora um aviso visível no cartão principal, com acesso pela expansão. A lista não é copiada ou atribuída ao Labs. O resumo de arquétipos continua restrito à identidade selecionada, conforme documentado no histórico conjunto.

## Validação

Os testes verificam prioridade, nomes Main exclusivos, ambiguidades, acentos, avaliações contrárias, limites, paginação após agrupamento e ausência de alterações nos dados originais. A fixture de histórico inclui uma lista importada apenas na alternativa Main. A interface permite consultar os detalhes e selecionar ambas as identidades para comparação, inclusive em 320 px.

Conferência inicial da API real: 768 registros de torneio/divisão apresentados em 692 grupos, com 76 pares agrupados. Para Luiz Gustavo Bianchi, a busca mostra um cartão Labs com a identidade Main no detalhe; seu histórico conjunto continua com nove registros de fonte em oito grupos. Esses totais não representam identidades ou participações únicas confirmadas.

Conferência final: os 768 IDs do catálogo original foram recuperados exatamente uma vez entre cartões principais e alternativas da visão preferida, sem omissões. Layout real conferido em 320 px. Passaram 69 testes offline, 43 testes PostgreSQL em schema isolado, 36 testes de interface com fixtures e cinco fluxos com API/banco reais (153 testes distintos), além de typecheck e build. O teste de histórico conjunto foi repetido após o ajuste final da projeção; os quatro testes focados de interface também passaram com a lista importada exclusivamente na alternativa Main.
