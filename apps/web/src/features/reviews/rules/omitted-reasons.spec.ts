import { expect, test } from 'vitest';
import { omittedReasonText } from './omitted-reasons';

test('repeated comparison reasons appear once while distinct reasons keep their order', () => {
  expect(
    omittedReasonText([
      'Content omitted: Too large to show',
      'Binary change',
      'Content omitted: Too large to show',
      'Binary change',
    ]),
  ).toBe('Content omitted: Too large to show, Binary change');
  expect(omittedReasonText(['Not readable'])).toBe('Not readable');
  expect(omittedReasonText([])).toBe('');
});
