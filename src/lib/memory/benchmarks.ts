import {Session,Message,EpisodicMemoryRecord} from '@/types/memory';
import {getCurrentTemporalAnchor,resolveRelativeDates} from '../temporal';

export interface BenchmarkDefinition {
  session:Session;
  messages:Message[];
  episodicRecord:EpisodicMemoryRecord;
}

export function generateBenchmarkScenarios(ref:Date=new Date()):BenchmarkDefinition[] {
  const anchor=getCurrentTemporalAnchor(ref);

  const resolvedMonday=resolveRelativeDates('Monday',ref)[0];
  const mondayDateStr=resolvedMonday?resolvedMonday.resolvedDateStr:'2026-11-09';
  const mondayIso=`${mondayDateStr}T14:30:00.000Z`;
  const mondaySessionId='benchmark-crm-monday';

  const mondayBenchmark:BenchmarkDefinition={
    session:{
      id:mondaySessionId,
      title:'Shortlist 5 CRM tools for 20-person sales team',
      createdAt:mondayIso,
      updatedAt:mondayIso,
      isBenchmark:true,
      benchmarkId:'crm-monday',
      summary:'Shortlisted HubSpot, Pipedrive, Close, Zoho CRM, and Folk for a 20-person B2B sales team.',
    },
    messages:[
      {
        id:'msg-crm-1',
        sessionId:mondaySessionId,
        role:'user',
        content:'Can you shortlist 5 CRM tools for our 20-person sales team? We care about pipeline management, automated email sequences, and transparent per-user pricing.',
        createdAt:mondayIso,
        simulatedDate:mondayDateStr,
      },
      {
        id:'msg-crm-2',
        sessionId:mondaySessionId,
        role:'assistant',
        content:`Here is our shortlist of **5 CRM tools** tailored for a 20-person B2B sales team:

1. **HubSpot Sales Hub**
   - **Target Plan:** Professional (\$90 - \$100/seat/month billed annually).
   - **Cost for 20 seats:** ~\$1,800 - \$2,000/month.

2. **Pipedrive**
   - **Target Plan:** Professional (\$49/seat/month billed annually) or Advanced (\$24/seat/month).
   - **Cost for 20 seats (Professional):** ~\$980/month.

3. **Close CRM**
   - **Target Plan:** Professional (\$99/user/month) or Startup (\$49/user/month).
   - **Cost for 20 seats (Professional):** ~\$1,980/month.

4. **Zoho CRM**
   - **Target Plan:** Professional (\$23/user/month billed annually).
   - **Cost for 20 seats (Professional):** ~\$460/month.

5. **Folk CRM**
   - **Target Plan:** Premium (\$29/member/month) or Standard (\$18/member/month).
   - **Cost for 20 seats (Premium):** ~\$580/month.`,
        createdAt:`${mondayDateStr}T14:32:00.000Z`,
        simulatedDate:mondayDateStr,
      },
    ],
    episodicRecord:{
      id:'ep-crm-monday',
      sessionId:mondaySessionId,
      dateStr:mondayDateStr,
      dayOfWeek:'Monday',
      summary:'Shortlisted 5 CRM tools for a 20-person sales team: HubSpot, Pipedrive, Close, Zoho CRM, and Folk CRM.',
      entities:['HubSpot Sales Hub','Pipedrive','Close CRM','Zoho CRM','Folk CRM'],
      keyFacts:[
        'HubSpot Professional: ~$90-100/seat/mo',
        'Pipedrive Professional: ~$49/seat/mo',
        'Close Professional: ~$99/user/mo',
        'Zoho CRM Professional: ~$23/user/mo',
        'Folk Premium: ~$29/member/mo',
      ],
    },
  };

  const nov3Year=anchor.year;
  const nov3DateStr=`${nov3Year}-11-03`;
  const nov3Iso=`${nov3DateStr}T10:15:00.000Z`;
  const nov3SessionId='benchmark-postgres-nov3';

  const nov3Benchmark:BenchmarkDefinition={
    session:{
      id:nov3SessionId,
      title:'Serverless Postgres Recommendations (3 November)',
      createdAt:nov3Iso,
      updatedAt:nov3Iso,
      isBenchmark:true,
      benchmarkId:'postgres-nov3',
      summary:'Comparison of serverless Postgres options: Neon, Supabase, AWS Aurora Serverless v2, and Tembo.',
    },
    messages:[
      {
        id:'msg-nov3-1',
        sessionId:nov3SessionId,
        role:'user',
        content:'What are the best serverless Postgres hosting providers right now for an early-stage SaaS, and what are their current starter/pro pricing tiers?',
        createdAt:nov3Iso,
        simulatedDate:nov3DateStr,
      },
      {
        id:'msg-nov3-2',
        sessionId:nov3SessionId,
        role:'assistant',
        content:`As of **November 3**, here is the breakdown of top serverless Postgres options:

1. **Neon:** Launch Plan is \$19/month (includes 10 GB storage, database branching).
2. **Supabase:** Pro Plan is \$25/month (8 GB included database disk, Auth, Realtime).
3. **AWS Aurora Serverless v2:** Billed per ACU at ~\$0.12 per ACU-hour. Minimum 0.5 ACU baseline (~$43/month).
4. **Tembo:** Starting at \$10 - \$45/month with specialized Postgres stacks.`,
        createdAt:`${nov3DateStr}T10:18:00.000Z`,
        simulatedDate:nov3DateStr,
      },
    ],
    episodicRecord:{
      id:'ep-postgres-nov3',
      sessionId:nov3SessionId,
      dateStr:nov3DateStr,
      dayOfWeek:'Tuesday',
      summary:'User asked about serverless Postgres hosting for early-stage SaaS. Recommended Neon ($19 Launch), Supabase ($25 Pro), AWS Aurora v2, and Tembo.',
      entities:['Neon','Supabase','AWS Aurora Serverless v2','Tembo'],
      keyFacts:[
        'Neon Launch tier: $19/mo (10 GB storage, branching)',
        'Supabase Pro tier: $25/mo (8 GB database, Auth, Realtime)',
        'Aurora v2: ~$0.12/ACU-hr (~$43/mo min at 0.5 ACU)',
      ],
    },
  };

  const resolvedLastTuesday=resolveRelativeDates('last Tuesday',ref)[0];
  const lastTuesdayDateStr=resolvedLastTuesday?resolvedLastTuesday.resolvedDateStr:nov3DateStr;
  const lastTuesdayIso=`${lastTuesdayDateStr}T16:00:00.000Z`;
  const lastTuesdaySessionId='benchmark-postgres-tuesday';

  const lastTuesdayBenchmark:BenchmarkDefinition={
    session:{
      id:lastTuesdaySessionId,
      title:'Postgres Hosting Pricing & Cold Starts (Last Tuesday)',
      createdAt:lastTuesdayIso,
      updatedAt:lastTuesdayIso,
      isBenchmark:true,
      benchmarkId:'postgres-tuesday',
      summary:'Postgres hosting comparison focusing on Neon, Supabase, and Render pricing and performance.',
    },
    messages:[
      {
        id:'msg-tues-1',
        sessionId:lastTuesdaySessionId,
        role:'user',
        content:'What are the pricing models and cold starts for Postgres hosting providers like Neon, Supabase, and Render?',
        createdAt:lastTuesdayIso,
        simulatedDate:lastTuesdayDateStr,
      },
      {
        id:'msg-tues-2',
        sessionId:lastTuesdaySessionId,
        role:'assistant',
        content:`Here is the Postgres hosting comparison from **Last Tuesday (${lastTuesdayDateStr})**:

- **Neon:** Launch plan is \$19/month with 10 GB storage and branching.
- **Supabase:** Pro plan is \$25/month with 8 GB database storage.
- **Render:** Starter tier is \$7/month, Standard is \$20/month.`,
        createdAt:`${lastTuesdayIso}`,
        simulatedDate:lastTuesdayDateStr,
      },
    ],
    episodicRecord:{
      id:'ep-postgres-tuesday',
      sessionId:lastTuesdaySessionId,
      dateStr:lastTuesdayDateStr,
      dayOfWeek:'Tuesday',
      summary:'Discussed Postgres hosting pricing and cold starts for Neon ($19/mo), Supabase ($25/mo), and Render ($7/mo starter).',
      entities:['Neon','Supabase','Render'],
      keyFacts:[
        'Neon Launch: $19/mo',
        'Supabase Pro: $25/mo',
        'Render Postgres Starter: $7/mo, Standard: $20/mo',
      ],
    },
  };

  return [mondayBenchmark,nov3Benchmark,lastTuesdayBenchmark];
}
