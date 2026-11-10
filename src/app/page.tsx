'use client';

import React,{useState,useEffect,useRef} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  Sparkles,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Cpu,
  RefreshCw,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import {Session,Message} from '@/types/memory';
import {AgentStreamEvent} from '@/types/agent';
import {SearchResultItem} from '@/types/search';

const BENCHMARK_PROMPTS=[
  {
    title:'CRM Shortlist (Monday Delta)',
    query:'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    benchmarkId:'benchmark-crm-monday',
    badge:'Benchmark 1',
  },
  {
    title:'3 November Memory Recall & Audit',
    query:'What did I ask you on 3 November? Is your answer still correct today?',
    benchmarkId:'benchmark-postgres-nov3',
    badge:'Benchmark 2',
  },
  {
    title:'Postgres Hosting (Last Tuesday)',
    query:'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
    benchmarkId:'benchmark-postgres-tuesday',
    badge:'Benchmark 3',
  },
];

export default function ChatPage() {
  const [sessions,setSessions]=useState<Session[]>([]);
  const [activeSessionId,setActiveSessionId]=useState<string|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [input,setInput]=useState('');
  const [isLoading,setIsLoading]=useState(false);
  const [currentStreamEvent,setCurrentStreamEvent]=useState<{
    status:'idle'|'searching'|'streaming';
    searchQueries?:string[];
    sources?:SearchResultItem[];
    streamedText?:string;
    thought?:string;
  }>({status:'idle'});

  const [expandedSearches,setExpandedSearches]=useState<Record<string,boolean>>({});
  const messagesEndRef=useRef<HTMLDivElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{
    fetchSessions();
  },[]);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth'});
  },[messages,currentStreamEvent]);

  useEffect(()=>{
    if (textareaRef.current) {
      textareaRef.current.style.height='auto';
      textareaRef.current.style.height=`${Math.min(textareaRef.current.scrollHeight,180)}px`;
    }
  },[input]);

  async function fetchSessions() {
    try {
      const res=await fetch('/api/sessions');
      const data=await res.json();
      if (data.sessions && data.sessions.length>0) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function selectSession(sessionId:string) {
    setActiveSessionId(sessionId);
    try {
      const res=await fetch(`/api/sessions/${sessionId}`);
      const data=await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleNewChat() {
    try {
      const res=await fetch('/api/sessions',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({title:'New Conversation'}),
      });
      const data=await res.json();
      if (data.session) {
        setSessions((prev)=>[data.session,...prev]);
        setActiveSessionId(data.session.id);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteSession(id:string,e:React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${id}`,{method:'DELETE'});
      setSessions((prev)=>prev.filter((s)=>s.id!==id));
      if (activeSessionId===id) {
        const remaining=sessions.filter((s)=>s.id!==id);
        if (remaining.length>0) {
          selectSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleResetBenchmarks() {
    try {
      const res=await fetch('/api/seed',{method:'POST'});
      const data=await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        selectSession(data.sessions[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(queryText?:string) {
    const textToSend=queryText||input;
    if (!textToSend.trim() || isLoading) return;

    setInput('');
    setIsLoading(true);
    setCurrentStreamEvent({status:'idle',streamedText:'',searchQueries:[]});

    const tempUserMsg:Message={
      id:`temp-${Date.now()}`,
      sessionId:activeSessionId||'default',
      role:'user',
      content:textToSend,
      createdAt:new Date().toISOString(),
    };
    setMessages((prev)=>[...prev,tempUserMsg]);

    try {
      const response=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:activeSessionId,
          message:textToSend,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const reader=response.body?.getReader();
      const decoder=new TextDecoder();
      let buffer='';
      let accumulatedText='';
      const collectedSources:SearchResultItem[]=[];
      const collectedQueries:string[]=[];

      if (reader) {
        while (true) {
          const {value,done}=await reader.read();
          if (done) break;

          buffer+=decoder.decode(value,{stream:true});
          const lines=buffer.split('\n\n');
          buffer=lines.pop()||'';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event:AgentStreamEvent=JSON.parse(line.slice(6));

                if (event.type==='thought') {
                  setCurrentStreamEvent((prev)=>({
                    ...prev,
                    thought:(prev.thought||'')+event.content,
                  }));
                } else if (event.type==='search_start') {
                  collectedQueries.push(event.query);
                  setCurrentStreamEvent((prev)=>({
                    ...prev,
                    status:'searching',
                    searchQueries:[...collectedQueries],
                  }));
                } else if (event.type==='search_end') {
                  collectedSources.push(...event.sources);
                  setCurrentStreamEvent((prev)=>({
                    ...prev,
                    status:'streaming',
                    sources:[...collectedSources],
                  }));
                } else if (event.type==='token') {
                  accumulatedText+=event.chunk;
                  setCurrentStreamEvent((prev)=>({
                    ...prev,
                    status:'streaming',
                    streamedText:accumulatedText,
                  }));
                } else if (event.type==='done') {
                  setMessages((prev)=>[
                    ...prev.slice(0,-1),
                    tempUserMsg,
                    event.message,
                  ]);
                  setCurrentStreamEvent({status:'idle'});
                  fetchSessions();
                } else if (event.type==='error') {
                  console.error(event.message);
                }
              } catch (parseErr) {
                console.error(parseErr);
              }
            }
          }
        }
      }
    } catch (err:any) {
      setMessages((prev)=>[
        ...prev,
        {
          id:`err-${Date.now()}`,
          sessionId:activeSessionId||'default',
          role:'assistant',
          content:`Error: ${err.message||'Network error'}`,
          createdAt:new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentStreamEvent({status:'idle'});
    }
  }

  const toggleSearchExpand=(id:string)=>{
    setExpandedSearches((prev)=>({...prev,[id]:!prev[id]}));
  };

  const activeSession=sessions.find((s)=>s.id===activeSessionId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-[#f4f4f5]">
      <aside className="w-80 border-r border-[#27272a] bg-[#0c0c0e] flex flex-col justify-between flex-shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-7 w-7 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs tracking-tighter">
                M
              </div>
              <div>
                <h1 className="text-xs font-semibold uppercase tracking-wider text-white">Minimi Agent</h1>
                <p className="text-[10px] text-zinc-400 font-mono">1 Tool: web_search</p>
              </div>
            </div>
            <button
              onClick={handleNewChat}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-700"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pt-3 pb-2 border-b border-[#27272a]">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-zinc-300" />
                Benchmark Datasets
              </span>
              <button
                onClick={handleResetBenchmarks}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                title="Reset benchmark scenarios"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Reset
              </button>
            </div>
            <div className="space-y-1.5">
              {BENCHMARK_PROMPTS.map((bp)=>(
                <button
                  key={bp.benchmarkId}
                  onClick={()=>{
                    const session=sessions.find((s)=>s.id===bp.benchmarkId);
                    if (session) selectSession(session.id);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors border ${
                    activeSessionId===bp.benchmarkId
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="truncate">{bp.title}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-mono">
                      {bp.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 line-clamp-1">{bp.query}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="px-2 mb-1 pt-1">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-zinc-400" />
                Recent Threads
              </span>
            </div>
            {sessions.map((session)=>(
              <div
                key={session.id}
                onClick={()=>selectSession(session.id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors border ${
                  activeSessionId===session.id
                    ? 'bg-zinc-800 border-zinc-700 text-white font-medium'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <span className="truncate max-w-[190px]">{session.title}</span>
                {!session.isBenchmark && (
                  <button
                    onClick={(e)=>handleDeleteSession(session.id,e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-white text-zinc-500 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-[#27272a] bg-[#09090b] text-[11px] space-y-1.5 text-zinc-400 font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="h-3 w-3 text-zinc-300" />
                Tool Spec:
              </span>
              <span className="text-zinc-200">web_search (1 tool)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="h-3 w-3 text-zinc-300" />
                Memory:
              </span>
              <span className="text-zinc-200">Episodic Temporal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-zinc-300" />
                Dispatch:
              </span>
              <span className="text-zinc-200">Parallel Fan-Out</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#09090b] overflow-hidden relative">
        <header className="h-13 border-b border-[#27272a] px-6 py-3 flex items-center justify-between bg-[#0e0e11]/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <span className="font-medium text-xs tracking-wide text-zinc-200 uppercase truncate max-w-md">
              {activeSession?activeSession.title:'Minimi Chat Agent'}
            </span>
            {activeSession?.isBenchmark && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                Benchmark Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Temporal Grounding Active
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length===0 && !isLoading && (
            <div className="max-w-2xl mx-auto mt-14 text-center space-y-6">
              <div className="inline-flex p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white mb-1 shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight uppercase">
                Minimi Search Agent
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                Strictly one tool: <code className="text-white bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700">web_search</code>.
                Temporal grounding, cross-session memory recall, and fast verified answers.
              </p>

              <div className="pt-4 text-left">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3 text-center">
                  Challenge Dataset Test Prompts:
                </p>
                <div className="grid gap-2">
                  {BENCHMARK_PROMPTS.map((bp,idx)=>(
                    <button
                      key={idx}
                      onClick={()=>handleSubmit(bp.query)}
                      className="p-3.5 rounded-lg bg-[#121214] hover:bg-zinc-800/80 border border-[#27272a] hover:border-zinc-500 text-left transition-all group flex items-start justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                            {bp.badge}
                          </span>
                          <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                            {bp.title}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 group-hover:text-zinc-300 font-mono text-[11px]">
                          &ldquo;{bp.query}&rdquo;
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-zinc-500 group-hover:text-white ml-3 flex-shrink-0 mt-1 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message)=>{
            const isUser=message.role==='user';
            const isSearchExpanded=expandedSearches[message.id]??false;

            return (
              <div
                key={message.id}
                className={`flex gap-3 max-w-4xl mx-auto ${isUser?'justify-end':'justify-start'}`}
              >
                {!isUser && (
                  <div className="h-7 w-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white flex-shrink-0 mt-1 font-mono text-xs">
                    M
                  </div>
                )}

                <div className={`space-y-2.5 max-w-2xl md:max-w-3xl ${isUser?'w-auto':'w-full'}`}>
                  {isUser ? (
                    <div className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl rounded-tr-none px-4 py-2.5 text-xs font-normal shadow-sm">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {message.searchSteps && message.searchSteps.length>0 && (
                        <div className="rounded-lg border border-[#27272a] bg-[#121214] overflow-hidden">
                          <button
                            onClick={()=>toggleSearchExpand(message.id)}
                            className="w-full px-3 py-2 flex items-center justify-between text-xs text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Search className="h-3 w-3 text-zinc-400" />
                              <span className="font-mono text-[11px] text-zinc-300">
                                web_search: {message.searchSteps.map((s)=>`"${s.query}"`).join(' | ')}
                              </span>
                              {message.searchSteps[0]?.durationMs && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  ({message.searchSteps[0].durationMs}ms)
                                </span>
                              )}
                            </div>
                            {isSearchExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                          </button>

                          {isSearchExpanded && message.searchSteps.some((s)=>s.sources && s.sources.length>0) && (
                            <div className="p-3 border-t border-[#27272a] bg-[#0c0c0e] space-y-2">
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest font-mono">
                                Verified Sources:
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {message.searchSteps.flatMap((s)=>s.sources||[]).map((src,sIdx)=>(
                                  <a
                                    key={sIdx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2.5 rounded-md border border-[#27272a] bg-[#121214] hover:border-zinc-500 text-left transition-colors group block"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[180px]">
                                        {src.domain}
                                      </span>
                                      <ExternalLink className="h-2.5 w-2.5 text-zinc-500 group-hover:text-white" />
                                    </div>
                                    <p className="text-xs text-zinc-200 line-clamp-1 font-medium">
                                      {src.title}
                                    </p>
                                    <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">
                                      {src.snippet}
                                    </p>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="prose prose-invert max-w-none text-xs leading-relaxed bg-[#121214] border border-[#27272a] rounded-xl p-5 shadow-sm text-zinc-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>

                      {message.citations && message.citations.length>0 && (
                        <div className="pt-2 border-t border-[#27272a] flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-zinc-400 mr-1 uppercase font-mono tracking-wider">
                            Sources:
                          </span>
                          {message.citations.map((c)=>(
                            <a
                              key={c.index}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors font-mono"
                            >
                              <span>[{c.index}]</span>
                              <span className="max-w-[140px] truncate">{c.domain}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-4xl mx-auto justify-start">
              <div className="h-7 w-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white flex-shrink-0 mt-1 font-mono text-xs animate-pulse">
                M
              </div>

              <div className="space-y-2.5 w-full max-w-2xl md:max-w-3xl">
                {currentStreamEvent.status==='searching' && (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 flex items-center gap-2.5 text-xs text-zinc-200 font-mono">
                    <Search className="h-3.5 w-3.5 animate-spin text-white" />
                    <span>
                      Executing <code>web_search</code>
                      {currentStreamEvent.searchQueries && currentStreamEvent.searchQueries.length>0
                        ? `: "${currentStreamEvent.searchQueries[currentStreamEvent.searchQueries.length-1]}"`
                        : '...'}
                    </span>
                  </div>
                )}

                {currentStreamEvent.streamedText && (
                  <div className="prose prose-invert max-w-none text-xs leading-relaxed bg-[#121214] border border-[#27272a] rounded-xl p-5 shadow-sm text-zinc-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentStreamEvent.streamedText}
                    </ReactMarkdown>
                  </div>
                )}

                {!currentStreamEvent.streamedText && currentStreamEvent.status!=='searching' && (
                  <div className="flex items-center gap-2 p-3 text-xs text-zinc-400 font-mono">
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:0.2s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:0.4s]" />
                    <span className="ml-1 text-[11px] text-zinc-400">
                      Reasoning & synthesizing delta...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 md:p-6 border-t border-[#27272a] bg-[#0c0c0e]/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-[#121214] border border-[#27272a] focus-within:border-zinc-500 rounded-xl p-2 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onKeyDown={(e)=>{
                if (e.key==='Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask anything or check recent updates..."
              rows={1}
              className="flex-1 bg-transparent border-0 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 resize-none px-3 py-2 max-h-40"
              disabled={isLoading}
            />
            <button
              onClick={()=>handleSubmit()}
              disabled={!input.trim() || isLoading}
              className="h-8 w-8 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white text-black flex items-center justify-center transition-all flex-shrink-0"
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 text-center mt-2 font-mono">
            Ground truth verified via live <code>web_search</code>. Press Enter to send, Shift+Enter for newline.
          </p>
        </div>
      </main>
    </div>
  );
}
