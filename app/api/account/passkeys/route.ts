import { and, eq, sql } from 'drizzle-orm';
import { passkey, passkeyRecoveryCode, verification } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import { passkeyRecoveryIdentifierPrefix } from '@/lib/passkey-recovery';

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

export async function DELETE(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ error: 'This request did not come from the account page.' }, { status: 403 });
  }

  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to disable passkeys.' }, { status: 401 });

  const prefix = passkeyRecoveryIdentifierPrefix(session.user.id);
  await db.batch([
    db.delete(passkey).where(eq(passkey.userId, session.user.id)),
    db.delete(passkeyRecoveryCode).where(eq(passkeyRecoveryCode.userId, session.user.id)),
    db.delete(verification).where(and(
      sql`left(${verification.identifier}, ${prefix.length}) = ${prefix}`,
    )),
  ]);

  return Response.json({ enabled: false });
}
