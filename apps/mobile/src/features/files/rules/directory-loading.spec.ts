import { expect, test } from 'vitest';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { directoryLoading } from './directory-loading';

test('the first root read uses the header while opening folders loads only their rows', () => {
  expect(
    directoryLoading([{ path: '', result: AsyncResult.initial() }]),
  ).toEqual({ initialRoot: true, folders: new Set() });
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.success('root') },
      { path: 'src', result: AsyncResult.initial(true) },
      { path: 'docs', result: AsyncResult.success('docs') },
      { path: 'src/nested', result: AsyncResult.initial() },
    ]),
  ).toEqual({ initialRoot: false, folders: new Set(['src', 'src/nested']) });
});

test('refreshing loaded directories keeps every row indicator and the header still', () => {
  expect(
    directoryLoading([
      { path: 'docs', result: AsyncResult.success('docs', { waiting: true }) },
      { path: '', result: AsyncResult.success('root', { waiting: true }) },
      { path: 'src', result: AsyncResult.success('src') },
    ]),
  ).toEqual({ initialRoot: false, folders: new Set() });
});

test('settled failures stop loading; retry without a value loads the root header or folder row', () => {
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.fail('root') },
      { path: 'src', result: AsyncResult.fail('src') },
    ]),
  ).toEqual({ initialRoot: false, folders: new Set() });
  expect(
    directoryLoading([
      { path: '', result: AsyncResult.fail('root', { waiting: true }) },
      { path: 'src', result: AsyncResult.fail('src', { waiting: true }) },
    ]),
  ).toEqual({ initialRoot: true, folders: new Set(['src']) });
});

test('retry with a previous value keeps both root and folder indicators still', () => {
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
  ).toEqual({ initialRoot: false, folders: new Set() });
});
