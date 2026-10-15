import { useState } from 'react';
import { nameSearchKey, type PlayerCandidate } from '@tcg-scout/shared';
import { api } from './api';
import { useQuery } from './use-query';
import { sourceName, unknown } from './presentation';
import { Failure, Loading } from './components';

export function Search({ hidden }: { hidden: boolean }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PlayerCandidate[]>([]);
  const [preferred,setPreferred]=useState(true);
  function toggle(player: PlayerCandidate) {
    setSelected(current => current.some(item => item.id === player.id) ? current.filter(item => item.id !== player.id) : current.length < 2 ? [...current, player] : current);
  }
  const key = nameSearchKey(name);
  const query = useQuery(`${key}:${preferred}`, signal => api.search(key, signal,preferred), 350, key.length >= 2);
  return <section hidden={hidden} aria-labelledby="search-title">
    <p className="eyebrow">01 / ENCONTRE UMA IDENTIDADE</p>
    <h1 id="search-title" tabIndex={-1}>Quem você vai<br />enfrentar?</h1>
    <p className="intro">Consulte resultados públicos e decks históricos antes da próxima rodada.</p>
    <form role="search" onSubmit={event => event.preventDefault()}>
      <label htmlFor="player-name">Nome do jogador</label>
      <div className="search-field"><span aria-hidden="true">⌕</span><input id="player-name" type="search" value={name} maxLength={200} autoComplete="off" placeholder="Digite um nome…" aria-describedby="search-help" onChange={event => setName(event.target.value)} /></div>
      <p id="search-help" className="muted small">Use pelo menos 2 caracteres. A busca ignora acentos e diferenças de pontuação.</p>
    </form>
    <label className="compare-choice"><input type="checkbox" checked={!preferred} onChange={event=>setPreferred(!event.target.checked)} /><span>Mostrar identidades separadas por fonte</span></label>
    <aside className="selection" aria-label="Candidatos para comparação">
      <h2>Comparar identidades <span className="small">{selected.length}/2</span></h2>
      <p className="small muted">Selecione exatamente dois candidatos. Você pode buscar outro nome sem perder a seleção.</p>
      <ul>{selected.map(player => <li key={player.id}><div><strong>{player.displayName}</strong><span className="small muted">{player.identities.map(identity => `${sourceName(identity.source)} · ID ${identity.externalId}`).join(' / ')}</span></div><button type="button" onClick={() => toggle(player)} aria-label={`Remover ${player.displayName}, ID ${player.identities.map(i => i.externalId).join(', ')}`}>Remover</button></li>)}</ul>
      <button type="button" className="primary" disabled={selected.length !== 2} onClick={() => { window.location.hash = `/compare/${selected[0].id}/${selected[1].id}`; }}>Comparar selecionados</button>
    </aside>
    {key.length < 2 ? <div className="empty"><span aria-hidden="true">◎</span><h2>O histórico começa pelo nome.</h2><p>Escolha a identidade com cuidado: nomes iguais podem pertencer a pessoas diferentes.</p></div> : <div aria-live="polite" aria-busy={query.status === 'loading'}>
      {query.status === 'loading' && <Loading>Buscando jogadores…</Loading>}
      {query.status === 'error' && <Failure retry={query.retry} />}
      {query.status === 'success' && query.data && <>
        <div className="section-heading"><h2>{query.data.presentation?'Históricos encontrados':'Identidades encontradas'}</h2><span>{query.data.matches.length}{query.data.truncated ? '+' : ''}</span></div>
        <p className="muted small">{query.data.presentation?'Labs em destaque, com correspondências do site principal nos detalhes. Nomes iguais não confirmam identidade.':'Cada candidato permanece separado.'} Países abaixo são os informados nos resultados recentes disponíveis, não nacionalidade confirmada.</p>
        {!query.data.matches.length && <p className="notice">Nenhum jogador encontrado. Tente outra parte do nome. A base histórica tem cobertura limitada.</p>}
        <ul className="candidates">{query.data.matches.map(player => <li key={player.id} className="card candidate">
          <h3>{player.displayName}</h3>
          <p className="small">Países informados: <strong>{player.countries.join(' · ') || unknown}</strong></p>
          <p className="muted small">Aliases: {player.aliases.join(' · ') || unknown}</p>
          <ul className="identities">{player.identities.map(identity => <li key={`${identity.source}:${identity.scope}:${identity.externalId}`}><strong>{sourceName(identity.source)}</strong><span>ID {identity.externalId} · escopo {identity.scope}</span></li>)}</ul>
          {player.possibleMatchIds.length > 0 && <p className="flag">Há outro candidato com nome semelhante. Compare as fontes antes de escolher.</p>}
          <label className="compare-choice"><input type="checkbox" checked={selected.some(item => item.id === player.id)} disabled={selected.length === 2 && !selected.some(item => item.id === player.id)} onChange={() => toggle(player)} /><span>Selecionar para comparar<span className="sr-only">: {player.displayName}, ID {player.identities.map(i => i.externalId).join(', ')}</span></span></label>
          <a className="button primary" href={`#/player/${encodeURIComponent(player.id)}`} aria-label={`Consultar histórico de ${player.displayName}, ${player.identities.map(i => `${i.source} ID ${i.externalId}`).join(', ')}`}>Consultar histórico <span aria-hidden="true">→</span></a>
          {!!player.alternativeMatches?.length && <details className="other-sources"><summary>Consultar nome correspondente no site principal</summary><p className="small muted">Correspondência por nome para consulta, sem fusão de identidades.</p><ul>{player.alternativeMatches.map(other=><li key={other.id}>
            <p><strong>{other.displayName}</strong></p><p className="small">{other.identities.map(identity=>`${sourceName(identity.source)} · ID ${identity.externalId} · ${identity.scope}`).join(' / ')}</p>
            <p className="small">Países informados: {other.countries.join(' · ')||unknown}</p>
            <label className="compare-choice"><input type="checkbox" checked={selected.some(item=>item.id===other.id)} disabled={selected.length===2&&!selected.some(item=>item.id===other.id)} onChange={()=>toggle(other)}/><span>Selecionar para comparar<span className="sr-only">: {other.displayName}, ID {other.identities.map(identity=>identity.externalId).join(', ')}</span></span></label>
            <a className="button" href={`#/player/${other.id}`} aria-label={`Consultar histórico de ${other.displayName}, ${other.identities.map(identity=>`${identity.source} ID ${identity.externalId}`).join(', ')}`}>Histórico da outra fonte →</a>
          </li>)}</ul></details>}
        </li>)}</ul>
        {query.data.truncated && <p className="notice">Exibindo até 30 candidatos. Refine o nome para encontrar outros resultados.</p>}
      </>}
    </div>}
  </section>;
}
