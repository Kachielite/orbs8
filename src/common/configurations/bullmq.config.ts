import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { host: 'localhost', port: 6379 },
      defaultJobOptions: {
        attempts: 3, // Max number of attempts for failed jobs
        removeOnComplete: 1000, // Keep data for the last 1000 completed jobs
        removeOnFail: 3000, // Keep data for the last 3000 failed jobs
        backoff: 2000, // Wait at least 2 seconds before attempting the job again, after failure
      },
    }),
    BullModule.registerQueue({ name: 'email-sync' }),
  ],
})
export class BullmqConfigModule {}
