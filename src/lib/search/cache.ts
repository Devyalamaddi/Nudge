import {SearchResponse} from '@/types/search';

interface CacheEntry {
  data:SearchResponse;
  expiresAt:number;
}

class SearchCache {
  private cache=new Map<string,CacheEntry>();
  private readonly defaultTtlMs:number;

  constructor(ttlMinutes:number=15) {
    this.defaultTtlMs=ttlMinutes*60*1000;
  }

  private normalizeKey(query:string,freshness?:string):string {
    return `${query.trim().toLowerCase()}::${freshness||'any'}`;
  }

  get(query:string,freshness?:string):SearchResponse|null {
    const key=this.normalizeKey(query,freshness);
    const entry=this.cache.get(key);
    if (!entry) return null;
    if (Date.now()>entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(query:string,data:SearchResponse,freshness?:string,ttlMs?:number):void {
    const key=this.normalizeKey(query,freshness);
    const expiresAt=Date.now()+(ttlMs||this.defaultTtlMs);
    if (this.cache.size>300) {
      const firstKey=this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key,{data,expiresAt});
  }

  clear():void {
    this.cache.clear();
  }
}

export const searchCache=new SearchCache();
