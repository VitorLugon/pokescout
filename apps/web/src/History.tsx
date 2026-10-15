import { useState } from 'react';
import { api, ApiError } from './api';
import { useQuery } from './use-query';
import { Failure, Loading } from './components';
import { ResultCard } from './ResultCard';
import { RelatedHistories } from './RelatedHistories';
import { sourceName } from './presentation';

export function History({ playerId, hidden }: { playerId: string; hidden: boolean }) {
  const [offset, setOffset] = useState(0);
  const [combined, setCombined] = useState(true);
  const query = useQuery(`${playerId}:${offset}:${combined}`, signal => api.history(playerId, offset, signal, combined));
  const history = query.data;
  const combination = history?.combination;
  function page(next: number) { setOffset(next); window.scrollTo({ top: 0 }); document.getElementById('history-title')?.focus(); }
  return <section hidden={hidden} aria-labelledby="history-title">
    <a className="back" href="#/">← Voltar à busca</a>
    <p className="eyebrow">02 / HISTÓRICO DA IDENTIDADE</p>
    <h1 id="history-title" tabIndex={-1}>{history?.player.displayName ?? 'Histórico competitivo'}</h1>
    <p className="intro">{combination && combination.members.length > 1 ? 'Histórico conjunto de Labs e Limitless, organizado por data e com as fontes preservadas.' : 'Resultados desta identidade de fonte. Históricos de outros candidatos permanecem separados.'}</p>
    <label className="compare-choice"><input type="checkbox" checked={combined} onChange={event => { setCombined(event.target.checked); setOffset(0); }} /><span>Reunir nomes iguais no Labs e Limitless</span></label>
    <a className="button primary" href={`#/player/${playerId}/scouting`}>Arquétipos publicados e filtros →</a>
    <div aria-live="polite" aria-busy={query.status === 'loading'}>
      {query.status === 'loading' && <Loading>Carregando histórico…</Loading>}
      {query.status === 'error' && <Failure retry={query.retry}>{query.error instanceof ApiError && query.error.status === 404 ? 'Identidade não encontrada nesta base.' : undefined}</Failure>}
      {history && <>
        {combination && combination.members.length > 1 ? <aside className="notice" aria-label="Histórico conjunto por nome">
          <h2>Fontes reunidas por nome</h2><p className="small">O nome igual não confirma identidade: este conjunto pode incluir homônimos. Os registros originais permanecem separados no banco.</p>
          <details><summary>Ver identidades e fontes reunidas</summary><ul>{combination.members.map(member => <li key={member.playerId} className="small">{member.displayName} · {member.identities.map(identity => `${sourceName(identity.source)} · ID ${identity.externalId} · ${identity.scope}`).join(' / ')}</li>)}</ul></details>
          <p className="small">O resumo de arquétipos e seus filtros continuam usando somente a identidade selecionada.</p>
        </aside> : <RelatedHistories playerId={playerId} name={history.player.displayName} hidden={hidden} />}
        {!!combination?.excludedByReview && <p className="flag">Há identidades excluídas do conjunto por avaliações de pessoas diferentes.</p>}
        {(combination?.candidatesLimited || combination?.resultsLimited) && <p className="flag">Conjunto limitado: até 100 candidatos de nome e 5.000 resultados. Outros registros podem estar fora deste recorte.</p>}
        <p className="count"><strong>{history.total}</strong> {combination ? 'grupos de resultados históricos' : history.total === 1 ? 'resultado publicado de fonte' : 'resultados publicados de fonte'} <span>Não equivalem a participações únicas confirmadas.</span>{combination && <span>{combination.sourceResultCount} registros de fonte · {combination.groupedPairs} {combination.groupedPairs === 1 ? 'par de possível duplicação agrupado' : 'pares de possível duplicação agrupados'} para consulta.</span>}</p>
        {history.entries.length > 0 && <p className="small muted">Exibindo {offset + 1}–{offset + history.entries.length} de {history.total} resultados {combination ? 'do conjunto' : 'desta identidade'}, dos mais recentes aos mais antigos com data conhecida.</p>}
        {!history.entries.length && <p className="notice">Nenhum resultado nesta página.</p>}
        <ul className="results">{history.entries.map(entry => <ResultCard key={entry.id} entry={entry} playerId={playerId} />)}</ul>
        <nav aria-label="Páginas do histórico" className="pagination">
          <button disabled={offset === 0} onClick={() => page(Math.max(0, offset - history.limit))}>← Anterior</button>
          <span>Página {Math.floor(offset / history.limit) + 1}</span>
          <button disabled={!history.truncated} onClick={() => page(offset + history.limit)}>Próxima →</button>
        </nav>
      </>}
    </div>
  </section>;
}

