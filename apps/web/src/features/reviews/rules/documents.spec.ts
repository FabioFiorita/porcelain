import { describe, expect, it } from 'vitest';
import { workspaceTitle } from './documents.ts';

describe('workspaceTitle', () => {
  it('names the open file by its name, then the project', () => {
    expect(
      workspaceTitle({
        entry: 'file:src/app/main.tsx',
        surface: 'files',
        project: 'porcelain',
      }),
    ).toBe('main.tsx — porcelain');
  });

  it('names a change and a branch file by the file name', () => {
    expect(
      workspaceTitle({
        entry: 'change:README.md',
        surface: undefined,
        project: 'p',
      }),
    ).toBe('README.md — p');
    expect(
      workspaceTitle({
        entry: 'branch:docs/a.md',
        surface: undefined,
        project: 'p',
      }),
    ).toBe('a.md — p');
  });

  it('names a commit by its short id', () => {
    expect(
      workspaceTitle({
        entry: `commit:${'a1b2c3d4'.repeat(5)}`,
        surface: 'history',
        project: 'p',
      }),
    ).toBe('a1b2c3d — p');
  });

  it('names the commit graph', () => {
    expect(
      workspaceTitle({ entry: 'graph', surface: 'history', project: 'p' }),
    ).toBe('Commit graph — p');
  });

  it('names the surface when no document is open', () => {
    expect(
      workspaceTitle({ entry: undefined, surface: 'history', project: 'p' }),
    ).toBe('History — p');
    expect(
      workspaceTitle({ entry: '', surface: undefined, project: 'p' }),
    ).toBe('Changes — p');
  });

  it('leaves the project out when it is unknown', () => {
    expect(
      workspaceTitle({
        entry: 'handoff',
        surface: undefined,
        project: undefined,
      }),
    ).toBe('Changes');
  });

  it('ends with the name the owner gave this computer', () => {
    expect(
      workspaceTitle({
        entry: 'file:src/app.ts',
        surface: undefined,
        project: 'p',
        environment: 'Workstation',
      }),
    ).toBe('app.ts — p · Workstation');
  });
});
