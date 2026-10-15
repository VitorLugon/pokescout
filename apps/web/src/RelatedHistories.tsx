import { nameSearchKey } from '@tcg-scout/shared';
import { api } from './api';
import { useQuery } from './use-query';
import { sourceName } from './presentation';

export function RelatedHistories({ playerId, name, hidden }: { playerId: string; name: string; hidden: boolean }) {
  const key = nameSearchKey(name);
  const query = useQuery(key, signal => api.search(key, signal), 350, !hidden && key.length >= 2);
  const candidates = (query.data?.matches ?? []).filter(player => player.id !== playerId && player.aliases.some(alias => nameSearchKey(alias) === key));
  if (query.status === 'error') return <p className="small muted">Não foi possível procurar outros históricos. <button onClick={query.retry}>Tentar novamente</button></p>;
  if (!candidates.length) return null;
  return <aside className="notice related-histories" aria-label="Outros históricos encontrados">
    <h2>Outros históricos com este nome</h2>
    <p className="small">Outra fonte ou identificador pode conter resultados diferentes. Nomes iguais são candidatos para comparação; os históricos permanecem separados.</p>
    <ul>{candidates.slice(0, 5).map(player => <li key={player.id}>
      <p className="small"><strong>{player.displayName}</strong> · {player.identities.map(identity => `${sourceName(identity.source)} · ID ${identity.externalId} · ${identity.scope}`).join(' / ')}</p>
      <div className="evidence-actions"><a className="button" href={`#/player/${player.id}`}>Ver outro histórico →</a><a className="button" href={`#/compare/${playerId}/${player.id}`}>Comparar identidades →</a></div>
    </li>)}</ul>
    {(query.data?.truncated || candidates.length > 5) && <p className="small">Seleção limitada. Volte à busca para consultar outros candidatos.</p>}
  </aside>;
}
