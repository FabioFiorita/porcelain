import { expect, it } from 'vitest';
import { reviewTab } from './review-tab';

it.each([
  [false, undefined, { title: 'Changes', progress: undefined }],
  [undefined, undefined, { title: 'Review', progress: undefined }],
  [true, undefined, { title: 'Review', progress: undefined }],
  [true, [], { title: 'Review', progress: undefined }],
  [
    true,
    [{ reviewed: true }, { reviewed: false }, { reviewed: false }],
    { title: 'Review', progress: '1/3' },
  ],
  [true, [{ reviewed: true }], { title: 'Review', progress: '1/1' }],
] as const)(
  'names the first tab when published is %s with decisions %j',
  (published, decisions, tab) =>
    expect(reviewTab(published, decisions)).toEqual(tab),
);
