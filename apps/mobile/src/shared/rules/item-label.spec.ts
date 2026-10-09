import { expect, it } from 'vitest';
import { itemAccessibilityLabel } from './item-label.ts';

it('leaves status badges and connection-error children in the native announcement', () => {
  expect(
    itemAccessibilityLabel({
      title: 'Development',
      hasAdditionalContent: true,
    }),
  ).toBeUndefined();
  expect(
    itemAccessibilityLabel({
      title: 'Development',
      description: 'Remote server',
      hasAdditionalContent: true,
    }),
  ).toBeUndefined();
});

it('labels plain rows and respects an explicit announcement', () => {
  expect(
    itemAccessibilityLabel({
      title: 'Development',
      description: 'Remote server',
      hasAdditionalContent: false,
    }),
  ).toBe('Development. Remote server');
  expect(
    itemAccessibilityLabel({
      title: 'Development',
      hasAdditionalContent: false,
    }),
  ).toBe('Development');
  expect(
    itemAccessibilityLabel({
      title: 'Development',
      accessibilityLabel: 'Development. Offline. Connection refused.',
      hasAdditionalContent: true,
    }),
  ).toBe('Development. Offline. Connection refused.');
});
