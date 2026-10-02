import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID, IsString, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({ example: 'bf721a73-1a8b-4de2-b74b-a747e1197d3f' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: 'f3a1c9...:APA91b...' })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({ enum: ['ios', 'android'], example: 'ios' })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
