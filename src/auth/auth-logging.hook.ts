// Logs every BetterAuth request/response (sign-in, sign-up, session, ...).
// These routes are mounted as raw middleware by @thallesp/nestjs-better-auth
// (see AuthModule.configure() in node_modules), not as Nest controllers, so
// @UseInterceptors(LoggingInterceptor) never sees them — this hook is
// BetterAuth's own equivalent for routes outside Nest's interceptor pipeline.
//
// Toggle with AUTH_DEBUG_LOGGING=true in .env — leave unset/false in normal
// dev so request bodies (which include plaintext passwords) aren't logged
// by default.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AfterHook,
  BeforeHook,
  Hook,
  type AuthHookContext,
} from '@thallesp/nestjs-better-auth';

@Hook()
@Injectable()
export class AuthLoggingHook {
  private readonly logger = new Logger('BetterAuth');

  constructor(private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return this.config.get('AUTH_DEBUG_LOGGING') === 'true';
  }

  @BeforeHook()
  logRequest(ctx: AuthHookContext) {
    if (!this.enabled) return;
    this.logger.log({
      direction: 'in',
      path: ctx.path,
      body: ctx.body as unknown,
      headers: ctx.headers,
    });
  }

  @AfterHook()
  logResponse(ctx: AuthHookContext) {
    if (!this.enabled) return;
    this.logger.log({
      direction: 'out',
      path: ctx.path,
      returned: ctx.context.returned,
    });
  }
}
