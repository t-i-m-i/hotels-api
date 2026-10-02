import { Module } from '@nestjs/common';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';
import { FirebasePushService } from './firebase-push.service';

@Module({
  controllers: [PushTokensController],
  providers: [PushTokensService, FirebasePushService],
  exports: [FirebasePushService],
})
export class PushNotificationsModule {}
