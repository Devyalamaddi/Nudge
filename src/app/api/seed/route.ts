import {NextResponse} from 'next/server';
import {resetToBenchmarks,getAllSessions} from '@/lib/memory/storage';

export const dynamic='force-dynamic';

export async function POST() {
  try {
    resetToBenchmarks();
    const sessions=getAllSessions();
    return NextResponse.json({
      success:true,
      sessions,
    });
  } catch (error:any) {
    return NextResponse.json({error:error.message},{status:500});
  }
}
