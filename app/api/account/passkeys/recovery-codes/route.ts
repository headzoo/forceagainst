import { randomUUID } from 'node:crypto';
import { and, count, eq, sql } from 'drizzle-orm';
import { passkey, passkeyRecoveryCode, verification } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import {
  generatePasskeyRecoveryCodes,
  hashPasskeyRecoveryCode,
  passkeyRecoveryIdentifierPrefix,
} from '@/lib/passkey-recovery';

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  const trustedOrigins = [new URL(request.url).origin];
  if (process.env.BETTER_AUTH_URL) {
    try {
      trustedOrigins.push(new URL(process.env.BETTER_AUTH_URL).origin);
    } catch {
      // A malformed configured URL is not trusted.
    }
  }
  return trustedOrigins.includes(origin);
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ error: 'This request did not come from the account page.' }, { status: 403 });
  }

  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to create recovery codes.' }, { status: 401 });

  const [{ value: passkeyCount }] = await db.select({ value: count() })
    .from(passkey)
    .where(eq(passkey.userId, session.user.id));
  if (passkeyCount === 0) {
    return Response.json({ error: 'Enable a passkey before creating recovery codes.' }, { status: 409 });
  }

  const codes = generatePasskeyRecoveryCodes();
  const prefix = passkeyRecoveryIdentifierPrefix(session.user.id);
  await db.batch([
    db.delete(passkeyRecoveryCode).where(eq(passkeyRecoveryCode.userId, session.user.id)),
    db.delete(verification).where(and(
      sql`left(${verification.identifier}, ${prefix.length}) = ${prefix}`,
    )),
    db.insert(passkeyRecoveryCode).values(codes.map((code) => ({
      id: randomUUID(),
      userId: session.user.id,
      codeHash: hashPasskeyRecoveryCode(code),
      createdAt: new Date(),
    }))),
  ]);

  const body = [
    'FORCE AGAINST — PASSKEY RECOVERY CODES',
    '',
    'Each code can be used once to replace your passkey. Keep these somewhere safe.',
    'Creating another set invalidates every code in this file.',
    '',
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': 'attachment; filename="force-against-passkey-recovery-codes.txt"',
      'Content-Type': 'text/plain; charset=utf-8',
      Expires: '0',
      Pragma: 'no-cache',
    },
  });
}
