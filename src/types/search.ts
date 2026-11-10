export interface SearchResultItem {
  id:string;
  title:string;
  url:string;
  snippet:string;
  publishedDate?:string;
  score?:number;
  domain:string;
}

export interface SearchResponse {
  query:string;
  results:SearchResultItem[];
  totalResults:number;
  provider:'tavily'|'brave'|'serper'|'duckduckgo-fallback'|'mock';
  searchTimeMs:number;
}

export interface SearchOptions {
  freshness?:'day'|'week'|'month'|'year';
  limit?:number;
}

export interface SearchToolArgs {
  query:string;
  freshness?:'day'|'week'|'month'|'year';
}
