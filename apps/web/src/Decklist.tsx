import { api, ApiError } from './api';
import { useQuery } from './use-query';
import { categoryNames, sourceName, timestamp, unknown } from './presentation';
import { Failure, Loading, SourceLink } from './components';
import { PokemonSprites } from './PokemonSprites';

export function Decklist({ entryId, playerId, backUrl }: { entryId: string; playerId: string; backUrl?: string }) {
  const query = useQuery(entryId, signal => api.decklist(entryId, signal));
  const deck = query.data;
  return <section aria-labelledby="deck-title">
    <a className="back" aria-label="Voltar ao histórico" href={backUrl ?? `#/player/${encodeURIComponent(playerId)}`}>← Voltar ao histórico</a>
    <p className="eyebrow">03 / LISTA HISTÓRICA IMPORTADA</p>
    <h1 id="deck-title" tabIndex={-1}><PokemonSprites name={deck?.archetypeName} />{deck?.archetypeName ?? 'Lista histórica'}</h1>
    <p className="intro">Uma lista pública do passado. Ela não informa o deck atual do jogador.</p>
    {query.status === 'loading' && <Loading>Carregando lista importada…</Loading>}
    {query.status === 'error' && (query.error instanceof ApiError && query.error.status === 404 ? <p className="notice" role="status">Nenhuma lista importada disponível para este resultado. A consulta não inicia uma importação.</p> : <Failure retry={query.retry} />)}
    {deck && <>
      {deck.listStatus === 'FAILED' && <p className="flag">A atualização falhou. Esta é a última lista importada com sucesso.</p>}
      <div className="count"><strong>{deck.cards.reduce((total, card) => total + card.quantity, 0)}</strong> cartas · {deck.cards.length} impressões publicadas</div>
      <div className="card decklist"><ul>{deck.cards.map(card => <li key={card.id}><span className="quantity" aria-label={`${card.quantity} cópias`}>{card.quantity}×</span><div><strong>{card.category === 'pokemon' && <PokemonSprites name={card.name} />}{card.name}</strong><span className="muted small">{card.setCode || unknown} · {card.collectorNumber || unknown} · Idioma: {card.language ?? unknown} · {categoryNames[card.category] ?? card.category}</span></div></li>)}</ul></div>
      <p className="muted small">Identificadores e idioma representam a lista publicada; não comprovam a impressão física utilizada.</p>
      <div className="provenance"><SourceLink url={deck.sourceUrl}>{sourceName(deck.source)} · proveniência</SourceLink><span>Lista importada em {deck.listImportedAt ? timestamp(deck.listImportedAt) : unknown}</span><span>Dados obtidos em {timestamp(deck.lastSyncedAt)}</span></div>
    </>}
  </section>;
}
