import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  passkeyRecoveryAttempt,
  passkeyRecoveryCode,
  user,
  verification,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  createPasskeyRecoveryContext,
  hashPasskeyRecoveryCode,
  isPasskeyRecoveryCode,
  parsePasskeyRecoveryContext,
  passkeyRecoveryRateLimitKey,
  passkeyRecoveryVerificationValue,
  PASSKEY_RECOVERY_TTL_MS,
} from '@/lib/passkey-recovery';

const RECOVERY_WINDOW_SECONDS = 15 * 60;

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

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

async function consumeRecoveryAttempt(key: string, maximum: number) {
  const now = new Date();
  const [row] = await db.insert(passkeyRecoveryAttempt).values({
    key,
    windowStartedAt: now,
    requestCount: 1,
    expiresAt: new Date(now.getTime() + RECOVERY_WINDOW_SECONDS * 1_000),
  }).onConflictDoUpdate({
    target: passkeyRecoveryAttempt.key,
    set: {
      windowStartedAt: sql`CASE
        WHEN ${passkeyRecoveryAttempt.expiresAt} <= now() THEN now()
        ELSE ${passkeyRecoveryAttempt.windowStartedAt}
      END`,
      requestCount: sql`CASE
        WHEN ${passkeyRecoveryAttempt.expiresAt} <= now() THEN 1
        ELSE ${passkeyRecoveryAttempt.requestCount} + 1
      END`,
      expiresAt: sql`CASE
        WHEN ${passkeyRecoveryAttempt.expiresAt} <= now()
          THEN now() + make_interval(secs => ${RECOVERY_WINDOW_SECONDS})
        ELSE ${passkeyRecoveryAttempt.expiresAt}
      END`,
    },
  }).returning({ requestCount: passkeyRecoveryAttempt.requestCount });

  return Boolean(row && row.requestCount <= maximum);
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ error: 'This recovery request is not allowed.' }, { status: 403 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return Response.json({ error: 'Enter a valid email and recovery code.' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const code = typeof payload?.code === 'string' ? payload.code : '';
  if (!email || email.length > 320 || !isPasskeyRecoveryCode(code)) {
    return Response.json({ error: 'Enter a valid email and recovery code.' }, { status: 400 });
  }

  const [emailAllowed, ipAllowed] = await Promise.all([
    consumeRecoveryAttempt(passkeyRecoveryRateLimitKey('email', email), 5),
    consumeRecoveryAttempt(passkeyRecoveryRateLimitKey('ip', clientIp(request)), 20),
  ]);
  if (!emailAllowed || !ipAllowed) {
    return Response.json(
      { error: 'Too many recovery attempts. Wait 15 minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(RECOVERY_WINDOW_SECONDS) } },
    );
  }

  const [member] = await db.select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);

  if (!member) {
    return Response.json({ error: 'That email and recovery code do not match.' }, { status: 400 });
  }

  const context = createPasskeyRecoveryContext(member.id);
  const recoveryContext = parsePasskeyRecoveryContext(context)!;
  const expiresAt = new Date(Date.now() + PASSKEY_RECOVERY_TTL_MS);
  const verificationId = randomUUID();
  const result = await db.execute(sql`
    WITH consumed_code AS (
      UPDATE ${passkeyRecoveryCode}
      SET ${passkeyRecoveryCode.usedAt} = now()
      WHERE ${passkeyRecoveryCode.userId} = ${member.id}
        AND ${passkeyRecoveryCode.codeHash} = ${hashPasskeyRecoveryCode(code)}
        AND ${isNull(passkeyRecoveryCode.usedAt)}
      RETURNING ${passkeyRecoveryCode.userId}
    )
    INSERT INTO ${verification} (
      ${verification.id},
      ${verification.identifier},
      ${verification.value},
      ${verification.expiresAt},
      ${verification.createdAt},
      ${verification.updatedAt}
    )
    SELECT
      ${verificationId},
      ${recoveryContext.identifier},
      ${passkeyRecoveryVerificationValue(member.id)},
      ${expiresAt},
      now(),
      now()
    FROM consumed_code
    RETURNING ${verification.id}
  `);

  if (result.rows.length === 0) {
    return Response.json({ error: 'That email and recovery code do not match.' }, { status: 400 });
  }

  return Response.json(
    { context, expiresInSeconds: PASSKEY_RECOVERY_TTL_MS / 1_000 },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
