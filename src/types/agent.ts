import {Message,Citation,SearchStep} from './memory';
import {SearchResultItem} from './search';

export type AgentStreamEvent=
  | {type:'thought';content:string}
  | {type:'search_start';query:string;provider:string}
  | {type:'search_end';query:string;sources:SearchResultItem[];durationMs:number}
  | {type:'token';chunk:string}
  | {type:'citation';citation:Citation}
  | {type:'done';message:Message}
  | {type:'error';message:string};

export interface AgentConfig {
  llmProvider:'openai'|'anthropic'|'gemini'|'mock';
  modelName:string;
  searchProvider:'tavily'|'brave'|'serper'|'duckduckgo-fallback'|'mock';
  temperature?:number;
  mockMode?:boolean;
}
