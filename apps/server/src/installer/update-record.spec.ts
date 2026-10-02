import { describe, expect, it } from 'vitest';
import {
  presentedUpdate,
  publishedVersion,
  STOPPED_EARLY,
} from './update-record.ts';

const installing = {
  from: '1.0.0',
  target: '1.1.0',
  stage: 'installing' as const,
};

describe('presentedUpdate', () => {
  it('reports an unfinished update while its updater still runs', () => {
    expect(presentedUpdate(installing, true)).toEqual({
      ...installing,
      reason: undefined,
    });
  });

  it('reports an unfinished update whose updater is gone as stopped early', () => {
    expect(presentedUpdate(installing, false)).toEqual({
      ...installing,
      stage: 'failed',
      reason: STOPPED_EARLY,
    });
  });

  it('keeps a finished update and its reason', () => {
    const failed = { ...installing, stage: 'failed' as const, reason: 'npm' };
    expect(presentedUpdate(failed, false)).toEqual(failed);
    expect(
      presentedUpdate({ ...installing, stage: 'updated' }, false)?.stage,
    ).toBe('updated');
  });

  it('reports nothing before any update, and the update once one is recorded', () => {
    expect(presentedUpdate(undefined, false)).toBeUndefined();
    expect(presentedUpdate(installing, true)).toEqual({
      from: '1.0.0',
      target: '1.1.0',
      stage: 'installing',
      reason: undefined,
    });
  });
});

describe('publishedVersion', () => {
  it('reads the version npm prints as JSON', () => {
    expect(publishedVersion('"1.2.3"\n')).toBe('1.2.3');
  });

  it.each([
    ['output that is not JSON', 'npm ERR! 404'],
    ['a list of versions', '["1.2.3"]'],
    ['a string that is no version', '"latest"'],
  ])('reads nothing from %s, unlike a version printed as JSON', (_, output) => {
    expect(publishedVersion(output)).toBeUndefined();
    expect(publishedVersion('"1.2.3"')).toBe('1.2.3');
  });
});
