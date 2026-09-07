import { syncLegiScanStateBills } from '@/lib/legiscan-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await syncLegiScanStateBills();
    return Response.json(result, { status: result.failedScopes.length > 0 ? 500 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'State bill sync failed.';
    console.error('State bill sync failed:', message);
    return Response.json({ error: 'State bill sync failed.' }, { status: 500 });
  }
}
