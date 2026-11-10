import {Message,Citation,SearchStep} from '@/types/memory';
import {AgentStreamEvent} from '@/types/agent';
import {SearchResponse} from '@/types/search';
import {buildSystemPrompt} from './prompt';
import {streamLLMCompletion,ChatMessageParam} from './llm-provider';
import {executeWebSearch,formatSearchResultsForPrompt} from '../search/search-tool';
import {getMessages,addMessage,searchCrossSessionMemory,createSession} from '../memory/storage';

export interface AgentRunOptions {
  sessionId?:string;
  userQuery:string;
  referenceDate?:Date;
  onEvent:(event:AgentStreamEvent)=>void;
}

export async function runAgentTurn(options:AgentRunOptions):Promise<Message> {
  const {userQuery,onEvent,referenceDate=new Date()}=options;

  let sessionId=options.sessionId;
  if (!sessionId) {
    const newSession=createSession();
    sessionId=newSession.id;
  }

  const userMessage:Message={
    id:`msg-${Date.now()}-u`,
    sessionId,
    role:'user',
    content:userQuery,
    createdAt:new Date().toISOString(),
  };
  addMessage(userMessage);

  const historicalRecall=searchCrossSessionMemory(userQuery,sessionId,referenceDate);
  const systemPrompt=buildSystemPrompt(userQuery,historicalRecall,referenceDate);
  const previousMessages=getMessages(sessionId).filter((m)=>m.id!==userMessage.id);
  const chatMessages:ChatMessageParam[]=[
    {role:'system',content:systemPrompt},
    ...previousMessages.slice(-8).map((m)=>({
      role:m.role as 'user'|'assistant',
      content:m.content,
    })),
    {role:'user',content:userQuery},
  ];

  const searchSteps:SearchStep[]=[];
  const citations:Citation[]=[];
  let accumulatedThought='';

  const initialCompletion=await streamLLMCompletion(
    chatMessages,
    {
      onToken:(chunk)=>{
        onEvent({type:'token',chunk});
      },
      onThought:(thought)=>{
        accumulatedThought+=thought+'\n';
        onEvent({type:'thought',content:thought});
      },
    },
    {allowTools:true}
  );

  let finalContent=initialCompletion.fullText;

  if (initialCompletion.toolCalls && initialCompletion.toolCalls.length>0) {
    const toolCalls=initialCompletion.toolCalls;

    for (const tc of toolCalls) {
      onEvent({
        type:'search_start',
        query:tc.args.query,
        provider:'web_search',
      });
    }

    const searchPromises=toolCalls.map(async (tc)=>{
      const step:SearchStep={
        query:tc.args.query,
        status:'searching',
      };
      searchSteps.push(step);

      try {
        const res=await executeWebSearch({
          query:tc.args.query,
          freshness:tc.args.freshness,
        });

        step.status='completed';
        step.resultCount=res.results.length;
        step.durationMs=res.searchTimeMs;
        step.provider=res.provider;
        step.sources=res.results;

        onEvent({
          type:'search_end',
          query:tc.args.query,
          sources:res.results,
          durationMs:res.searchTimeMs,
        });

        return {toolCallId:tc.id,response:res};
      } catch (err:any) {
        step.status='failed';
        const emptyRes:SearchResponse={
          query:tc.args.query,
          results:[],
          totalResults:0,
          provider:'duckduckgo-fallback',
          searchTimeMs:0,
        };
        onEvent({
          type:'search_end',
          query:tc.args.query,
          sources:[],
          durationMs:0,
        });
        return {toolCallId:tc.id,response:emptyRes};
      }
    });

    const searchExecutions=await Promise.all(searchPromises);
    const seenUrls=new Set<string>();

    for (const exec of searchExecutions) {
      for (const item of exec.response.results) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          citations.push({
            index:citations.length+1,
            id:item.id,
            title:item.title,
            url:item.url,
            domain:item.domain,
            snippet:item.snippet,
          });
        }
      }
    }

    chatMessages.push({
      role:'assistant',
      content:'',
      tool_calls:toolCalls.map((tc)=>({
        id:tc.id,
        type:'function',
        function:{
          name:'web_search',
          arguments:JSON.stringify(tc.args),
        },
      })),
    });

    for (const exec of searchExecutions) {
      chatMessages.push({
        role:'tool',
        tool_call_id:exec.toolCallId,
        name:'web_search',
        content:formatSearchResultsForPrompt(exec.response),
      });
    }

    finalContent='';
    const synthesisCompletion=await streamLLMCompletion(
      chatMessages,
      {
        onToken:(chunk)=>{
          finalContent+=chunk;
          onEvent({type:'token',chunk});
        },
        onThought:(thought)=>{
          accumulatedThought+=thought+'\n';
          onEvent({type:'thought',content:thought});
        },
      },
      {allowTools:false}
    );

    finalContent=synthesisCompletion.fullText;
  }

  const assistantMessage:Message={
    id:`msg-${Date.now()}-a`,
    sessionId,
    role:'assistant',
    content:finalContent,
    createdAt:new Date().toISOString(),
    searchSteps:searchSteps.length>0?searchSteps:undefined,
    citations:citations.length>0?citations:undefined,
    thought:accumulatedThought.trim()||undefined,
  };

  addMessage(assistantMessage);

  onEvent({
    type:'done',
    message:assistantMessage,
  });

  return assistantMessage;
}
