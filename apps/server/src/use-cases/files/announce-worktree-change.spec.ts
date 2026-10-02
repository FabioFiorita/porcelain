import { describe, expect, it } from 'vitest';
import { InMemoryReviewedMarks } from '../../../spec/fakes/in-memory-reviewed-marks.ts';
import { RecordingEventPublisher } from '../../../spec/fakes/recording-event-publisher.ts';
import { AnnounceWorktreeChangeUseCase } from './announce-worktree-change.ts';

const MARKED = ['src/a.ts', 'src/b.ts', 'src/c.ts'];

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

function subject(invalidated: Promise<void> = Promise.resolve()) {
  const marks = new InMemoryReviewedMarks({ one: MARKED }, invalidated);
  const events = new RecordingEventPublisher();
  const announce = new AnnounceWorktreeChangeUseCase(marks, events, {
    failure: () => undefined,
  });
  return { marks, events, announce };
}

describe('AnnounceWorktreeChangeUseCase', () => {
  it('announces changed files only once the reviewed marks of those paths are invalidated', async () => {
    const invalidating = Promise.withResolvers<void>();
    const { marks, events, announce } = subject(invalidating.promise);
    const announced = announce.execute(
      { worktreeId: 'one', change: 'files', paths: ['src/a.ts', 'src/b.ts'] },
      {},
    );
    await settle();
    expect(events.announcedFiles('one')).toBeUndefined();
    invalidating.resolve();
    await announced;
    expect(marks.marksOf('one')).toEqual(['src/c.ts']);
    expect(events.announcedFiles('one')).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('invalidates every mark of the worktree before announcing a Git change', async () => {
    const { marks, events, announce } = subject();
    await announce.execute({ worktreeId: 'one', change: 'git' }, {});
    expect(marks.marksOf('one')).toEqual([]);
    expect(events.announcedChange('one')).toBe('git');
  });

  it('invalidates every mark when a change names no path', async () => {
    const { marks, announce } = subject();
    await announce.execute(
      { worktreeId: 'one', change: 'files', paths: [] },
      {},
    );
    expect(marks.marksOf('one')).toEqual([]);
  });

  it('still announces the change when the marks cannot be invalidated', async () => {
    const { events, announce } = subject(
      Promise.reject(new Error('The marks are unavailable')),
    );
    await announce.execute(
      { worktreeId: 'one', change: 'files', paths: ['src/a.ts'] },
      {},
    );
    expect(events.announcedFiles('one')).toEqual(['src/a.ts']);
  });
});
