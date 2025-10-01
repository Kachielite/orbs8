export type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

export interface GetQuery<T> {
  page: number;
  limit: number;
  search?: string;
  sort?: keyof T | string;
  order?: OrderDirection;
}
