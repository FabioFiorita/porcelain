import { expect, it } from 'vite-plus/test';
import { pickerError } from './picker-error';

it('leaves a failed project read to its own notice, so it shows once', () => {
  expect(
    pickerError(
      { kind: 'failed', source: 'inventory', message: 'Projects failed' },
      undefined,
    ),
  ).toBeUndefined();
});

it('reports saved-workspace failures and failed workspace changes', () => {
  expect(
    pickerError(
      { kind: 'failed', source: 'selection', message: 'Selection failed' },
      'Change failed',
    ),
  ).toBe('Selection failed');
  expect(pickerError({ kind: 'none' }, 'Change failed')).toBe('Change failed');
  expect(pickerError({ kind: 'loading' }, undefined)).toBeUndefined();
});
