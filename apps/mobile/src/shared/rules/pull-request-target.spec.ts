import { expect, it } from 'vitest';
import { Option, Schema } from 'effect';
import { pullRequestTargetSchema } from './pull-request-target';

it('opens a pull request only from complete route parameters', () => {
  const decode = Schema.decodeUnknownOption(pullRequestTargetSchema);
  const target = {
    environmentId: 'desk',
    projectId: 'project',
    number: 42,
  };
  expect(decode(target)).toEqual(Option.some(target));
  expect(decode({ ...target, number: 0 })).toEqual(Option.none());
  expect(decode({ ...target, number: Number(undefined) })).toEqual(
    Option.none(),
  );
  expect(decode({ ...target, environmentId: undefined })).toEqual(
    Option.none(),
  );
});
