import { describe, expect, it } from 'vitest';
import { entryKey, HANDOFF, parseEntry } from './documents';

describe('document references', () => {
  it('round trips every supported document kind', () => {
    const refs = [
      HANDOFF,
      { kind: 'layer', layerId: 'layer-1' },
      { kind: 'change', path: 'src/app.tsx' },
      { kind: 'file', path: 'README.md' },
      { kind: 'commit', oid: 'a'.repeat(40) },
      { kind: 'artifact', name: 'handoff.html' },
    ] as const;

    for (const ref of refs) {
      expect(parseEntry(entryKey(ref))).toEqual(ref);
    }
  });

  it('drops malformed and obsolete surface entries', () => {
    expect(parseEntry(undefined)).toBeNull();
    expect(parseEntry('git:push')).toBeNull();
    expect(parseEntry('commit:not-an-oid')).toBeNull();
    expect(parseEntry('file:')).toBeNull();
  });
});
