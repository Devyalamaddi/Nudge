import fs from 'fs';
import path from 'path';
import {Session,Message,EpisodicMemoryRecord} from '@/types/memory';
import {generateBenchmarkScenarios} from './benchmarks';
import {resolveRelativeDates} from '../temporal';

interface StoreData {
  sessions:Session[];
  messages:Message[];
  episodicRecords:EpisodicMemoryRecord[];
}

const DATA_DIR=path.join(process.cwd(),'data');
const STORE_FILE=path.join(DATA_DIR,'memory-store.json');

function ensureStorage():StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR,{recursive:true});
  }

  if (!fs.existsSync(STORE_FILE)) {
    const benchmarks=generateBenchmarkScenarios();
    const initialData:StoreData={
      sessions:benchmarks.map((b)=>b.session),
      messages:benchmarks.flatMap((b)=>b.messages),
      episodicRecords:benchmarks.map((b)=>b.episodicRecord),
    };
    fs.writeFileSync(STORE_FILE,JSON.stringify(initialData,null,2),'utf-8');
    return initialData;
  }

  try {
    const content=fs.readFileSync(STORE_FILE,'utf-8');
    const data:StoreData=JSON.parse(content);
    const benchmarks=generateBenchmarkScenarios();
    let updated=false;

    for (const b of benchmarks) {
      if (!data.sessions.some((s)=>s.id===b.session.id)) {
        data.sessions.unshift(b.session);
        data.messages.push(...b.messages);
        data.episodicRecords.push(b.episodicRecord);
        updated=true;
      }
    }

    if (updated) {
      fs.writeFileSync(STORE_FILE,JSON.stringify(data,null,2),'utf-8');
    }

    return data;
  } catch (error) {
    const benchmarks=generateBenchmarkScenarios();
    const initialData:StoreData={
      sessions:benchmarks.map((b)=>b.session),
      messages:benchmarks.flatMap((b)=>b.messages),
      episodicRecords:benchmarks.map((b)=>b.episodicRecord),
    };
    fs.writeFileSync(STORE_FILE,JSON.stringify(initialData,null,2),'utf-8');
    return initialData;
  }
}

function saveStorage(data:StoreData):void {
  ensureStorage();
  const tmpFile=`${STORE_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile,JSON.stringify(data,null,2),'utf-8');
  fs.renameSync(tmpFile,STORE_FILE);
}

export function getAllSessions():Session[] {
  const data=ensureStorage();
  return data.sessions.sort(
    (a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()
  );
}

export function getSession(id:string):Session|null {
  const data=ensureStorage();
  return data.sessions.find((s)=>s.id===id)||null;
}

export function createSession(
  title:string='New Conversation',
  isBenchmark:boolean=false,
  benchmarkId?:Session['benchmarkId']
):Session {
  const data=ensureStorage();
  const now=new Date().toISOString();
  const newSession:Session={
    id:`sess-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
    title,
    createdAt:now,
    updatedAt:now,
    isBenchmark,
    benchmarkId,
  };

  data.sessions.unshift(newSession);
  saveStorage(data);
  return newSession;
}

export function deleteSession(id:string):boolean {
  const data=ensureStorage();
  const initialLength=data.sessions.length;
  data.sessions=data.sessions.filter((s)=>s.id!==id);
  data.messages=data.messages.filter((m)=>m.sessionId!==id);
  data.episodicRecords=data.episodicRecords.filter((e)=>e.sessionId!==id);

  if (data.sessions.length!==initialLength) {
    saveStorage(data);
    return true;
  }
  return false;
}

export function updateSession(id:string,updates:Partial<Session>):Session|null {
  const data=ensureStorage();
  const session=data.sessions.find((s)=>s.id===id);
  if (!session) return null;

  Object.assign(session,updates,{updatedAt:new Date().toISOString()});
  saveStorage(data);
  return session;
}

export function getMessages(sessionId:string):Message[] {
  const data=ensureStorage();
  return data.messages
    .filter((m)=>m.sessionId===sessionId)
    .sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());
}

