import readline from 'readline';
import {runAgentTurn} from '../lib/agent/orchestrator';
import {getCurrentTemporalAnchor} from '../lib/temporal';
import {getAllSessions,createSession} from '../lib/memory/storage';
import dotenv from 'dotenv';

dotenv.config();

const rl=readline.createInterface({
  input:process.stdin,
  output:process.stdout,
});

async function main() {
  const anchor=getCurrentTemporalAnchor();
  console.log('\n======================================================');
  console.log('MINIMI CHAT AGENT (CLI)');
  console.log('======================================================');
  console.log(`Current Anchor: ${anchor.currentDateFormatted}`);
  console.log(`Tool: web_search`);
  console.log('------------------------------------------------------');

  const sessions=getAllSessions();
  sessions.slice(0,3).forEach((s,idx)=>{
    console.log(` [${idx+1}] ${s.title}`);
  });
  console.log(' [4] Start new session');

  const session=createSession('CLI Session');
  console.log(`\nActive Session: ${session.id}\n`);

  function promptUser() {
    rl.question('\nYou: ',async (input)=>{
      const trimmed=input.trim();
      if (!trimmed || trimmed.toLowerCase()==='exit') {
        rl.close();
        process.exit(0);
      }

      console.log('\nAgent:');
      try {
        await runAgentTurn({
          sessionId:session.id,
          userQuery:trimmed,
          onEvent:(event)=>{
            if (event.type==='thought') {
              process.stdout.write(`\x1b[90m[${event.content.trim()}]\x1b[0m\n`);
            } else if (event.type==='search_start') {
              process.stdout.write(`\x1b[36mweb_search("${event.query}")...\x1b[0m\n`);
            } else if (event.type==='search_end') {
              process.stdout.write(`\x1b[32m✔ ${event.sources.length} sources (${event.durationMs}ms)\x1b[0m\n`);
            } else if (event.type==='token') {
              process.stdout.write(event.chunk);
            } else if (event.type==='done') {
              if (event.message.citations && event.message.citations.length>0) {
                console.log('\n\nSources:');
                event.message.citations.forEach((c)=>{
                  console.log(` [${c.index}] ${c.domain} - ${c.url}`);
                });
              }
            } else if (event.type==='error') {
              console.error(`\x1b[31mError: ${event.message}\x1b[0m`);
            }
          },
        });
      } catch (err:any) {
        console.error('\nError:',err.message);
      }

      promptUser();
    });
  }

  promptUser();
}

main().catch((err)=>{
  console.error(err);
  process.exit(1);
});
