import { ApiProperty } from '@nestjs/swagger';

export const PAGINATED_DATA_EXAMPLE: any[] = []; // reusable example variable for the `data` property

export class PaginatedResponseDto<T> {
  @ApiProperty({
    isArray: true,
    description: 'The data for the current page',
    example: PAGINATED_DATA_EXAMPLE,
  })
  public data: T[];

  @ApiProperty({
    description: 'Total number of records',
    example: 100,
  })
  public total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  public page: number;

  @ApiProperty({
    description: 'Page size',
    example: '50',
  })
  public limit: number;

  @ApiProperty({
    description: 'Whether a next page exists',
    example: true,
  })
  public hasNext: boolean;

  @ApiProperty({
    description: 'Whether a previous page exists',
    example: false,
  })
  public hasPrev: boolean;

  constructor(
    data: T[],
    total: number,
    page: number,
    limit: number,
    hasNext: boolean,
    hasPrev: boolean,
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.hasNext = hasNext;
    this.hasPrev = hasPrev;
  }
}
