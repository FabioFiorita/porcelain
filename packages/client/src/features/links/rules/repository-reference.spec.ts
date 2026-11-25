import { describe, expect, it } from 'vite-plus/test';
import { repositoryReference } from './repository-reference.ts';

describe('repositoryReference', () => {
  it('resolves a relative reference against the folder of the document', () => {
    expect(repositoryReference('docs/guide.md', '../assets/logo.svg')).toEqual({
      kind: 'repository',
      path: 'assets/logo.svg',
      hash: '',
    });
    expect(repositoryReference('README.md', './docs/guide.md#setup')).toEqual({
      kind: 'repository',
      path: 'docs/guide.md',
      hash: '#setup',
    });
    expect(repositoryReference('site/index.html', 'about.html?x=1')).toEqual({
      kind: 'repository',
      path: 'site/about.html',
      hash: '',
    });
  });

  it('reads a leading slash as the repository root, never the disk root', () => {
    expect(repositoryReference('docs/guide.md', '/assets/a.png')).toEqual({
      kind: 'repository',
      path: 'assets/a.png',
      hash: '',
    });
  });

  it('decodes escaped names and still keeps them inside the repository', () => {
    expect(repositoryReference('README.md', 'my%20notes/a.png')).toEqual({
      kind: 'repository',
      path: 'my notes/a.png',
      hash: '',
    });
    expect(repositoryReference('docs/a.md', '%2e%2e/b.png')).toEqual({
      kind: 'repository',
      path: 'b.png',
      hash: '',
    });
  });

  it.each([
    ['two folders up from docs/', '../../secret.png'],
    ['a detour that ends above the root', 'a/../../../secret.png'],
    ['escaped slashes', '..%2f..%2fetc/passwd'],
    ['escaped dots', '%2e%2e/%2e%2e/etc/passwd'],
    ['a root-relative climb', '/../etc/passwd'],
  ])('refuses %s, which climbs above the repository', (_, reference) => {
    expect(repositoryReference('docs/guide.md', reference)).toEqual({
      kind: 'refused',
    });
  });

  it.each([
    ['backslashes', '..\\..\\secret.png'],
    ['escaped backslashes', 'a%5c..%5c..%5csecret.png'],
    ['a null byte', 'a%00.png'],
    ['a malformed escape', '%E0%A4%A.png'],
    ['the Git folder', '.git/config'],
    ['the Git folder in another case', 'sub/.GIT/HEAD'],
    ['a protocol-relative host', '//evil.example/x.png'],
    ['an empty reference', ''],
    ['a blank reference', '   '],
    ['the current folder', '.'],
    ['the repository root', 'docs/..'],
  ])('refuses %s', (_, reference) => {
    expect(repositoryReference('README.md', reference)).toEqual({
      kind: 'refused',
    });
  });

  it('keeps fragments in the page and passes web links outside', () => {
    expect(repositoryReference('README.md', '#usage')).toEqual({
      kind: 'fragment',
      hash: '#usage',
    });
    expect(repositoryReference('README.md', 'https://example.com/a')).toEqual({
      kind: 'external',
      url: 'https://example.com/a',
    });
  });

  it.each([
    ['a script URL', 'javascript:alert(1)'],
    ['a script URL in mixed case', 'JaVaScRiPt:alert(1)'],
    ['a data URL', 'data:text/html,<script>alert(1)</script>'],
    ['a file URL', 'file:///etc/passwd'],
    ['a VBScript URL', 'vbscript:x'],
    ['a blob URL', 'blob:https://example.com/x'],
    ['a web link with credentials', 'https://user:pass@example.com/'],
  ])('refuses %s', (_, reference) => {
    expect(repositoryReference('README.md', reference)).toEqual({
      kind: 'refused',
    });
  });

  it('never turns a scheme broken by whitespace into a link outside', () => {
    expect(repositoryReference('README.md', 'java\nscript:alert(1)').kind).toBe(
      'repository',
    );
  });
});
