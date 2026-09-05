import { syncCongress } from '@/lib/government-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await syncCongress();
    return Response.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Congress roster sync failed.';
    console.error('Congress roster sync failed:', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
