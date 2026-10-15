# Histórico conjunto por nome — 15/10/2026

Atendendo à solicitação de reunir nomes iguais do Labs e do site principal, a tela de histórico habilita por padrão **Reunir nomes iguais no Labs e Limitless**. Desmarcar a opção restaura o histórico da identidade selecionada e volta à primeira página. A busca continua preservando os candidatos/identificadores originais.

## Regras

- A visão é somente de consulta: nenhuma identidade, resultado, lista ou relação de propriedade é alterada no PostgreSQL. Não há migração ou nova coleta externa.
- A identidade selecionada é a âncora. São procuradas identidades da outra fonte, com o mesmo nome de exibição após normalização Unicode NFC, ajuste de maiúsculas/minúsculas e espaços. Acentos, pontuação e alfabetos são preservados. Nomes apenas semelhantes ou romanizados não entram automaticamente.
- Uma avaliação `DIFFERENT_PEOPLE` entre a âncora e um candidato exclui esse candidato, mesmo que haja avaliações contraditórias. O conjunto continua sendo uma hipótese pelo nome, nunca identidade confirmada. Homônimos ainda podem aparecer; a tela informa isso e permite consultar fontes e IDs reunidos.
- Os resultados são ordenados pela data de início conhecida, com desempate por ID. Datas desconhecidas ficam por último. A paginação é feita depois do agrupamento de possíveis duplicações.
- Só um par de resultados já sinalizado pelo detector existente, entre fontes diferentes e com correspondência um a um no conjunto carregado, recebe um único cartão. Labs é a representação inicial; a outra fonte fica expansível e preserva os próprios nomes, países, formato, resultados, arquétipos, links e listas. Isso é agrupamento de consulta, não confirmação de duplicação. Evidências ambíguas de muitos para muitos ficam separadas e sinalizadas.
- A contagem distingue grupos de consulta, registros de fonte e pares agrupados. Nenhuma delas é promovida a número confirmado de participações únicas. Ausência de um par candidato não garante ausência de duplicações.
- O resumo de arquétipos, percentuais e filtros de scouting continuam restritos à identidade selecionada. A tela explicita essa limitação; não se combinam estatísticas automaticamente com base em nome.

## API e limites

`GET /players/:id/history?view=same-name&limit=10&offset=0` usa o serviço de histórico conjunto. O endpoint sem `view` preserva o comportamento e contrato anteriores. A projeção acrescenta `combination`, com membros, fundamento, `confirmedSamePerson=false`, contagem de registros de fonte, pares agrupados e limites. Os cartões podem conter `otherSources`, acessíveis também pelas rotas existentes de listas e evidências.

Consultam-se até 100 candidatos do índice de busca exato e até 5.000 resultados recentes por conjunto, em uma leitura consistente. Um registro extra detecta truncamento. Os limites aparecem na resposta e na interface; nesse caso o total de grupos descreve apenas o recorte carregado, enquanto `sourceResultCount` informa o total de registros das identidades selecionadas. A busca de candidatos usa o índice normalizado apenas como pré-seleção e depois exige igualdade estrita do nome pela regra acima. Formas apenas semelhantes podem consumir parte dessa pré-seleção; o aviso de limite continua necessário.

## Caso real verificado

Luiz Gustavo Bianchi: Labs `5351` tem oito resultados; Main `15678` tem um. A visão conjunta contém nove registros de fonte em oito grupos. Recife aparece primeiro, com a representação Labs e a versão Main expansível. Não se afirma que os oito grupos sejam participações únicas confirmadas.

## Validação

Testes cobrem nomes Unicode, acentos/romanização/pontuação preservados, pares um a um, casos ambíguos, resultados fora do conjunto e mesma fonte, ordenação/paginação, leitura sem alterações de dados/identidades e avaliações de pessoas diferentes. Na interface, fixtures exercitam modo conjunto/individual, proveniência expansível, listas, limites e tamanho de 320 px. A API real confirmou o conjunto de Luiz; capturas mobile ficam no cache local ignorado.

Resultado final: 65 testes offline, 43 PostgreSQL em schema isolado, 34 testes de interface com fixtures e cinco fluxos com API/banco reais aprovados (147 ao todo). Typecheck e build de produção aprovados. O fluxo real de lista de uma identidade usa explicitamente o modo individual; a comparação e os resumos anteriores continuam sem agregação por nome. A tela real de Luiz foi conferida em 320 e 390 px, incluindo a proveniência Main expandida, sem rolagem horizontal.
