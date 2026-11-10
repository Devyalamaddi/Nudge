import {SearchResponse,SearchOptions} from '@/types/search';
import {processAndDeduplicateResults} from '../cleaner';

export async function searchBrave(
  query:string,
  options:SearchOptions={},
  apiKey?:string
):Promise<SearchResponse> {
  const key=apiKey||process.env.BRAVE_API_KEY;
  if (!key) throw new Error('BRAVE_API_KEY is not configured');

  const startTime=Date.now();
  const limit=options.limit||6;

  const url=new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q',query);
  url.searchParams.set('count',String(limit+2));

  if (options.freshness==='day') url.searchParams.set('freshness','pd');
  else if (options.freshness==='week') url.searchParams.set('freshness','pw');
  else if (options.freshness==='month') url.searchParams.set('freshness','pm');
  else if (options.freshness==='year') url.searchParams.set('freshness','py');

  const response=await fetch(url.toString(),{
    headers:{
      'Accept':'application/json',
      'X-Subscription-Token':key,
    },
  });

  if (!response.ok) {
    const errorText=await response.text();
    throw new Error(`Brave Search API error (${response.status}): ${errorText}`);
  }

  const data=await response.json();
  const rawResults=(data.web?.results||[]).map((r:any)=>({
    title:r.title,
    url:r.url,
    snippet:r.description,
    publishedDate:r.page_age,
  }));

  const results=processAndDeduplicateResults(rawResults,limit);

  return {
    query,
    results,
    totalResults:results.length,
    provider:'brave',
    searchTimeMs:Date.now()-startTime,
  };
}
