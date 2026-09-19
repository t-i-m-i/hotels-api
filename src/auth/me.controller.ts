import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@ApiTags('auth')
@Controller()
export class MeController {
  @Get('me')
  @ApiOkResponse({
    description: 'The signed-in user, from the BetterAuth session cookie.',
  })
  getMe(@Session() session: UserSession) {
    return session;
  }
}
