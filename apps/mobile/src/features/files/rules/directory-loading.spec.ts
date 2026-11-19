import { expect, test } from 'vitest';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { directoryLoading } from './directory-loading';

test('only the first root read is pending; opening folders never is', () => {
  expect(
    directoryLoading([{ path: '', result: AsyncResult.initial() }]),
  ).toEqual({ rootLoaded: false, initialRoot: true });
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.success('root') },
      { path: 'src', result: AsyncResult.initial(true) },
      { path: 'docs', result: AsyncResult.success('docs') },
      { path: 'src/nested', result: AsyncResult.initial() },
    ]),
  ).toEqual({ rootLoaded: true, initialRoot: false });
});

test('refreshing loaded directories is not pending', () => {
  expect(
    directoryLoading([
      { path: 'docs', result: AsyncResult.success('docs', { waiting: true }) },
      { path: '', result: AsyncResult.success('root', { waiting: true }) },
      { path: 'src', result: AsyncResult.success('src') },
    ]),
  ).toEqual({ rootLoaded: true, initialRoot: false });
});

test('settled failures stop pending; retrying a root without a value is pending', () => {
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.fail('root') },
      { path: 'src', result: AsyncResult.fail('src') },
    ]),
  ).toEqual({ rootLoaded: false, initialRoot: false });
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.fail('root', { waiting: true }) },
      { path: 'src', result: AsyncResult.fail('src', { waiting: true }) },
    ]),
  ).toEqual({ rootLoaded: false, initialRoot: true });
});

test('retrying with a previous value is not pending', () => {
  expect(
    directoryLoading([
      {
        path: '',
        result: AsyncResult.fail('root', {
          waiting: true,
          previousSuccess: Option.some(AsyncResult.success('root')),
        }),
      },
      {
        path: 'src',
        result: AsyncResult.fail('src', {
          waiting: true,
          previousSuccess: Option.some(AsyncResult.success('src')),
        }),
      },
    ]),
  ).toEqual({ rootLoaded: true, initialRoot: false });
});

test('the root is loaded only when its own read has a value, including an empty root or retained value', () => {
  expect(directoryLoading([]).rootLoaded).toBe(false);
  expect(
    directoryLoading([
      { path: 'src', result: AsyncResult.success({ entries: [] }) },
    ]).rootLoaded,
  ).toBe(false);
  expect(
    directoryLoading([{ path: '', result: AsyncResult.initial(true) }])
      .rootLoaded,
  ).toBe(false);
  expect(
    directoryLoading([{ path: '', result: AsyncResult.fail('offline') }])
      .rootLoaded,
  ).toBe(false);
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.success({ entries: [] }) },
    ]).rootLoaded,
  ).toBe(true);
  expect(
    directoryLoading([
      {
        path: '',
        result: AsyncResult.success({ entries: ['file'] }, { waiting: true }),
      },
    ]).rootLoaded,
  ).toBe(true);
  expect(
    directoryLoading([
      {
        path: '',
        result: AsyncResult.fail('offline', {
          previousSuccess: Option.some(AsyncResult.success({ entries: [] })),
          waiting: true,
        }),
      },
    ]).rootLoaded,
  ).toBe(true);
});
