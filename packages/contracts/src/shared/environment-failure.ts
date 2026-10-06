import { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { httpFailure } from './http-failure.ts';

export const environmentUnavailable = httpFailure(
  MissingEnvironmentIdentityError,
  'ServiceUnavailable',
  {
    message: 'Operation unavailable',
  },
);
