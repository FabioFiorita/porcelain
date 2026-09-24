import { describe, expect, it } from 'vitest';
import { InMemoryReviewTextReader } from '../../spec/fakes/in-memory-review-text-reader.ts';
import { ReadReviewTextsService } from './read-review-texts-service.ts';

const worktreeId = 'a'.repeat(64);

describe('ReadReviewTextsService', () => {
  it('maps every asked path to its text', async () => {
    const service = new ReadReviewTextsService(
      new InMemoryReviewTextReader(
        new Map([
          ['README.md', 'readme\n'],
          ['src/main.ts', 'main\n'],
          ['other.md', 'other\n'],
        ]),
      ),
    );
    const texts = await service.execute({
      worktreeId,
      paths: ['README.md', 'src/main.ts'],
    });
    expect(Object.fromEntries(texts)).toEqual({
      'README.md': 'readme\n',
      'src/main.ts': 'main\n',
    });
  });

  it('reads nothing when no path is asked', async () => {
    const service = new ReadReviewTextsService(
      new InMemoryReviewTextReader(new Map([['README.md', 'readme\n']])),
    );
    expect((await service.execute({ worktreeId, paths: [] })).size).toBe(0);
  });
});
