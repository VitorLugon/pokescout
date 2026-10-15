import { Prisma, type PrismaClient } from '@tcg-scout/database';
import type { TournamentCatalogResponse } from '@tcg-scout/shared';
import { groupSourceResults } from './history-groups.js';

const select = {
  id:true,name:true,source:true,externalId:true,division:true,country:true,dateLabel:true,eventDate:true,format:true,
  resultsCoverage:true,reportedPlayerCount:true,reportedPlayerCountApproximate:true,fullySynchronized:true,sourceUrl:true,lastSyncedAt:true,raw:true,
  _count:{select:{entries:true,duplicateEventsAsA:true,duplicateEventsAsB:true}},
} satisfies Prisma.TournamentSelect;
type Row = Prisma.TournamentGetPayload<{select:typeof select}>;
function project({ _count, raw, ...row }: Row): TournamentCatalogResponse['events'][number] {
  return { ...row, lastSyncedAt:row.lastSyncedAt.toISOString(),
    locationLabel:(raw as {eventLocationLabel?:string}|null)?.eventLocationLabel ?? null,
    entriesCount:_count.entries,quarantinedResultCount:Number((raw as {quarantinedResultCount?:number}|null)?.quarantinedResultCount ?? 0),
    possibleDuplicate:_count.duplicateEventsAsA + _count.duplicateEventsAsB > 0 };
}

export async function tournamentCatalog(db: PrismaClient, limit=20, offset=0, preferred=false): Promise<TournamentCatalogResponse> {
  if (!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000) throw new Error('Invalid tournament pagination');
  return db.$transaction(async tx => {
    const sourceRecordCount=await tx.tournament.count();
    const rows=await tx.tournament.findMany({select,orderBy:[{eventDate:{sort:'desc',nulls:'last'}},{id:'asc'}],...(preferred?{}:{take:limit,skip:offset})});
    if (!preferred) return {total:sourceRecordCount,limit,offset,truncated:offset+rows.length<sourceRecordCount,events:rows.map(project)};
    // An event-name match alone is insufficient. Require at least one existing
    // result candidate, and only fold unambiguous one-to-one event pairs.
    const pairs=await tx.tournamentDuplicateCandidate.findMany({where:{results:{some:{}}},select:{tournamentAId:true,tournamentBId:true}});
    const byId=new Map(rows.map(row=>[row.id,row]));
    const eligible=pairs.filter(pair=>{
      const sources=[byId.get(pair.tournamentAId)?.source,byId.get(pair.tournamentBId)?.source];
      return sources.includes('limitless-labs')&&sources.includes('limitless-main');
    });
    const groups=groupSourceResults(rows.map(row=>({...row,tournament:{source:row.source}})),eligible.map(pair=>({entryAId:pair.tournamentAId,entryBId:pair.tournamentBId})));
    return {total:groups.length,limit,offset,truncated:offset+limit<groups.length,
      presentation:{policy:'labs-first',sourceRecordCount,groupedPairs:rows.length-groups.length},
      events:groups.slice(offset,offset+limit).map(group=>({...project(byId.get(group.primary.id)!),otherSources:group.otherSources.map(other=>project(byId.get(other.id)!))}))};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
