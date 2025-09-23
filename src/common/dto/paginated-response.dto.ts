export class PaginatedResponseDto<T> {
  public data: T[];
  public total: number;
  public page: number;
  public limit: number;
  public hasNext: boolean;
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
