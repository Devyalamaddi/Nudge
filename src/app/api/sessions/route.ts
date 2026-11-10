import {NextRequest,NextResponse} from 'next/server';
import {getAllSessions,createSession} from '@/lib/memory/storage';

export const dynamic='force-dynamic';

export async function GET() {
  try {
    const sessions=getAllSessions();
    return NextResponse.json({sessions});
  } catch (error:any) {
    return NextResponse.json({error:error.message},{status:500});
  }
}

export async function POST(req:NextRequest) {
  try {
    const body=await req.json().catch(()=>({}));
    const title=body.title||'New Conversation';
    const session=createSession(title);
    return NextResponse.json({session});
  } catch (error:any) {
    return NextResponse.json({error:error.message},{status:500});
  }
}