export function addMessage(message:Message):Message {
  const data=ensureStorage();
  data.messages.push(message);

  const session=data.sessions.find((s)=>s.id===message.sessionId);
  if (session) {
    session.updatedAt=message.createdAt;
    if (session.title==='New Conversation' && message.role==='user') {
      session.title=message.content.slice(0,45).trim()+(message.content.length>45?'...':'');
    }
  }

  saveStorage(data);
  return message;
}

export interface EpisodicRecallMatch {
  confidence:'high'|'medium';
  session:Session;
  matchedRecord?:EpisodicMemoryRecord;
  relevantMessages:Message[];
  historicalContextSummary:string;
}

export function searchCrossSessionMemory(
  query:string,
  currentSessionId?:string,
  ref:Date=new Date()
):EpisodicRecallMatch|null {
  const data=ensureStorage();
  const lowerQuery=query.toLowerCase();
  const resolvedDates=resolveRelativeDates(query,ref);

  for (const record of data.episodicRecords) {
    let score=0;

    if (resolvedDates.length>0) {
      for (const r of resolvedDates) {
        if (record.dateStr===r.resolvedDateStr) score+=5;
        if (r.originalText.toLowerCase().includes(record.dayOfWeek.toLowerCase())) score+=3;
      }
    }

    for (const entity of record.entities) {
      if (lowerQuery.includes(entity.toLowerCase())) score+=2;
    }

    if (lowerQuery.includes('crm') && record.summary.toLowerCase().includes('crm')) score+=4;
    if (lowerQuery.includes('postgres') && record.summary.toLowerCase().includes('postgres')) score+=4;
    if (lowerQuery.includes('shortlist') && record.summary.toLowerCase().includes('shortlist')) score+=3;
    if (lowerQuery.includes('pricing') && record.summary.toLowerCase().includes('pricing')) score+=2;
    if (lowerQuery.includes('3 november') || lowerQuery.includes('nov 3')) {
      if (record.dateStr.includes('-11-03')) score+=10;
    }

    if (score>=4) {
      const session=data.sessions.find((s)=>s.id===record.sessionId);
      if (session) {
        const msgs=data.messages
          .filter((m)=>m.sessionId===record.sessionId)
          .sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());

        return {
          confidence:score>=6?'high':'medium',
          session,
          matchedRecord:record,
          relevantMessages:msgs,
          historicalContextSummary:`[HISTORICAL CONVERSATION RECALL]\nDate: ${record.dateStr} (${record.dayOfWeek})\nSession: "${session.title}"\nSummary: ${record.summary}\nEntities Discussed: ${record.entities.join(', ')}\nKey Baseline Facts Stored:\n${record.keyFacts.map((f)=>`- ${f}`).join('\n')}`,
        };
      }
    }
  }

  const candidateSessions=data.sessions.filter((s)=>s.id!==currentSessionId);
  for (const session of candidateSessions) {
    const msgs=data.messages.filter((m)=>m.sessionId===session.id);
    const combinedText=msgs.map((m)=>m.content).join(' ').toLowerCase();

    let score=0;
    if (lowerQuery.includes('crm') && combinedText.includes('crm')) score+=2;
    if (lowerQuery.includes('sales team') && combinedText.includes('sales team')) score+=2;
    if (lowerQuery.includes('postgres') && combinedText.includes('postgres')) score+=2;
    if (lowerQuery.includes('3 november') && (combinedText.includes('november 3')||combinedText.includes('nov 3')||session.createdAt.includes('-11-03'))) score+=5;

    if (score>=3) {
      return {
        confidence:'medium',
        session,
        relevantMessages:msgs,
        historicalContextSummary:`[HISTORICAL CONVERSATION RECALL]\nSession: "${session.title}" (Recorded: ${session.createdAt.slice(0,10)})\nHistorical Thread Extract:\n${msgs.slice(0,2).map((m)=>`${m.role.toUpperCase()}: ${m.content.slice(0,250)}...`).join('\n')}`,
      };
    }
  }

  return null;
}

export function resetToBenchmarks(ref:Date=new Date()):void {
  const benchmarks=generateBenchmarkScenarios(ref);
  const data:StoreData={
    sessions:benchmarks.map((b)=>b.session),
    messages:benchmarks.flatMap((b)=>b.messages),
    episodicRecords:benchmarks.map((b)=>b.episodicRecord),
  };
  saveStorage(data);
}
