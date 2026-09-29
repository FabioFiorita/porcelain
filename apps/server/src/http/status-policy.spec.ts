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
import { failureWorthLogging, toStatusResponse } from './status-policy.ts';

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

  it('identifies a changed file without relying on its message', () => {
    expect(toStatusResponse(new filesErrors.ContentChangedError())).toEqual({
      statusCode: 409,
      body: {
        statusCode: 409,
        error: 'Conflict',
        message: 'Content changed; retry the operation',
        code: 'content_changed',
      },
    });
  });

  it('identifies unsupported text without relying on its message', () => {
    expect(toStatusResponse(new filesErrors.UnsupportedTextError())).toEqual({
      statusCode: 422,
      body: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'File is not supported UTF-8 text',
        code: 'unsupported_text',
      },
    });
  });

  it('identifies files beyond the read limit without relying on its message', () => {
    expect(toStatusResponse(new filesErrors.FileTooLargeError())).toEqual({
      statusCode: 422,
      body: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'File exceeds the read limit',
        code: 'file_too_large',
      },
    });
  });

  it('identifies a changed worktree without relying on its message', () => {
    expect(toStatusResponse(new kernelErrors.WorktreeChangedError())).toEqual({
      statusCode: 409,
      body: {
        statusCode: 409,
        error: 'Conflict',
        message: 'Refresh status and retry inspection',
        code: 'worktree_changed',
      },
    });
  });
});

describe('failureWorthLogging', () => {
  const abandoned = new DOMException('The request was abandoned', 'AbortError');

  it('keeps quiet about a request its client abandoned, which is normal navigation', () => {
    expect(failureWorthLogging(abandoned, true)).toBe(false);
  });

  it('logs an abort that the client did not cause', () => {
    expect(failureWorthLogging(abandoned, false)).toBe(true);
  });

  it('logs a deadline even when the client has gone', () => {
    expect(
      failureWorthLogging(new DOMException('Too slow', 'TimeoutError'), true),
    ).toBe(true);
  });

  it('logs an unexpected failure whether or not the client stayed', () => {
    expect(failureWorthLogging(new Error('broken'), true)).toBe(true);
    expect(failureWorthLogging(new Error('broken'), false)).toBe(true);
  });

  it('does not log a failure answered below 500', () => {
    expect(
      failureWorthLogging(new accessErrors.InvalidPairingError(), false),
    ).toBe(false);
  });
});
