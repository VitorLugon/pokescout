import { useState } from 'react';
import { api } from './api';
import { useQuery } from './use-query';
import { Failure, Loading, SourceLink } from './components';
import { coverageLabel, sourceName, timestamp, unknown } from './presentation';
import type { TournamentCatalogResponse } from '@tcg-scout/shared';

function TournamentCard({event}:{event:TournamentCatalogResponse['events'][number]}) {
  return <li className="card result">
    <p className="eyebrow">{sourceName(event.source)} · {event.externalId}</p><h2>{event.name}</h2>
    <p>{event.dateLabel} · País anfitrião: {event.country ?? unknown}</p>
    {!event.country && event.locationLabel && <p className="small muted">Local / plataforma na fonte: {event.locationLabel}</p>}
    <p className="small">Divisão: {event.division ?? unknown} · Formato da fonte: {event.format ?? unknown}</p>
    <p>{event.entriesCount} resultados publicados · {coverageLabel(event.resultsCoverage)}</p>
    <p className="small muted">Participantes informados pela fonte: {event.reportedPlayerCount !== null && event.reportedPlayerCountApproximate ? 'aproximadamente ' : ''}{event.reportedPlayerCount ?? unknown}</p>
    {!event.fullySynchronized && <p className="muted small">Importação parcial: resultados ou listas podem estar ausentes.</p>}
    {event.quarantinedResultCount > 0 && <p className="flag">{event.quarantinedResultCount} linhas publicadas em quarentena por identificador conflitante. Preservadas para revisão; não adicionadas aos históricos.</p>}
    {event.possibleDuplicate && <p className="flag">Possível evento duplicado entre fontes. Não confirma participação adicional.</p>}
    <div className="provenance"><SourceLink url={event.sourceUrl}>Torneio na fonte</SourceLink><span>Obtido em {timestamp(event.lastSyncedAt)}</span></div>
    {!!event.otherSources?.length && <details className="other-sources"><summary>Resultados e detalhes complementares do site principal</summary><p className="small muted">Possível representação do mesmo evento. Resultados e listas exclusivos dessa fonte continuam no histórico conjunto. As contagens abaixo pertencem a cada fonte e não devem ser somadas como participações únicas.</p><ul>{event.otherSources.map(other=><TournamentCard key={other.id} event={other}/>)}</ul></details>}
  </li>;
}

export function Tournaments() {
  const [offset, setOffset] = useState(0);
  const [preferred,setPreferred]=useState(true);
  const query = useQuery(`${offset}:${preferred}`, signal => api.tournaments(offset, signal,preferred));
  return <section aria-labelledby="tournaments-title">
    <a className="back" href="#/">← Buscar jogadores</a>
    <p className="eyebrow">CATÁLOGO IMPORTADO</p>
    <h1 id="tournaments-title" tabIndex={-1}>Torneios disponíveis</h1>
    <p className="intro">Labs em destaque, com eventos exclusivos do site principal e detalhes complementares acessíveis. As contagens não representam eventos únicos confirmados.</p>
    <label className="compare-choice"><input type="checkbox" checked={!preferred} onChange={event=>{setPreferred(!event.target.checked);setOffset(0);}}/><span>Mostrar torneios separados por fonte</span></label>
    {query.status === 'loading' && <Loading>Carregando torneios…</Loading>}
    {query.status === 'error' && <Failure retry={query.retry} />}
    {query.data && <>
      <p role="status">{query.data.total} {query.data.presentation?'grupos de consulta':'registros'} · {query.data.total ? offset + 1 : 0}–{offset + query.data.events.length}</p>
      {query.data.presentation&&<p className="small muted">{query.data.presentation.sourceRecordCount} registros de fonte preservados · {query.data.presentation.groupedPairs} pares agrupados para consulta.</p>}
      <ul className="results">{query.data.events.map(event => <TournamentCard key={event.id} event={event}/>)}</ul>
      {!query.data.total && <p className="notice">Nenhum torneio importado.</p>}
      <nav className="pagination" aria-label="Páginas de torneios"><button disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Anterior</button><button disabled={!query.data.truncated} onClick={() => setOffset(value => value + 20)}>Próxima</button></nav>
    </>}
  </section>;
}
