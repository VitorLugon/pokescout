// Rebuild from the explicitly downloaded public metadata; no network at build/runtime.
const fs = require('node:fs');
const dex = JSON.parse(fs.readFileSync('.research/catalog/pokedex.json', 'utf8'));
const aliases = new Map();
const key = name => name.normalize('NFKC').toLowerCase().replaceAll('♀','female').replaceAll('♂','male').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
for (const [slug, pokemon] of Object.entries(dex)) {
  if (pokemon.num > 0 && pokemon.num <= 1025 && !pokemon.baseSpecies) {
    aliases.set(key(pokemon.name), pokemon.num); aliases.set(key(slug), pokemon.num);
  }
}
for (const line of fs.readFileSync('.research/catalog/species-names.csv','utf8').split(/\r?\n/).slice(1)) {
  // The first three fields are IDs and an unquoted species name; genus may contain CSV commas.
  const match = /^(\d+),(\d+),([^,"]+),/.exec(line);
  if (match && Number(match[1]) <= 1025) aliases.set(key(match[3]), Number(match[1]));
}
fs.writeFileSync('apps/web/src/pokemon-sprite-map.json', JSON.stringify(Object.fromEntries([...aliases].sort()),null,2)+'\n');
