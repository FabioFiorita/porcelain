import { queryOptions } from '@tanstack/react-query';
import { accessApi } from '../api';

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ['access', 'session'],
    queryFn: ({ signal }) => accessApi.session.restore(signal),
  });
}
