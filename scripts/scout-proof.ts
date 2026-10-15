import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LimitlessLabsSource } from '../packages/data-sources/src/index.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--live')) {
    throw new Error('Usage: pnpm scout:proof [--live https://labs.limitlesstcg.com/<id>/standings]');
  }
  const fixtureDir = resolve('packages/data-sources/test/fixtures');
  const manifest = JSON.parse(await readFile(resolve(fixtureDir, 'manifest.json'), 'utf8')) as {
    sourceUrl: string; decklistUrl: string; retrievedAt: string; captures: { sourceUrl: string; retrievedAt: string }[];
  };
  const live = args[0] === '--live';
  const source = live ? new LimitlessLabsSource() : new LimitlessLabsSource(async url => ({
    html: await readFile(resolve(fixtureDir, url === manifest.sourceUrl ? 'standings.html' : url === manifest.decklistUrl ? 'decklist.html' : 'missing-fixture'), 'utf8'),
    sourceUrl: url, lastSyncedAt: manifest.captures.find(capture => capture.sourceUrl === url)!.retrievedAt,
  }));
  const snapshot = await source.loadTournament(live ? args[1] : manifest.sourceUrl);
  console.log(`Mode: ${live ? 'LIVE public HTTP' : 'OFFLINE sanitized fixture sample'}`);
  console.log(`Source: ${snapshot.tournament.reference.sourceUrl}`);
  console.log(`Retrieved: ${snapshot.tournament.reference.lastSyncedAt}`);
  console.log(`\nTournament:\n${snapshot.tournament.name}`);
  console.log(`Division: ${snapshot.tournament.division}; reported players: ${snapshot.tournament.reportedPlayerCount}; parsed entries: ${snapshot.entries.length}`);
  console.log('\nPlayers:');
  const entries = snapshot.entries.filter(entry => entry.placement !== null).sort((a, b) => a.placement! - b.placement!).slice(0, 4);
  for (const [index, entry] of entries.entries()) {
    const { wins, losses, ties } = entry.record;
    console.log(`${index + 1}. ${entry.player.originalName}\n   Country: ${entry.country ?? 'Unknown'}\n   Placement: ${entry.placement}\n   Record: ${wins}-${losses}-${ties}\n   Deck: ${entry.deck?.archetype?.name ?? 'Unknown'}`);
  }
  // Prove one list only; never fetch every player's list.
  const entry = entries.find(row => row.deck?.decklistUrl);
  if (entry?.deck?.decklistUrl) {
    const list = await source.loadDecklist(entry.deck.decklistUrl, snapshot.tournament.reference.externalId, entry.tournamentPlayerId.padStart(4, '0'));
    console.log(`\nPublic historical decklist for ${entry.player.originalName}: ${list.cards.reduce((sum, card) => sum + card.count, 0)} cards (${list.cards.length} distinct rows)`);
    for (const card of list.cards.slice(0, 3)) console.log(`   ${card.count} ${card.name} (${card.set} ${card.number})`);
    console.log(`   Source: ${list.reference.sourceUrl}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
