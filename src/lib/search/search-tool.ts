import {SearchResponse,SearchOptions,SearchToolArgs} from '@/types/search';
import {searchCache} from './cache';
import {searchTavily} from './providers/tavily';
import {searchBrave} from './providers/brave';
import {searchSerper} from './providers/serper';
import {searchFallback} from './providers/fallback';
import {isValidApiKey} from '../agent/llm-provider';

export const WEB_SEARCH_TOOL_DEFINITION={
  type:'function' as const,
  function:{
    name:'web_search',
    description:'Search the public live web for up-to-date facts, current pricing, changelogs, news, documentation, and product updates.',
    parameters:{
      type:'object',
      properties:{
        query:{
          type:'string',
          description:'The targeted search query.',
        },
        freshness:{
          type:'string',
          enum:['day','week','month','year'],
          description:'Optional recency filter.',
        },
      },
      required:['query'],
    },
  },
};

export function getActiveSearchProvider():'tavily'|'brave'|'serper'|'duckduckgo-fallback' {
  if (isValidApiKey(process.env.TAVILY_API_KEY)) return 'tavily';
  if (isValidApiKey(process.env.BRAVE_API_KEY)) return 'brave';
  if (isValidApiKey(process.env.SERPER_API_KEY)) return 'serper';
  return 'duckduckgo-fallback';
}

export async function executeWebSearch(
  args:SearchToolArgs,
  options:SearchOptions={}
):Promise<SearchResponse> {
  const query=args.query?.trim();
  if (!query) throw new Error('Search query cannot be empty');

  const freshness=args.freshness||options.freshness;
  const cached=searchCache.get(query,freshness);
  if (cached) return cached;

  const provider=getActiveSearchProvider();
  let response:SearchResponse;

  try {
    switch (provider) {
      case 'tavily':
        response=await searchTavily(query,{...options,freshness});
        break;
      case 'brave':
        response=await searchBrave(query,{...options,freshness});
        break;
      case 'serper':
        response=await searchSerper(query,{...options,freshness});
        break;
      default:
        response=await searchFallback(query,{...options,freshness});
        break;
    }
  } catch (error) {
    response=await searchFallback(query,{...options,freshness});
  }

  if (response.results.length>0) {
    searchCache.set(query,response,freshness);
  }

  return response;
}

export function formatSearchResultsForPrompt(response:SearchResponse):string {
  if (!response.results || response.results.length===0) {
    return `No search results found for query: "${response.query}".`;
  }

  const lines=[`Search Results for "${response.query}" (${response.results.length} results):`];
  response.results.forEach((item,index)=>{
    const pubDateStr=item.publishedDate?` [Date: ${item.publishedDate}]`:'';
    lines.push(`[${index+1}] Title: ${item.title}${pubDateStr}\n    URL: ${item.url}\n    Domain: ${item.domain}\n    Snippet: ${item.snippet}`);
  });

  return lines.join('\n\n');
}
