import {NextRequest} from 'next/server';
import {runAgentTurn} from '@/lib/agent/orchestrator';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(req:NextRequest) {
  try {
    const {sessionId,message}=await req.json();

    if (!message || typeof message!=='string') {
      return new Response(JSON.stringify({error:'Message is required'}),{
        status:400,
        headers:{'Content-Type':'application/json'},
      });
    }

    const encoder=new TextEncoder();
    const stream=new TransformStream();
    const writer=stream.writable.getWriter();

    (async ()=>{
      try {
        await runAgentTurn({
          sessionId,
          userQuery:message,
          onEvent:(event)=>{
            const data=`data: ${JSON.stringify(event)}\n\n`;
            writer.write(encoder.encode(data));
          },
        });
      } catch (err:any) {
        const errorData=`data: ${JSON.stringify({
          type:'error',
          message:err.message||'An unexpected error occurred',
        })}\n\n`;
        writer.write(encoder.encode(errorData));
      } finally {
        writer.close();
      }
    })();

    return new Response(stream.readable,{
      headers:{
        'Content-Type':'text/event-stream',
        'Cache-Control':'no-cache, no-transform',
        'Connection':'keep-alive',
      },
    });
  } catch (error:any) {
    return new Response(JSON.stringify({error:error.message}),{
      status:500,
      headers:{'Content-Type':'application/json'},
    });
  }
}
