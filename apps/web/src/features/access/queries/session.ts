import { queryKeys } from '@porcelain/client/transport';
import { queryOptions } from '@tanstack/react-query';
import { accessApi } from '../api';

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.session(),
    queryFn: ({ signal }) => accessApi.session.restore({ signal }),
  });
}
