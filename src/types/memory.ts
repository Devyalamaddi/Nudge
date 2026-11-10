import {SearchResultItem} from './search';

export type Role='user'|'assistant'|'system';

export interface Citation {
  index:number;
  id:string;
  title:string;
  url:string;
  domain:string;
  snippet:string;
}

export interface SearchStep {
  query:string;
  status:'searching'|'completed'|'failed';
  resultCount?:number;
  durationMs?:number;
  provider?:string;
  sources?:SearchResultItem[];
}

export interface Message {
  id:string;
  sessionId:string;
  role:Role;
  content:string;
  createdAt:string;
  searchSteps?:SearchStep[];
  citations?:Citation[];
  thought?:string;
  simulatedDate?:string;
}

export interface Session {
  id:string;
  title:string;
  createdAt:string;
  updatedAt:string;
  isBenchmark?:boolean;
  benchmarkId?:'crm-monday'|'postgres-nov3'|'postgres-tuesday';
  summary?:string;
}

export interface EpisodicMemoryRecord {
  id:string;
  sessionId:string;
  dateStr:string;
  dayOfWeek:string;
  summary:string;
  entities:string[];
  keyFacts:string[];
}
