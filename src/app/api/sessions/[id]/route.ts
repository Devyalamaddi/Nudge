import {NextRequest,NextResponse} from 'next/server';
import {getSession,getMessages,deleteSession} from '@/lib/memory/storage';

export const dynamic='force-dynamic';

export async function GET(
  req:NextRequest,
  {params}:{params:{id:string}}
) {
  try {
    const session=getSession(params.id);
    if (!session) {
      return NextResponse.json({error:'Session not found'},{status:404});
    }
    const messages=getMessages(params.id);
    return NextResponse.json({session,messages});
  } catch (error:any) {
    return NextResponse.json({error:error.message},{status:500});
  }
}

export async function DELETE(
  req:NextRequest,
  {params}:{params:{id:string}}
) {
  try {
    const success=deleteSession(params.id);
    return NextResponse.json({success});
  } catch (error:any) {
    return NextResponse.json({error:error.message},{status:500});
  }
}
