import { Schema } from 'effect';
import { requestParseOptions } from '../shared/http-api.ts';
import { describe, expect, it } from 'vitest';
import {
  browseProjectFoldersQuerySchema,
  browseProjectFoldersResponseSchema,
  readInventoryResponseSchema,
  registerProjectRequestSchema,
  renameProjectRequestSchema,
} from './inventory.ts';

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
  it('requires null rather than silently accepting missing wire fields', () => {
    const broken = structuredClone(inventory);
    const project = broken.projects[0];
    const original = project?.worktrees[0];
    if (project === undefined || original === undefined)
      throw new Error('The fixture must have a worktree');
    const { branch: _branch, ...worktree } = original;
    expect(() =>
      Schema.decodeUnknownSync(readInventoryResponseSchema)({
        ...broken,
        projects: [{ ...project, worktrees: [worktree] }],
      }),
    ).toThrow();
  });
  it('encodes the root folder parent as null', () => {
    expect(
      Schema.encodeSync(browseProjectFoldersResponseSchema)({
        path: '/',
        parent: undefined,
        directories: [],
        repository: false,
        truncated: false,
      }),
    ).toEqual({
      path: '/',
      parent: null,
      directories: [],
      repository: false,
      truncated: false,
    });
  });
  it('trims a project name', () => {
    expect(
      Schema.decodeUnknownSync(
        renameProjectRequestSchema,
        requestParseOptions,
      )({ name: '  New name  ' }),
    ).toEqual({ name: 'New name' });
  });
  it.each([
    ['empty', { name: ' ' }],
    ['control', { name: 'bad\0name' }],
    ['unknown key', { name: 'name', projectId: id }],
  ])('rejects a project name with %s', (_reason, value) => {
    expect(() =>
      Schema.decodeUnknownSync(
        renameProjectRequestSchema,
        requestParseOptions,
      )(value),
    ).toThrow();
  });
  it('accepts an omitted browse path and rejects extra query keys', () => {
    const decode = Schema.decodeUnknownSync(
      browseProjectFoldersQuerySchema,
      requestParseOptions,
    );
    expect(decode({})).toEqual({});
    expect(() => decode({ path: '/', hidden: true })).toThrow();
  });
  it('accepts an absolute registration path', () => {
    expect(
      Schema.decodeUnknownSync(
        registerProjectRequestSchema,
        requestParseOptions,
      )({ path: '/srv/example' }),
    ).toEqual({ path: '/srv/example' });
  });
  it.each(['', '../example', '/bad\0path'])(
    'rejects the invalid registration path %s',
    (path) => {
      expect(() =>
        Schema.decodeUnknownSync(
          registerProjectRequestSchema,
          requestParseOptions,
        )({ path }),
      ).toThrow();
    },
  );
});
