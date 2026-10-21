import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { readInventoryResponseSchema } from './inventory.ts';

const id = '21c20d74-aee9-4293-b9d2-66b6a4d46c26';
const inventory = {
  environmentId: id,
  environment: { name: 'Local computer', custom: false },
  projects: [
    {
      id,
      name: 'Example',
      available: true,
      worktrees: [
        {
          id: 'a'.repeat(32),
          path: '/srv/example',
          main: true,
          available: true,
          branch: null,
          status: null,
        },
      ],
    },
  ],
};

describe('Projects wire contracts', () => {
  it('keeps nullable branch and status on the wire while exposing absent values to the client', () => {
    const decoded = Schema.decodeUnknownSync(readInventoryResponseSchema)(
      inventory,
    );
    expect(decoded.projects[0]?.worktrees[0]).toEqual({
      id: 'a'.repeat(32),
      path: '/srv/example',
      main: true,
      available: true,
      branch: undefined,
      status: undefined,
    });
    expect(Schema.encodeSync(readInventoryResponseSchema)(decoded)).toEqual(
      inventory,
    );
  });
});
