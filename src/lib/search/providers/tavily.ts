import {SearchResponse,SearchOptions} from '@/types/search';
import {processAndDeduplicateResults} from '../cleaner';

export async function searchTavily(
  query:string,
  options:SearchOptions={},
  apiKey?:string
):Promise<SearchResponse> {
  const key=apiKey||process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not configured');

  const startTime=Date.now();
  const limit=options.limit||6;

  const body:Record<string,any>={
    api_key:key,
    query,
    search_depth:'advanced',
    include_answer:false,
    include_raw_content:false,
    max_results:limit+2,
  };

  if (options.freshness==='day') body.time_range='day';
  else if (options.freshness==='week') body.time_range='week';
  else if (options.freshness==='month') body.time_range='month';
  else if (options.freshness==='year') body.time_range='year';

  const response=await fetch('https://api.tavily.com/search',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText=await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  const data=await response.json();
  const rawResults=(data.results||[]).map((r:any)=>({
    title:r.title,
    url:r.url,
    snippet:r.content,
    publishedDate:r.published_date,
    score:r.score,
  }));

  const results=processAndDeduplicateResults(rawResults,limit);

  return {
    query,
    results,
    totalResults:results.length,
    provider:'tavily',
    searchTimeMs:Date.now()-startTime,
  };
}
