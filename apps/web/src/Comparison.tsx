import { api, ApiError } from './api';
import { useQuery } from './use-query';
import { Failure, Loading, SourceLink } from './components';
import { ResultEvidence } from './Evidence';
import { sourceName, timestamp, unknown } from './presentation';

const decisions: Record<string, string> = { SAME_PERSON: 'Avaliação: mesma pessoa', DIFFERENT_PEOPLE: 'Avaliação: pessoas diferentes', UNCERTAIN: 'Avaliação: identidade incerta' };
export function Comparison({ a, b, hidden }: { a: string; b: string; hidden: boolean }) {
  const query = useQuery(`${a}:${b}`, signal => api.compare(a, b, signal));
  const data = query.data;
  return <section hidden={hidden} aria-labelledby="comparison-title">
    <a href="#/" className="back">← Voltar à busca e seleção</a>
    <p className="eyebrow">COMPARAÇÃO DE EVIDÊNCIAS</p>
    <h1 id="comparison-title" tabIndex={-1}>Duas identidades,<br />históricos separados.</h1>
    <p className="intro">Nome, país e semelhança de resultados são indícios para revisão. Nenhum deles comprova identidade.</p>
    {query.status === 'loading' && <Loading>Carregando comparação…</Loading>}
    {query.status === 'error' && <Failure retry={query.retry}>{query.error instanceof ApiError && query.error.status === 404 ? 'Uma das identidades não foi encontrada nesta base.' : query.error instanceof ApiError && query.error.status === 400 ? 'Selecione duas identidades distintas e válidas.' : undefined}</Failure>}
    {data && <>
      <div className="notice"><strong>Identidades não unidas.</strong><p className="small">As contagens abaixo são resultados publicados por fonte, não participações únicas confirmadas. Arquétipos são históricos, não o deck atual.</p></div>
      {data.sharedNameKeys.length > 0 && <p className="flag">Há nomes normalizados coincidentes. Isso não comprova que sejam a mesma pessoa.</p>}
      <p className="small muted">Até {data.historyLimit} resultados por identidade. Ordem estável por ID interno; este recorte não é uma seleção dos resultados mais recentes. Países e sobreposições resumem apenas o recorte retornado.</p>
      {data.historyTruncated && <p className="flag">Evidência limitada: há resultados além do recorte exibido. Ausência de sobreposição aqui não prova ausência na carreira.</p>}
      <div className="comparison-players">{data.players.map((player, index) => <article className="card" key={player.id}>
        <p className="eyebrow">IDENTIDADE {index + 1}</p><h2>{player.displayName}</h2>
        <p className="small">Aliases: {player.aliases.join(' · ') || unknown}</p>
        <p className="small">Países informados neste recorte: {player.countries.join(' · ') || unknown}. Não são nacionalidade confirmada.</p>
        <ul className="identities">{player.identities.map(identity => <li key={`${identity.source}:${identity.scope}:${identity.externalId}`}><strong>{sourceName(identity.source)} · ID {identity.externalId}</strong><span>Escopo: {identity.scope}</span><div className="provenance"><SourceLink url={identity.sourceUrl}>Identidade na fonte</SourceLink><span>Obtida em {timestamp(identity.lastSyncedAt)}</span></div></li>)}</ul>
        <p className="count"><strong>{player.resultCount}</strong> resultados publicados de fonte<span>Exibindo {player.entries.length}{player.historyTruncated ? ' · recorte truncado' : ''}.</span></p>
        <a className="button" href={`#/player/${player.id}`}>Consultar histórico desta identidade →</a>
        {!player.entries.length && <p className="notice">Nenhum resultado disponível neste recorte.</p>}
        <ul>{player.entries.map(entry => <li key={entry.id}><ResultEvidence entry={entry} overlap={data.overlappingTournamentIds.includes(entry.tournament.id)} /></li>)}</ul>
      </article>)}</div>
      <section aria-labelledby="overlaps-title"><h2 id="overlaps-title">Possíveis sobreposições entre fontes</h2>
        {data.possibleOverlappingSourceEventPairs.length === 0 && <p className="muted small">Nenhum par candidato entre as duas identidades neste recorte. Isso não comprova ausência de duplicações.</p>}
        <ul>{data.possibleOverlappingSourceEventPairs.map(pair => <li key={pair.id}><a className="button" href={`#/compare/${a}/${b}/duplicate/event/${pair.id}`}>Consultar possível evento duplicado →</a></li>)}</ul>
      </section>
      <section aria-labelledby="reviews-title" className="reviews"><h2 id="reviews-title">Avaliações registradas</h2>
        <p className="small muted">Exibindo {data.reviews.length} de {data.reviewsTotal}; limite {data.reviewsLimit}. Avaliações humanas não são prova definitiva. A mais recente não substitui automaticamente as anteriores. Revisores são rótulos locais, sem autenticação.</p>
        {data.reviewsTruncated && <p className="flag">Revisões truncadas: outras avaliações não estão neste recorte.</p>}
        {data.reviewDecisionsConflict && <p className="flag">Existem avaliações contraditórias neste recorte. Todas permanecem visíveis; nenhuma autoriza fusão automática.</p>}
        {!data.reviews.length && <p className="notice">Nenhuma avaliação registrada para este par.</p>}
        <ul>{data.reviews.map(review => <li key={review.id} className="card review"><h3>{decisions[review.decision] ?? `Avaliação: ${review.decision}`}</h3><p className="small">Decisão registrada: {review.decision}</p><p className="review-text">{review.reason}</p><p className="small muted">Revisor: {review.reviewer} · {timestamp(review.createdAt)}</p>
          <ul className="provenance">{review.evidenceUrls.map((url, index) => <li key={`${index}:${url}`}><SourceLink url={url}>Evidência pública {index + 1}</SourceLink></li>)}</ul>
          {review.decision === 'SAME_PERSON' && <p className="flag">SAME_PERSON é uma avaliação registrada. Os jogadores, identificadores e históricos continuam separados.</p>}
        </li>)}</ul>
        <p className="small muted">Novas avaliações são registradas pelo CLI existente; esta tela é somente leitura.</p>
      </section>
    </>}
  </section>;
}
