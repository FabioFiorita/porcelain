import * as accessErrors from '@porcelain/access/errors';
import * as changesErrors from '@porcelain/changes/errors';
import * as filesErrors from '@porcelain/files/errors';
import * as gitActionsErrors from '@porcelain/git-actions/errors';
import * as projectsErrors from '@porcelain/projects/errors';
import * as reviewsErrors from '@porcelain/reviews/errors';
import * as gitActions from '@porcelain/git/actions';
import * as gitDiscovery from '@porcelain/git/discovery';
import * as gitHistory from '@porcelain/git/history';
import * as gitInspection from '@porcelain/git/inspection';
import * as kernelErrors from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { toStatusResponse } from './status-policy.ts';

const domainErrors: Record<string, Record<string, unknown>> = {
  access: accessErrors,
  changes: changesErrors,
  files: filesErrors,
  'git-actions': gitActionsErrors,
  projects: projectsErrors,
  reviews: reviewsErrors,
  'git/actions': gitActions,
  'git/discovery': gitDiscovery,
  'git/history': gitHistory,
  'git/inspection': gitInspection,
  kernel: kernelErrors,
};

function withoutConstructing(value: unknown): unknown[] {
  if (typeof value !== 'function' || !Error.isPrototypeOf(value)) return [];
  const prototype: unknown = Reflect.get(value, 'prototype');
  if (typeof prototype !== 'object' || prototype === null) return [];
  const instance: unknown = Object.create(prototype);
  return [instance];
}

function errorClasses(): { name: string; instance: unknown }[] {
  return Object.entries(domainErrors).flatMap(([domain, exports]) =>
    Object.entries(exports).flatMap(([name, value]) =>
      withoutConstructing(value).map((instance) => ({
        name: `${domain}/${name}`,
        instance,
      })),
    ),
  );
}

describe('status policy', () => {
  it('finds the error classes every domain exports', () => {
    expect(errorClasses().length).toBeGreaterThan(
      Object.keys(domainErrors).length,
    );
  });

  it('answers every domain and Git error with a deliberate status instead of an unexpected failure', () => {
    const unexpected = errorClasses()
      .filter(({ instance }) => toStatusResponse(instance).statusCode === 500)
      .map(({ name }) => name);
    expect(unexpected).toEqual([]);
  });

  it('answers an unknown failure as an unexpected failure', () => {
    expect(toStatusResponse(new Error('boom')).statusCode).toBe(500);
  });
});
