import {writeFile} from 'node:fs/promises';
import {parseArgs,argumentError,withDatabase} from './cli-common.js';
try{
  const {values}=parseArgs({options:{output:{type:'string'}}});
  void withDatabase(async db=>{
    const rows=await db.tournament.findMany({orderBy:[{source:'asc'},{eventDate:'desc'},{externalId:'asc'},{division:'asc'}],select:{source:true,externalId:true,division:true,name:true,country:true,season:true,eventDate:true,format:true,resultsCoverage:true,reportedPlayerCount:true,reportedPlayerCountApproximate:true,fullySynchronized:true,sourceUrl:true,lastSyncedAt:true,raw:true,_count:{select:{entries:true}}}});
    const events=rows.map(({raw,...event})=>({...event,locationLabel:(raw as {eventLocationLabel?:string}|null)?.eventLocationLabel??null,quarantinedResultCount:Number((raw as {quarantinedResultCount?:number}|null)?.quarantinedResultCount??0)}));
    const report={capturedAt:new Date().toISOString(),tournamentDivisionRecords:events.length,
      bySource:[...new Set(events.map(event=>event.source))].map(source=>{const rows=events.filter(event=>event.source===source);return {source,tournamentDivisionRecords:rows.length,distinctSourceEvents:new Set(rows.map(row=>row.externalId)).size,results:rows.reduce((total,event)=>total+event._count.entries,0),unknownCoverageRecords:rows.filter(event=>event.resultsCoverage==='UNKNOWN').length};}),
      distinctSourceEvents:new Set(events.map(e=>JSON.stringify([e.source,e.externalId]))).size,
      results:await db.tournamentEntry.count(),players:await db.player.count(),importedDecklists:await db.deck.count({where:{listImportedAt:{not:null}}}),
      availableUnimportedDecklists:await db.deck.count({where:{availableAtSource:true,listImportedAt:null}}),
      cards:await db.deckCard.count(),possibleDuplicateEvents:await db.tournamentDuplicateCandidate.count(),possibleDuplicateResults:await db.resultDuplicateCandidate.count(),
      quarantinedSourceRows:events.reduce((total,event)=>total+event.quarantinedResultCount,0),
      unknownCoverageRecords:events.filter(event=>event.resultsCoverage==='UNKNOWN').length,
      reportedCountDifferences:events.filter(event=>event.reportedPlayerCount!==null&&event.reportedPlayerCount!==event._count.entries).length,
      labsReportedCountMismatches:events.filter(event=>event.source==='limitless-labs'&&event.reportedPlayerCount!==null&&event.reportedPlayerCount!==event._count.entries).length,
      countries:[...new Set(events.flatMap(e=>e.country?[e.country]:[]))].sort(),
      nonCountryLocationLabels:[...new Set(events.flatMap(event=>!event.country&&event.locationLabel?[event.locationLabel]:[]))].sort(),
      running:await db.syncRun.count({where:{status:'RUNNING'}}),events:events.map(({_count,...event})=>({...event,results:_count.entries}))};
    if(values.output)await writeFile(values.output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({...report,events:undefined},null,2));
  });
}catch(error){argumentError(error);}
