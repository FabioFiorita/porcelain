import { expect, test } from 'vitest';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { directoryLoading } from './directory-loading';

test('the first root read uses the header while opening folders loads only their rows', () => {
  expect(directoryLoading([''], [AsyncResult.initial()])).toEqual({
    initialRoot: true,
    folders: new Set(),
  });
  expect(
    directoryLoading(
      ['', 'src', 'docs', 'src/nested'],
      [
        AsyncResult.success('root'),
        AsyncResult.initial(true),
        AsyncResult.success('docs'),
        AsyncResult.initial(),
      ],
    ),
  ).toEqual({ initialRoot: false, folders: new Set(['src', 'src/nested']) });
});

test('refreshing loaded directories keeps the header still and marks only pending folders', () => {
  expect(
    directoryLoading(
      ['docs', '', 'src'],
      [
        AsyncResult.success('docs', { waiting: true }),
        AsyncResult.success('root', { waiting: true }),
        AsyncResult.success('src'),
      ],
    ),
  ).toEqual({ initialRoot: false, folders: new Set(['docs']) });
});

test('settled failures stop loading; retry without a root value uses the header', () => {
  expect(
    directoryLoading(
      ['', 'src'],
      [AsyncResult.fail('root'), AsyncResult.fail('src')],
    ),
  ).toEqual({ initialRoot: false, folders: new Set() });
  expect(
    directoryLoading([''], [AsyncResult.fail('root', { waiting: true })]),
  ).toEqual({ initialRoot: true, folders: new Set() });
  expect(
    directoryLoading(
      ['', 'src'],
      [
        AsyncResult.fail('root', {
          waiting: true,
          previousSuccess: Option.some(AsyncResult.success('root')),
        }),
        AsyncResult.fail('src', { waiting: true }),
      ],
    ),
  ).toEqual({ initialRoot: false, folders: new Set(['src']) });
});
