import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { user } from '@/db/schema';
import { db } from '@/lib/db';
import { normalizeUsername, usernameError } from '@/lib/username';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
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
});
