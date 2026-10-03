import type { z } from 'zod';
import { apiErrorSchema, type ApiErrorCode } from './api-error.ts';

const errorResponses = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
  413: apiErrorSchema,
  422: apiErrorSchema,
  429: apiErrorSchema,
  500: apiErrorSchema,
  502: apiErrorSchema,
  503: apiErrorSchema,
};

type EndpointSchema = {
  params?: z.ZodType;
  querystring?: z.ZodType;
  body?: z.ZodType;
  response: Readonly<Record<number, z.ZodType>>;
};

export type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  prefix: string;
  format: 'json' | 'text';
  schema: EndpointSchema;
  responses: Readonly<Record<number, z.ZodType>>;
  errors: Readonly<Partial<Record<ApiErrorCode, number>>>;
};

export function defineEndpoint<
  const Schema extends EndpointSchema,
  const Errors extends Endpoint['errors'],
>(definition: {
  method: Endpoint['method'];
  path: string;
  prefix?: string;
  format?: Endpoint['format'];
  schema: Schema;
  errors: Errors;
  errorResponses?: false;
}): {
  method: Endpoint['method'];
  path: string;
  prefix: string;
  format: Endpoint['format'];
  schema: Schema & { response: Readonly<Record<number, z.ZodType>> };
  responses: Schema['response'];
  errors: Errors;
} {
  return {
    method: definition.method,
    path: definition.path,
    prefix: definition.prefix ?? '/api',
    format: definition.format ?? 'json',
    schema: {
      ...definition.schema,
      response: {
        ...(definition.errorResponses === false ? {} : errorResponses),
        ...definition.schema.response,
      },
    },
    responses: definition.schema.response,
    errors: definition.errors,
  };
}

type InputField<Schema, Key extends string> = Key extends keyof Schema
  ? Schema[Key] extends z.ZodType
    ? { [Field in Key]: z.output<Schema[Key]> }
    : {}
  : {};

export type EndpointRequest<Api extends Endpoint> = InputField<
  Api['schema'],
  'params'
> &
  InputField<Api['schema'], 'body'> &
  (Api['schema'] extends { querystring: infer Query extends z.ZodType }
    ? { query: z.output<Query> }
    : {}) & { signal?: AbortSignal };

export type EndpointResponse<Api extends Endpoint> = z.output<
  Api['responses'][keyof Api['responses']]
>;

export function endpointPath(
  endpoint: Endpoint,
  input: { params?: unknown; query?: unknown } = {},
) {
  const params = endpoint.schema.params?.encode(input.params);
  const path = endpoint.path.replace(
    /:([A-Za-z][A-Za-z0-9]*)/g,
    (_, name: string) => {
      const value: unknown =
        params === undefined || params === null
          ? undefined
          : typeof params === 'object'
            ? Reflect.get(params, name)
            : undefined;
      if (typeof value !== 'string')
        throw new Error(`Missing endpoint parameter: ${name}`);
      return encodeURIComponent(value);
    },
  );
  const parameters = new URLSearchParams();
  const query = endpoint.schema.querystring?.encode(input.query);
  if (typeof query === 'object' && query !== null)
    for (const [name, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      )
        throw new Error(`Invalid endpoint query parameter: ${name}`);
      parameters.set(name, String(value));
    }
  const queryString = parameters.toString();
  const suffix = queryString === '' ? '' : `?${queryString}`;
  return `${endpoint.prefix}${path}${suffix}`;
}
