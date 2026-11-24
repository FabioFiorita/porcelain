import { expect, it } from 'vite-plus/test';
import { mobileTimingMarks } from './mobile-timing';

it('marks the first saved and first live Worktrees layouts independently', () => {
  const events: string[] = [];
  const marks = mobileTimingMarks((name) => {
    events.push(name);
  });
  marks.worktreeLayout(true).onLayout();
  marks.worktreeLayout(true).onLayout();
  expect(events).toEqual(['worktrees-first-saved-row']);
  marks.worktreeLayout(false).onLayout();
  marks.worktreeLayout(false).onLayout();
  expect(events).toEqual(['worktrees-first-saved-row', 'worktrees-first-row']);
});
