import aliases from './pokemon-sprite-map.json' with { type: 'json' };

const dictionary: Record<string, number> = aliases;
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replaceAll('♀','female').replaceAll('♂','male').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/(?<=[^\x00-\x7F])(?:ex|vstar|vmax|v)(?=$|[^\p{L}\p{N}])/giu, ' ');
// Decoration only: these aliases never participate in player/deck identity resolution.
export function pokemonSpriteNumbers(label: string): number[] {
  const words = normalize(label).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const matches: number[] = [];
  for (let index = 0; index < words.length; index++) {
    let found: number | undefined;
    for (let length = Math.min(4, words.length - index); length > 0; length--) {
      const key = words.slice(index, index + length).join('');
      found = Object.hasOwn(dictionary,key) ? dictionary[key] : undefined;
      if (found) { index += length - 1; break; }
    }
    if (found && !matches.includes(found)) matches.push(found);
  }
  return matches.slice(0, 2);
}
export function PokemonSprites({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return <span className="pokemon-sprites" aria-hidden="true">{pokemonSpriteNumbers(name).map(number => <span key={number} className="pokemon-sprite" style={{ backgroundPosition: `${-(number % 12) * 40}px ${-Math.floor(number / 12) * 30}px` }} />)}</span>;
}
