import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { PushTokensService } from './push-tokens.service';
import { RegisterPushTokenDto } from './push-token.dto';

// TODO(auth): once BetterAuth is wired into this app, derive `userId` from
// the authenticated session instead of trusting the request body — anyone
// can currently register a token against an arbitrary userId.
@ApiTags('push-tokens')
@AllowAnonymous()
@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Push token registered' })
  register(@Body() dto: RegisterPushTokenDto): Promise<void> {
    return this.pushTokensService.register(dto);
  }
}
