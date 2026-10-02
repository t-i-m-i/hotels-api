import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { PushTokensService } from './push-tokens.service';

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class FirebasePushService {
  private readonly logger = new Logger(FirebasePushService.name);
  private readonly messaging: Messaging | null;

  constructor(
    private readonly config: ConfigService,
    private readonly pushTokensService: PushTokensService,
  ) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    // .env stores the PEM key with literal "\n" sequences (real newlines
    // aren't valid in a single-line env var) — turn them back into real
    // newlines before handing the key to firebase-admin.
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.messaging = null;
      return;
    }

    const app = getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
    this.messaging = getMessaging(app);
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    if (!this.messaging) {
      this.logger.warn(
        `Firebase credentials not set — skipping push notification for user ${userId}`,
      );
      return;
    }

    const tokens = await this.pushTokensService.getTokensForUser(userId);
    if (tokens.length === 0) {
      this.logger.warn(`No device push tokens registered for user ${userId}`);
      return;
    }

    await Promise.all(tokens.map((token) => this.sendToToken(token, payload)));
  }

  private async sendToToken(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    if (!this.messaging) {
      return;
    }
    try {
      await this.messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      // These codes mean the token is dead (uninstalled app, expired,
      // reissued) — clean it up so we stop trying to send to it.
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        this.logger.warn(`Removing stale push token: ${token}`);
        await this.pushTokensService.remove(token);
        return;
      }
      this.logger.error(`Failed to send push notification to ${token}`, err);
    }
  }
}
