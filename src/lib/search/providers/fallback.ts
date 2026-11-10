import {SearchResponse,SearchOptions} from '@/types/search';
import {processAndDeduplicateResults} from '../cleaner';
import * as cheerio from 'cheerio';

export async function searchFallback(
  query:string,
  options:SearchOptions={}
):Promise<SearchResponse> {
  const startTime=Date.now();
  const limit=options.limit||6;

  try {
    const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response=await fetch(url,{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'en-US,en;q=0.5',
      },
    });

    if (!response.ok) throw new Error(`DuckDuckGo response status: ${response.status}`);

    const html=await response.text();
    const $=cheerio.load(html);
    const rawResults:Array<{title:string;url:string;snippet:string}>=[];

    $('.result').each((_,el)=>{
      const titleEl=$(el).find('.result__title a');
      const snippetEl=$(el).find('.result__snippet');
      const rawUrl=titleEl.attr('href')||'';

      let targetUrl=rawUrl;
      if (rawUrl.includes('uddg=')) {
        try {
          const match=rawUrl.match(/uddg=([^&]+)/);
          if (match&&match[1]) targetUrl=decodeURIComponent(match[1]);
        } catch {
          targetUrl=rawUrl;
        }
      }

      const title=titleEl.text().trim();
      const snippet=snippetEl.text().trim();

      if (title && targetUrl && targetUrl.startsWith('http')) {
        rawResults.push({title,url:targetUrl,snippet});
      }
    });

    const results=processAndDeduplicateResults(rawResults,limit);

    return {
      query,
      results,
      totalResults:results.length,
      provider:'duckduckgo-fallback',
      searchTimeMs:Date.now()-startTime,
    };
  } catch (error) {
    return {
      query,
      results:[],
      totalResults:0,
      provider:'duckduckgo-fallback',
      searchTimeMs:Date.now()-startTime,
    };
  }
}
