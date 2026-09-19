// Manual Jest mock, e2e tests only: @bull-board/nestjs requires
// @nestjs/bull-shared synchronously, but that package declares
// `"type": "module"` — plain Node handles that fine, but Jest's ESM loader
// (--experimental-vm-modules) deterministically throws "Cannot require() ES
// Module ... it is currently being loaded by a concurrent import()".
// QueueBoardModule only uses this to mount a debug dashboard at /queues —
// irrelevant to what hotels.e2e-spec.ts actually tests — so it's stubbed out
// here rather than fixed at the source (that would mean changing how
// QueueBoardModule imports Bull Board, a separate piece of work).
import { DynamicModule } from '@nestjs/common';

export class BullBoardModule {
  static forRoot(): DynamicModule {
    return { module: BullBoardModule };
  }

  static forFeature(): DynamicModule {
    return { module: BullBoardModule };
  }

  static forRootAsync(): DynamicModule {
    return { module: BullBoardModule };
  }
}
