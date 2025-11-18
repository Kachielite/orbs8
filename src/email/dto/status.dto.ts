import { ApiProperty } from '@nestjs/swagger';
import { EmailSyncStatus } from '../entities/email.entity';

export class StatusDto {
  @ApiProperty({ description: 'The status of the email sync service' })
  public syncStatus: EmailSyncStatus;
  @ApiProperty({ description: 'The last time the email sync service was synced' })
  public lastSyncAt?: Date;
  @ApiProperty({ description: 'The number of emails scanned during the last sync' })
  public emailsScanned: number;
  @ApiProperty({ description: 'The email label being synced' })
  public label: string;

  constructor(
    syncStatus: EmailSyncStatus,
    emailsScanned?: number,
    lastSyncAt?: Date,
    label?: string | null,
  ) {
    this.syncStatus = syncStatus;
    this.emailsScanned = emailsScanned || 0;
    this.lastSyncAt = lastSyncAt;
    this.label = label || '';
  }
}
