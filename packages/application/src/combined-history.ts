import { Prisma, type PrismaClient } from '@tcg-scout/database';
import { nameSearchKey, type HistoricalEntry, type PlayerHistoryResponse } from '@tcg-scout/shared';
import { eventEvidenceSelect } from './evidence.js';
import { QueryNotFoundError } from './errors.js';
import { historyNameKey, groupSourceResults } from './history-groups.js';

const sources = ['limitless-labs', 'limitless-main'];
const pairs = { select: { id: true, entryAId: true, entryBId: true } };
const entrySelect = {
  id:true, originalName:true, country:true, placement:true, wins:true, losses:true, ties:true, disqualified:true,
  sourceUrl:true, lastSyncedAt:true, duplicateResultsAsA:pairs, duplicateResultsAsB:pairs,
  tournament:{select:{...eventEvidenceSelect, eventDate:true, duplicateEventsAsA:{select:{id:true}},duplicateEventsAsB:{select:{id:true}}}},
  deck:{select:{id:true,source:true,sourceUrl:true,archetypeName:true,availableAtSource:true,listStatus:true,listImportedAt:true,lastSyncedAt:true,
    cards:{orderBy:{position:'asc' as const},select:{id:true,category:true,quantity:true,name:true,setCode:true,collectorNumber:true,language:true}}}},
} satisfies Prisma.TournamentEntrySelect;
type Row = Prisma.TournamentEntryGetPayload<{select:typeof entrySelect}>;
function project(row: Row): HistoricalEntry {
  return {...row, lastSyncedAt:row.lastSyncedAt.toISOString(),
    duplicateResultsAsA:row.duplicateResultsAsA.map(({id})=>({id})),duplicateResultsAsB:row.duplicateResultsAsB.map(({id})=>({id})),
    tournament:{...row.tournament,lastSyncedAt:row.tournament.lastSyncedAt.toISOString()},
    deck:row.deck?{...row.deck,lastSyncedAt:row.deck.lastSyncedAt.toISOString(),listImportedAt:row.deck.listImportedAt?.toISOString()??null}:null};
}

export async function combinedHistory(db: PrismaClient, playerId: string, limit=100, offset=0): Promise<PlayerHistoryResponse> {
  if (!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000) throw new Error('Invalid history pagination');
  return db.$transaction(async tx => {
    const player = await tx.player.findUnique({where:{id:playerId},select:{id:true,displayName:true,identities:true}});
    if (!player) throw new QueryNotFoundError('Player not found');
    const ownSources = player.identities.map(identity=>identity.source);
    const supported = ownSources.some(source=>sources.includes(source));
    const candidates = supported ? await tx.player.findMany({
      where:{id:{not:playerId},aliases:{some:{searchKey:nameSearchKey(player.displayName)}},identities:{some:{source:{in:sources.filter(source=>!ownSources.includes(source))}}}},
      select:{id:true,displayName:true,aliases:{select:{originalName:true}},identities:true},orderBy:{id:'asc'},take:101,
    }) : [];
    const exact = candidates.slice(0,100).filter(candidate=>historyNameKey(candidate.displayName)===historyNameKey(player.displayName));
    const different = exact.length ? await tx.identityReview.findMany({where:{decision:'DIFFERENT_PEOPLE',OR:[{playerAId:playerId,playerBId:{in:exact.map(p=>p.id)}},{playerBId:playerId,playerAId:{in:exact.map(p=>p.id)}}]},select:{playerAId:true,playerBId:true}}) : [];
    const excluded = new Set(different.map(review=>review.playerAId===playerId?review.playerBId:review.playerAId));
    const members = [player,...exact.filter(candidate=>!excluded.has(candidate.id))];
    const where = {playerId:{in:members.map(member=>member.id)}};
    const rows = await tx.tournamentEntry.findMany({where,select:entrySelect,take:5001,orderBy:[{tournament:{eventDate:{sort:'desc',nulls:'last'}}},{id:'asc'}]});
    const sourceResultCount = await tx.tournamentEntry.count({where});
    const visible = rows.slice(0,5000);
    const groups = groupSourceResults(visible,visible.flatMap(row=>[...row.duplicateResultsAsA,...row.duplicateResultsAsB]));
    return {player:{id:player.id,displayName:player.displayName},entries:groups.slice(offset,offset+limit).map(group=>({...project(group.primary),otherSources:group.otherSources.map(project)})),
      total:groups.length,totalMeaning:'candidate-result-groups',confirmedParticipationCount:null,limit,offset,truncated:offset+limit<groups.length,
      combination:{basis:'same-name',confirmedSamePerson:false,sourceResultCount,groupedPairs:visible.length-groups.length,candidatesLimited:candidates.length>100,resultsLimited:rows.length>5000,excludedByReview:excluded.size,
        members:members.map(member=>({playerId:member.id,displayName:member.displayName,identities:member.identities.map(({source,scope,externalId})=>({source,scope,externalId}))}))}};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
