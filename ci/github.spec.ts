import { describe, expect, it } from 'vite-plus/test';
import { labeledOnHead } from './github.ts';

const repository = 'owner/repo';
const number = 42;
const ref = 'refs/heads/feature';
const openingHead = 'a'.repeat(40);
const laterHead = 'b'.repeat(40);
const createdAt = '2026-11-18T12:00:10Z';

function label(name: string, created_at = createdAt, event = 'labeled') {
  return { event, created_at, label: { name }, commit_id: null };
}

function githubHistory({
  events,
  head = openingHead,
  activity = { after: openingHead, ref, timestamp: '2026-11-18T12:00:08Z' },
}: {
  events: ReturnType<typeof label>[];
  head?: string;
  activity?: { after: string; ref: string; timestamp: string } | null;
}) {
  const request = (args: readonly string[]) => {
    switch (args.at(-1)) {
      case `repos/${repository}/pulls/${number}`:
        return JSON.stringify({
          created_at: createdAt,
          head: { ref: 'feature', sha: head, repo: { full_name: repository } },
        });
      case `repos/${repository}/issues/${number}/timeline`:
        return JSON.stringify([
          [{ event: 'committed', sha: openingHead }, ...events],
        ]);
      case `repos/${repository}/activity?ref=refs%2Fheads%2Ffeature&per_page=1`:
        return JSON.stringify(activity ? [activity] : []);
      default:
        throw new Error(`Unexpected GitHub request ${String(args)}`);
    }
  };
  return (name: string) =>
    labeledOnHead(repository, number, name, head, request);
}

describe('labels on the pull request head', () => {
  it('recovers reviewed applied at opening when its label job did not save the head', () => {
    const marked = githubHistory({ events: [label('reviewed')] });
    expect(marked('reviewed')).toBe(true);
  });

  it.each([
    ['reviewed', 'approved'],
    ['approved', 'reviewed'],
  ])(
    'recovers %s and %s added in the same second as opening',
    (first, second) => {
      const marked = githubHistory({
        events: [label(first), label(second)],
      });
      expect(marked(first)).toBe(true);
      expect(marked(second)).toBe(true);
    },
  );

  it('leaves a head pushed after the opening labels for review and approval', () => {
    const marked = githubHistory({
      events: [label('reviewed'), label('approved')],
      head: laterHead,
      activity: { after: laterHead, ref, timestamp: '2026-11-18T12:00:11Z' },
    });
    expect(marked('reviewed')).toBe(false);
    expect(marked('approved')).toBe(false);
  });

  it('recovers a label applied after a later push without a saved mark', () => {
    const marked = githubHistory({
      events: [label('reviewed', '2026-11-18T12:00:13Z')],
      head: laterHead,
      activity: { after: laterHead, ref, timestamp: '2026-11-18T12:00:12Z' },
    });
    expect(marked('reviewed')).toBe(true);
  });

  it.each([
    { after: laterHead, ref, timestamp: createdAt },
    { after: openingHead, ref, timestamp: '2026-11-18T12:00:08Z' },
    null,
  ])(
    'requires review when activity cannot prove which head was labeled (%j)',
    (activity) => {
      const marked = githubHistory({
        events: [label('reviewed')],
        head: laterHead,
        activity,
      });
      expect(marked('reviewed')).toBe(false);
    },
  );

  it('does not recover a label removed after it was added', () => {
    const marked = githubHistory({
      events: [
        label('reviewed'),
        label('reviewed', '2026-11-18T12:00:12Z', 'unlabeled'),
      ],
    });
    expect(marked('reviewed')).toBe(false);
  });

  it.each(['reviewed', 'approved'])(
    'recovers %s removed and added again in the same second after a push',
    (name) => {
      const second = '2026-11-18T12:00:13Z';
      const marked = githubHistory({
        events: [
          label(name),
          label(name, second, 'unlabeled'),
          label(name, second),
        ],
        head: laterHead,
        activity: { after: laterHead, ref, timestamp: '2026-11-18T12:00:12Z' },
      });
      expect(marked(name)).toBe(true);
    },
  );

  it('does not recover a label added and removed in the same second', () => {
    const second = '2026-11-18T12:00:13Z';
    const marked = githubHistory({
      events: [
        label('reviewed', second),
        label('reviewed', second, 'unlabeled'),
      ],
    });
    expect(marked('reviewed')).toBe(false);
  });
});
