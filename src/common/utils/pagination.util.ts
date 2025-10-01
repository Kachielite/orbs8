import { GetQuery } from '../interfaces/query.interface';

export interface PaginationParams<T> {
  query: GetQuery<T>;
  allowedSortFields: Array<keyof T>;
  defaultSortField?: keyof T;
}

export interface PaginationResult {
  skip: number;
  take: number;
  order: Record<string, 'ASC' | 'DESC'>;
  search?: string;
  page: number;
  limit: number;
}

export const paginationUtil = <T>(params: PaginationParams<T>): PaginationResult => {
  const { query, allowedSortFields, defaultSortField } = params;
  const { page, limit, search, sort, order } = query;

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (safePage - 1) * safeLimit;
  const take = safeLimit;

  // Use the provided defaultSortField or the first allowed field as fallback
  const fallbackSortField = defaultSortField || allowedSortFields[0];

  // More flexible sort field handling - convert string to keyof T
  let sortField: keyof T;
  if (sort && typeof sort === 'string') {
    // Check if the string sort value matches any allowed field
    const matchingField = allowedSortFields.find((field) => String(field) === sort);
    sortField = matchingField || fallbackSortField;
  } else {
    sortField = (sort as keyof T) || fallbackSortField;
  }

  // Ensure the final sort field is in the allowed list
  if (!allowedSortFields.includes(sortField)) {
    sortField = fallbackSortField;
  }

  // Handle both uppercase and lowercase order directions
  const orderRaw = (order || 'DESC').toString().toUpperCase();
  const orderDir: 'ASC' | 'DESC' = orderRaw === 'ASC' ? 'ASC' : 'DESC';
  const orderParam = { [sortField as string]: orderDir } as Record<string, 'ASC' | 'DESC'>;

  return {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
    order: orderParam,
    search: search?.trim(),
  };
};
