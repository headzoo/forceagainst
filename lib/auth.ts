import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { passkey } from '@better-auth/passkey';
import { betterAuth, getCurrentAdapter, type BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { captcha } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { user } from '@/db/schema';
import { db } from '@/lib/db';
import { normalizeUsername, usernameError } from '@/lib/username';
import {
  parsePasskeyRecoveryContext,
  readPasskeyRecoveryVerificationValue,
} from '@/lib/passkey-recovery';
import { sendVerificationEmail } from '@/lib/verification-email';

const developmentTurnstileSecret = '1x0000000000000000000000000000000AA';
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY
  ?? (process.env.NODE_ENV === 'development' ? developmentTurnstileSecret : 'TURNSTILE_SECRET_KEY_NOT_CONFIGURED');

const passkeyRecoverySchema = {
  id: 'passkey-recovery-schema',
  hooks: {
    after: [{
      matcher: (context) => context.path === '/passkey/generate-authenticate-options',
      handler: createAuthMiddleware(async (ctx) => {
        const returned = ctx.context.returned;
        if (!returned || typeof returned !== 'object' || returned instanceof Response) return;

        ctx.context.returned = {
          ...returned,
          // This expresses the user's no-PIN preference. Authenticators may still enforce a local unlock.
          userVerification: 'discouraged',
        };
      }),
    }],
  },
  schema: {
    passkeyRecoveryCode: {
      fields: {
        userId: {
          type: 'string',
          required: true,
          references: { model: 'user', field: 'id', onDelete: 'cascade' },
          index: true,
        },
        codeHash: { type: 'string', required: true, unique: true, returned: false },
        createdAt: { type: 'date', required: true },
        usedAt: { type: 'date', required: false },
      },
    },
  },
} satisfies BetterAuthPlugin;

export const auth = betterAuth({
  appName: 'Force Against',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: member, url }) => {
      await sendVerificationEmail({ email: member.email, name: member.name, url });
    },
  },
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (data) => {
          const rawUsername = (data as typeof data & { username?: unknown }).username;
          const username = normalizeUsername(typeof rawUsername === 'string' ? rawUsername : '');
          const error = usernameError(username);

          if (error) throw new APIError('BAD_REQUEST', { message: error });

          const existing = await db.select({ id: user.id }).from(user)
            .where(eq(user.username, username)).limit(1);
          if (existing.length > 0) {
            throw new APIError('BAD_REQUEST', { message: 'That username is already taken.' });
          }

          return { data: { ...data, username } };
        },
      },
      update: {
        before: async (data) => {
          const { username: _username, ...safeData } = data as typeof data & { username?: unknown };
          void _username;
          return { data: safeData };
        },
      },
    },
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  plugins: [
    passkeyRecoverySchema,
    passkey({
      rpName: 'Force Against',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'discouraged',
      },
      registration: {
        requireSession: false,
        resolveUser: async ({ ctx, context }) => {
          const recoveryContext = parsePasskeyRecoveryContext(context);
          if (!recoveryContext) {
            throw new APIError('UNAUTHORIZED', { message: 'That recovery request is invalid or expired.' });
          }

          const verification = await ctx.context.internalAdapter
            .findVerificationValue(recoveryContext.identifier);
          const recoveryUserId = verification
            ? readPasskeyRecoveryVerificationValue(verification.value)
            : null;
          if (recoveryUserId !== recoveryContext.userId) {
            throw new APIError('UNAUTHORIZED', { message: 'That recovery request is invalid or expired.' });
          }

          const [member] = await db.select({
            id: user.id,
            email: user.email,
            name: user.name,
          }).from(user).where(eq(user.id, recoveryUserId)).limit(1);
          if (!member) {
            throw new APIError('UNAUTHORIZED', { message: 'That recovery request is invalid or expired.' });
          }

          return { id: member.id, name: member.email, displayName: member.name };
        },
        afterVerification: async ({ ctx, context, user: recoveryUser }) => {
          if (!context) return { name: 'Passkey' };

          const recoveryContext = parsePasskeyRecoveryContext(context);
          if (!recoveryContext || recoveryContext.userId !== recoveryUser.id) {
            throw new APIError('UNAUTHORIZED', { message: 'That recovery request is invalid or expired.' });
          }

          const verification = await ctx.context.internalAdapter
            .consumeVerificationValue(recoveryContext.identifier);
          if (
            !verification
            || readPasskeyRecoveryVerificationValue(verification.value) !== recoveryUser.id
          ) {
            throw new APIError('UNAUTHORIZED', { message: 'That recovery request is invalid or expired.' });
          }

          const adapter = await getCurrentAdapter(ctx.context.adapter as Parameters<typeof getCurrentAdapter>[0]);
          await adapter.deleteMany({
            model: 'passkey',
            where: [{ field: 'userId', value: recoveryUser.id }],
          });
          await adapter.deleteMany({
            model: 'passkeyRecoveryCode',
            where: [{ field: 'userId', value: recoveryUser.id }],
          });
          await adapter.deleteMany({
            model: 'session',
            where: [{ field: 'userId', value: recoveryUser.id }],
          });

          return { userId: recoveryUser.id, name: 'Recovered passkey' };
        },
      },
    }),
    captcha({
      provider: 'cloudflare-turnstile',
      secretKey: turnstileSecretKey,
      endpoints: ['/sign-up/email'],
    }),
  ],
});
