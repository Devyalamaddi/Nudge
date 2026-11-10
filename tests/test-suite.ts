import assert from 'assert';
import {getCurrentTemporalAnchor,resolveRelativeDates} from '../src/lib/temporal';
import {getAllSessions,searchCrossSessionMemory,resetToBenchmarks} from '../src/lib/memory/storage';
import {WEB_SEARCH_TOOL_DEFINITION} from '../src/lib/search/search-tool';
import {runAgentTurn} from '../src/lib/agent/orchestrator';

async function runAllTests() {
  const refDate=new Date('2026-11-10T12:00:00Z');
  const anchor=getCurrentTemporalAnchor(refDate);
  assert.strictEqual(anchor.dayOfWeek,'Tuesday');
  assert.strictEqual(anchor.year,2026);
  assert.strictEqual(anchor.monthName,'November');

  const mondayRes=resolveRelativeDates('On Monday we shortlisted 5 CRM tools',refDate);
  assert.ok(mondayRes.length>0);
  assert.strictEqual(mondayRes[0].resolvedDateStr,'2026-11-09');
  assert.strictEqual(mondayRes[0].daysAgo,1);

  const lastTuesdayRes=resolveRelativeDates('Last Tuesday I asked you about Postgres',refDate);
  assert.ok(lastTuesdayRes.length>0);
  assert.strictEqual(lastTuesdayRes[0].resolvedDateStr,'2026-11-03');
  assert.strictEqual(lastTuesdayRes[0].daysAgo,7);

  const nov3Res=resolveRelativeDates('What did I ask you on 3 November?',refDate);
  assert.ok(nov3Res.length>0);
  assert.strictEqual(nov3Res[0].resolvedDateStr,'2026-11-03');

  resetToBenchmarks(refDate);
  const sessions=getAllSessions();
  assert.ok(sessions.length>=3);
  
  const crmRecall=searchCrossSessionMemory(
    'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing?',
    undefined,
    refDate
  );
  assert.ok(crmRecall!==null);
  assert.ok(crmRecall.historicalContextSummary.includes('HubSpot'));
  assert.ok(crmRecall.historicalContextSummary.includes('Pipedrive'));

  const nov3Recall=searchCrossSessionMemory(
    'What did I ask you on 3 November? Is your answer still correct today?',
    undefined,
    refDate
  );
  assert.ok(nov3Recall!==null);
  assert.ok(nov3Recall.historicalContextSummary.includes('Neon')||nov3Recall.historicalContextSummary.includes('Postgres'));

  assert.strictEqual(WEB_SEARCH_TOOL_DEFINITION.function.name,'web_search');
  assert.strictEqual(WEB_SEARCH_TOOL_DEFINITION.type,'function');

  let tokenCount=0;
  const resultMessage=await runAgentTurn({
    userQuery:'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    referenceDate:refDate,
    onEvent:(event)=>{
      if (event.type==='token') tokenCount++;
    },
  });

  assert.ok(resultMessage.content.length>0);
  assert.ok(resultMessage.content.includes('HubSpot')||resultMessage.content.includes('Pipedrive'));
  assert.ok(tokenCount>0);
  console.log('PASS');
}

runAllTests().catch((err)=>{
  console.error(err);
  process.exit(1);
});
