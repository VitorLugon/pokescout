import { IdentityReviewService, ScoutQueryService } from '../packages/application/src/index.js';
import { parseArgs, withDatabase, argumentError } from './cli-common.js';
try {
  const { values } = parseArgs({ options: { name: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' },
    decision: { type: 'string' }, reviewer: { type: 'string' }, reason: { type: 'string' }, evidence: { type: 'string', multiple: true } } });
  void withDatabase(async db => {
    const service = new IdentityReviewService(db);
    if (values.name) {
      if (values.a || values.b || values.decision) throw new Error('Use either --name or --a/--b');
      console.log(JSON.stringify(await new ScoutQueryService(db).searchPlayers(values.name), null, 2)); return;
    }
    if (!values.a || !values.b) throw new Error('Use --name <name> or --a <UUID> --b <UUID>');
    if (!values.decision) { console.log(JSON.stringify(await service.compare(values.a, values.b), null, 2)); return; }
    console.log(JSON.stringify(await service.record({ playerAId: values.a, playerBId: values.b,
      decision: values.decision as 'SAME_PERSON' | 'DIFFERENT_PEOPLE' | 'UNCERTAIN', reviewer: values.reviewer ?? '',
      reason: values.reason ?? '', evidenceUrls: values.evidence ?? [] }), null, 2));
  });
} catch (error) { argumentError(error); }
