import { HttpApi } from 'effect/http-api';

export const requestParseOptions = { onExcessProperty: 'error' } as const;
export const porcelainApi = HttpApi.make('porcelain')
  .annotate(HttpApi.ParamsParseOptions, requestParseOptions)
  .annotate(HttpApi.QueryParseOptions, requestParseOptions)
  .annotate(HttpApi.PayloadParseOptions, requestParseOptions);
