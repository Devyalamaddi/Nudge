import {SearchResponse,SearchOptions} from '@/types/search';
import {processAndDeduplicateResults} from '../cleaner';

export async function searchSerper(
  query:string,
  options:SearchOptions={},
  apiKey?:string
):Promise<SearchResponse> {
  const key=apiKey||process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_API_KEY is not configured');

  const startTime=Date.now();
  const limit=options.limit||6;

  const body:Record<string,any>={
    q:query,
    num:limit+2,
  };

  if (options.freshness==='day') body.tbs='qdr:d';
  else if (options.freshness==='week') body.tbs='qdr:w';
  else if (options.freshness==='month') body.tbs='qdr:m';
  else if (options.freshness==='year') body.tbs='qdr:y';

  const response=await fetch('https://google.serper.dev/search',{
    method:'POST',
    headers:{
      'X-API-KEY':key,
      'Content-Type':'application/json',
    },
    body:JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText=await response.text();
    throw new Error(`Serper API error (${response.status}): ${errorText}`);
  }

  const data=await response.json();
  const rawResults=(data.organic||[]).map((r:any)=>({
    title:r.title,
    url:r.link,
    snippet:r.snippet,
    publishedDate:r.date,
  }));

  const results=processAndDeduplicateResults(rawResults,limit);

  return {
    query,
    results,
    totalResults:results.length,
    provider:'serper',
    searchTimeMs:Date.now()-startTime,
  };
}
