import { describe, expect, it } from 'vitest';
import { gitDirectoryName } from './git-directory-name.ts';

describe('gitDirectoryName', () => {
  it('names the folder Git keeps its repository in', () => {
    expect(gitDirectoryName()).toBe('.git');
  });
});
