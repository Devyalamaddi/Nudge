export interface TemporalAnchor {
  nowIso:string;
  currentDateFormatted:string;
  dayOfWeek:string;
  dayOfMonth:number;
  monthName:string;
  year:number;
  timezone:string;
}

export interface ResolvedDate {
  originalText:string;
  resolvedDateStr:string;
  resolvedDateHuman:string;
  daysAgo:number;
  isPast:boolean;
}

const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=[
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export function getCurrentTemporalAnchor(ref:Date=new Date()):TemporalAnchor {
  const dayOfWeek=DAYS[ref.getDay()];
  const dayOfMonth=ref.getDate();
  const monthName=MONTHS[ref.getMonth()];
  const year=ref.getFullYear();
  const formatted=ref.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  return {
    nowIso:ref.toISOString(),
    currentDateFormatted:formatted,
    dayOfWeek,
    dayOfMonth,
    monthName,
    year,
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',
  };
}

export function formatDateYmd(d:Date):string {
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function resolveRelativeDates(text:string,ref:Date=new Date()):ResolvedDate[] {
  const results:ResolvedDate[]=[];
  const lower=text.toLowerCase();

  DAYS.forEach((dayName,idx)=>{
    const dLower=dayName.toLowerCase();
    const lastRegex=new RegExp(`\\blast\\s+${dLower}\\b`,'i');
    if (lastRegex.test(lower)) {
      const target=new Date(ref);
      const curIdx=ref.getDay();
      let diff=curIdx-idx;
      if (diff===0) diff=7;
      else if (diff>0) diff=diff+7;
      else diff=diff+7;
      target.setDate(ref.getDate()-diff);
      results.push({
        originalText:`last ${dayName}`,
        resolvedDateStr:formatDateYmd(target),
        resolvedDateHuman:`${dayName}, ${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}`,
        daysAgo:diff,
        isPast:true,
      });
      return;
    }

    const bareRegex=new RegExp(`\\b(on\\s+|this\\s+)?${dLower}\\b`,'i');
    if (bareRegex.test(lower)) {
      const target=new Date(ref);
      const curIdx=ref.getDay();
      let diff=curIdx-idx;
      if (diff<=0) diff+=7;
      target.setDate(ref.getDate()-diff);
      results.push({
        originalText:dayName,
        resolvedDateStr:formatDateYmd(target),
        resolvedDateHuman:`${dayName}, ${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}`,
        daysAgo:diff,
        isPast:true,
      });
    }
  });

  const dateRegexes=[
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  ];

  for (const regex of dateRegexes) {
    const match=lower.match(regex);
    if (match) {
      let day:number;
      let monthStr:string;
      if (!isNaN(parseInt(match[1],10))) {
        day=parseInt(match[1],10);
        monthStr=match[2];
      } else {
        monthStr=match[1];
        day=parseInt(match[2],10);
      }
      const mIdx=MONTHS.findIndex((m)=>m.toLowerCase().startsWith(monthStr.slice(0,3).toLowerCase()));
      if (mIdx!==-1 && day>=1 && day<=31) {
        const target=new Date(ref.getFullYear(),mIdx,day);
        if (target>ref) target.setFullYear(ref.getFullYear()-1);
        const diffDays=Math.ceil(Math.abs(ref.getTime()-target.getTime())/(1000*60*60*24));
        results.push({
          originalText:match[0],
          resolvedDateStr:formatDateYmd(target),
          resolvedDateHuman:`${DAYS[target.getDay()]}, ${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}`,
          daysAgo:diffDays,
          isPast:true,
        });
        break;
      }
    }
  }

  if (/\byesterday\b/i.test(lower)) {
    const target=new Date(ref);
    target.setDate(ref.getDate()-1);
    results.push({
      originalText:'yesterday',
      resolvedDateStr:formatDateYmd(target),
      resolvedDateHuman:`${DAYS[target.getDay()]}, ${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}`,
      daysAgo:1,
      isPast:true,
    });
  }

  return results;
}

export function buildTemporalGroundingBlock(userQuery:string,ref:Date=new Date()):string {
  const anchor=getCurrentTemporalAnchor(ref);
  const resolved=resolveRelativeDates(userQuery,ref);
  const todayYmd=formatDateYmd(ref);

  let block=`[TEMPORAL CONTEXT]\nToday's Date: ${anchor.currentDateFormatted} (${anchor.dayOfWeek})\nCurrent Year: ${anchor.year}\nTimezone: ${anchor.timezone}\nISO Reference: ${anchor.nowIso}`;

  if (resolved.length>0) {
    block+=`\n\nDetected Relative Temporal References:`;
    for (const r of resolved) {
      block+=`\n- Reference "${r.originalText}" resolves to: ${r.resolvedDateHuman} (Date: ${r.resolvedDateStr}, ${r.daysAgo} days ago)`;
    }
    const baseDate=resolved[0].resolvedDateStr;
    block+=`\n\nTEMPORAL DELTA WINDOW: [${baseDate} → ${todayYmd}]`;
    block+=`\n- Any event, changelog, or pricing article published BEFORE ${baseDate} represents the baseline status, NOT a change "since then".`;
    block+=`\n- Focus web_search queries specifically on announcements, release notes, or pricing updates between ${baseDate} and ${todayYmd}.`;
  }

  return block;
}
