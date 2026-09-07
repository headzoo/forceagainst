import { syncCongressBills } from '@/lib/congress-bill-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await syncCongressBills();
    return Response.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Federal bill sync failed.';
    console.error('Federal bill sync failed:', message);
    return Response.json({ error: 'Federal bill sync failed.' }, { status: 500 });
  }
}
