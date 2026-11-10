import {SearchResultItem} from '@/types/search';

export function extractDomain(urlStr:string):string {
  try {
    const parsed=new URL(urlStr);
    return parsed.hostname.replace(/^www\./,'');
  } catch {
    return 'web';
  }
}

export function cleanSnippet(snippet:string):string {
  if (!snippet) return '';
  return snippet
    .replace(/<[^>]+>/g,' ')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/\s{2,}/g,' ')
    .trim();
}

export function processAndDeduplicateResults(
  rawResults:Array<{
    title?:string;
    url?:string;
    snippet?:string;
    content?:string;
    publishedDate?:string;
    score?:number;
  }>,
  limit:number=6
):SearchResultItem[] {
  const seenUrls=new Set<string>();
  const processed:SearchResultItem[]=[];

  for (const item of rawResults) {
    if (!item.url || !item.url.startsWith('http')) continue;
    let normalizedUrl=item.url;
    try {
      const u=new URL(item.url);
      u.searchParams.delete('utm_source');
      u.searchParams.delete('utm_medium');
      u.searchParams.delete('utm_campaign');
      normalizedUrl=u.toString().replace(/\/$/,'');
    } catch {}

    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    const domain=extractDomain(item.url);
    const textSnippet=cleanSnippet(item.content||item.snippet||'');

    processed.push({
      id:`src-${processed.length+1}`,
      title:item.title?.trim()||domain,
      url:normalizedUrl,
      snippet:textSnippet.slice(0,450),
      publishedDate:item.publishedDate,
      score:item.score??1.0,
      domain,
    });

    if (processed.length>=limit) break;
  }

  return processed;
}
