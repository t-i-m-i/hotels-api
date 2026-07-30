import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HotelsModule } from './hotels/hotels.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HotelsModule],
})
export class AppModule {}
