import { describe, expect, it } from 'vitest';
import { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { FixedEnvironmentIdentityStore } from '../../spec/fakes/fixed-environment-identity-store.ts';
import { ReadEnvironmentService } from './read-environment-service.ts';

describe('ReadEnvironmentService', () => {
  it('reports the identity this server keeps', () => {
    const environmentId = 'e0000000-0000-4000-8000-000000000001';
    const service = new ReadEnvironmentService(
      new FixedEnvironmentIdentityStore(environmentId),
    );
    expect(service.execute()).toEqual({ environmentId });
  });

  it('refuses to answer when the server has no identity', () => {
    const service = new ReadEnvironmentService(
      new FixedEnvironmentIdentityStore(undefined),
    );
    expect(() => service.execute()).toThrow(MissingEnvironmentIdentityError);
  });
});
