import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { openAPI } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { Pool } from 'pg';

// Standalone Pool (not the app's PG_POOL DI token) so this file stays importable
// outside Nest's bootstrap — e.g. by `npx @better-auth/cli generate`.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // "hotels://" is the mobile app's scheme (see src/api/authClient.ts in the
  // hotels repo) — the expo() plugin below rewrites its `expo-origin` header
  // to `origin`, but that value still has to match something in here or
  // every request that carries a cookie (including plain email sign-in,
  // once any cookie - even a stray OAuth-state one - has been stored) fails
  // origin validation with MISSING_OR_NULL_ORIGIN/INVALID_ORIGIN.
  trustedOrigins: ['hotels://'],
  emailAndPassword: {
    enabled: true,
  },
  // Minimum required for @Hook/@BeforeHook/@AfterHook providers (see
  // AuthLoggingHook) to be able to register themselves. Empty on purpose —
  // hooks attach to this at runtime, not here.
  hooks: {},
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  // Without this, better-auth's default ID generator produces a nanoid-style
  // string, not a UUID, which fails against this schema's `uuid` columns.
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  user: {
    modelName: 'users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    // Required for App Store review (self-service account deletion). No
    // email sending is configured in this app yet, so there's no
    // verification-link callback step — /delete-user requires the
    // account's password directly instead.
    deleteUser: {
      enabled: true,
    },
  },
  session: {
    modelName: 'sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    // The OAuth "state" is already verified against a server-stored
    // verification record (see parseGenericState's database-strategy
    // branch) — that's the actual CSRF defense. This disables the
    // *secondary* check that the same signed "state" cookie set by
    // /expo-authorization-proxy comes back on the callback request, which
    // WebKit's anti-bounce-tracking cookie purging reliably strips on the
    // localhost -> provider -> localhost redirect every social login does
    // here (reproduced in ~1s with no 2FA involved — see
    // docs/considerations/github-oauth-state-mismatch.md). Applies only to
    // social-provider callbacks; email/password sign-in never touches this
    // code path.
    skipStateCookieCheck: true,
    modelName: 'accounts',
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      idToken: 'id_token',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  // Interactive reference for the auth routes at GET /api/auth/reference —
  // these routes are raw Express handlers, not Nest controllers, so they
  // don't appear in docs/openapi.json.
  //
  // expo() is the server-side counterpart to the mobile app's expoClient()
  // plugin (src/api/authClient.ts in the hotels repo) - without it,
  // /expo-authorization-proxy (which the app's social sign-in flow opens in
  // a system browser) doesn't exist at all, and the `expo-origin` header
  // the app sends on every request never gets promoted to `origin`.
  plugins: [expo(), openAPI()],
});
