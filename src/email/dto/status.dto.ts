import { ApiProperty } from '@nestjs/swagger';

export class StatusDto {
  @ApiProperty({ description: 'The status of the email sync service' })
  public connected: boolean;
  @ApiProperty({ description: 'The last time the email sync service was synced' })
  public lastSyncAt?: Date;
  @ApiProperty({ description: 'The number of emails scanned during the last sync' })
  public emailsScanned: number;

  constructor(connected: boolean, emailsScanned?: number, lastSyncAt?: Date) {
    this.connected = connected;
    this.emailsScanned = emailsScanned || 0;
    this.lastSyncAt = lastSyncAt;
  }
}
