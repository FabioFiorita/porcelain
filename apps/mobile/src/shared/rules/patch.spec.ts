import { describe, expect, it } from 'vitest';
import { diffRows } from './patch.ts';

describe('diffRows', () => {
  it('keeps independent old/new gutters, hunk labels and literal source in sparse hunks', () => {
    const rows = diffRows(
      {
        kind: 'text',
        patch: [
          'diff --git a/view.ts b/view.ts',
          '--- a/view.ts',
          '+++ b/view.ts',
          '@@ -2,3 +2,3 @@ function view()',
          ' unchanged',
          '-old()',
          '+<script>alert("literal")</script>',
          ' end',
          '@@ -40 +42 @@',
          '-before',
          '+after',
          '',
        ].join('\n'),
      },
      [
        {
          oldFileName: 'a/view.ts',
          newFileName: 'b/view.ts',
          hunks: [
            {
              oldStart: 2,
              newStart: 2,
              oldLines: 3,
              newLines: 3,
              lines: [
                ' unchanged',
                '-old()',
                '+<script>alert("literal")</script>',
                ' end',
              ],
            },
            {
              oldStart: 40,
              newStart: 42,
              oldLines: 1,
              newLines: 1,
              lines: ['-before', '+after'],
            },
          ],
        },
      ],
    );
    expect(
      rows.map(({ kind, text, oldLine, newLine }) => ({
        kind,
        text,
        oldLine,
        newLine,
      })),
    ).toEqual([
      {
        kind: 'header',
        text: 'view.ts',
        oldLine: undefined,
        newLine: undefined,
      },
      {
        kind: 'hunk',
        text: '@@ -2,3 +2,3 @@ function view()',
        oldLine: undefined,
        newLine: undefined,
      },
      { kind: 'context', text: 'unchanged', oldLine: 2, newLine: 2 },
      { kind: 'deletion', text: 'old()', oldLine: 3, newLine: undefined },
      {
        kind: 'addition',
        text: '<script>alert("literal")</script>',
        oldLine: undefined,
        newLine: 3,
      },
      { kind: 'context', text: 'end', oldLine: 4, newLine: 4 },
      {
        kind: 'hunk',
        text: '@@ -40 +42 @@',
        oldLine: undefined,
        newLine: undefined,
      },
      { kind: 'deletion', text: 'before', oldLine: 40, newLine: undefined },
      { kind: 'addition', text: 'after', oldLine: undefined, newLine: 42 },
    ]);
    expect(rows[4]!.accessibilityLabel).toBe(
      'Added line 3: <script>alert("literal")</script>',
    );
    expect(rows[7]!.accessibilityLabel).toBe('Deleted line 40: before');
    expect(rows[2]!.accessibilityLabel).toBe(
      'Old line 2, new line 2: unchanged',
    );
    expect(rows[4]).toEqual({
      id: 'file-diff-row-4',
      kind: 'addition',
      text: '<script>alert("literal")</script>',
      newLine: 3,
      accessibilityLabel: 'Added line 3: <script>alert("literal")</script>',
      tokens: [
        { text: '<script>alert(', kind: 'plain' },
        { text: '"literal"', kind: 'string' },
        { text: ')</script>', kind: 'plain' },
      ],
    });
  });

  it('starts added/deleted files at line one and keeps missing-final-newline notices', () => {
    const rows = diffRows(
      {
        kind: 'text',
        patch: [
          'diff --git a/new.txt b/new.txt',
          'new file mode 100644',
          '--- /dev/null',
          '+++ b/new.txt',
          '@@ -0,0 +1 @@',
          '+new',
          '\\ No newline at end of file',
          'diff --git a/old.txt b/old.txt',
          'deleted file mode 100755',
          '--- a/old.txt',
          '+++ /dev/null',
          '@@ -1 +0,0 @@',
          '-old',
          '\\ No newline at end of file',
          '',
        ].join('\n'),
      },
      [
        {
          oldFileName: '/dev/null',
          newFileName: 'b/new.txt',
          isCreate: true,
          hunks: [
            {
              oldStart: 1,
              newStart: 1,
              oldLines: 0,
              newLines: 1,
              lines: ['+new', '\\ No newline at end of file'],
            },
          ],
        },
        {
          oldFileName: 'a/old.txt',
          newFileName: '/dev/null',
          isDelete: true,
          hunks: [
            {
              oldStart: 1,
              newStart: 1,
              oldLines: 1,
              newLines: 0,
              lines: ['-old', '\\ No newline at end of file'],
            },
          ],
        },
      ],
    );
    expect(
      rows.map((row) => [
        row.kind,
        row.text,
        row.oldLine ?? null,
        row.newLine ?? null,
      ]),
    ).toEqual([
      ['header', 'new.txt', null, null],
      ['metadata', 'new file mode 100644', null, null],
      ['hunk', '@@ -0,0 +1 @@', null, null],
      ['addition', 'new', null, 1],
      ['notice', '\\ No newline at end of file', null, null],
      ['header', 'old.txt', null, null],
      ['metadata', 'deleted file mode 100755', null, null],
      ['hunk', '@@ -1 +0,0 @@', null, null],
      ['deletion', 'old', 1, null],
      ['notice', '\\ No newline at end of file', null, null],
    ]);
  });

  it('presents rename, copy and mode changes even without text hunks', () => {
    expect(
      diffRows(
        {
          kind: 'metadata-only',
          patch: [
            'diff --git a/old name.ts b/new name.ts',
            'similarity index 100%',
            'rename from old name.ts',
            'rename to new name.ts',
            'old mode 100644',
            'new mode 100755',
            'diff --git a/source.ts b/copy.ts',
            'similarity index 100%',
            'copy from source.ts',
            'copy to copy.ts',
            '',
          ].join('\n'),
        },
        [
          {
            oldFileName: 'a/old name.ts',
            newFileName: 'b/new name.ts',
            hunks: [],
          },
          { oldFileName: 'a/source.ts', newFileName: 'b/copy.ts', hunks: [] },
        ],
      ).map((row) => row.text),
    ).toEqual([
      'new name.ts',
      'similarity index 100%',
      'rename from old name.ts',
      'rename to new name.ts',
      'old mode 100644',
      'new mode 100755',
      'Metadata changes only.',
      'copy.ts',
      'similarity index 100%',
      'copy from source.ts',
      'copy to copy.ts',
      'Metadata changes only.',
    ]);
  });

  it('preserves parsed Unicode names beside original Git octal headers', () => {
    expect(
      diffRows(
        {
          kind: 'metadata-only',
          patch: [
            'diff --git "a/caf\\303\\251.ts" "b/caf\\303\\251-new.ts"',
            'rename from "caf\\303\\251.ts"',
            'rename to "caf\\303\\251-new.ts"',
          ].join('\n'),
        },
        [{ oldFileName: 'a/café.ts', newFileName: 'b/café-new.ts', hunks: [] }],
      ).map((row) => row.text),
    ).toEqual([
      'café-new.ts',
      'rename from café.ts',
      'rename to café-new.ts',
      'Metadata changes only.',
    ]);
  });

  it('labels every contract non-text state and keeps an optional file header', () => {
    expect(
      diffRows({ kind: 'binary' }, undefined, 'image.png').map(
        (row) => row.text,
      ),
    ).toEqual(['image.png', 'Binary file changed.']);
    expect(
      diffRows({ kind: 'omitted', reason: 'size-limit' }, undefined).map(
        (row) => row.text,
      ),
    ).toEqual(['Diff omitted: file exceeds the size limit.']);
    expect(
      diffRows(
        { kind: 'omitted', reason: 'unsupported-encoding' },
        undefined,
      ).map((row) => row.text),
    ).toEqual(['Diff omitted: unsupported file encoding.']);
    expect(
      diffRows(
        { kind: 'omitted', reason: 'unsupported-submodule' },
        undefined,
      ).map((row) => row.text),
    ).toEqual(['Diff omitted: submodule changes are not supported.']);
    expect(
      diffRows({ kind: 'text', patch: '' }, undefined, 'empty.txt').map(
        (row) => row.text,
      ),
    ).toEqual(['empty.txt', 'No text changes.']);
    expect(
      diffRows(
        {
          kind: 'text',
          patch:
            'diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ\n',
        },
        [
          {
            oldFileName: 'a/image.png',
            newFileName: 'b/image.png',
            isBinary: true,
            hunks: [],
          },
        ],
      ).map((row) => row.text),
    ).toEqual(['image.png', 'Binary file changed.']);
  });

  it.each([
    {
      name: 'unparseable count mismatch',
      patch: '--- a/a.txt\n+++ b/a.txt\n@@ -1,2 +1,2 @@\n-old\n+new\n',
      files: undefined,
    },
    {
      name: 'invalid hunk header',
      patch: '--- a/a.txt\n+++ b/a.txt\n@@ broken @@\n-old\n+new\n',
      files: [
        {
          oldFileName: 'a/a.txt',
          newFileName: 'b/a.txt',
          hunks: [
            {
              oldStart: 1,
              newStart: 1,
              oldLines: 1,
              newLines: 1,
              lines: ['-old', '+new'],
            },
          ],
        },
      ],
    },
    {
      name: 'invalid line-zero range',
      patch: '--- a/a.txt\n+++ b/a.txt\n@@ -0 +0 @@\n-old\n+new\n',
      files: [
        {
          oldFileName: 'a/a.txt',
          newFileName: 'b/a.txt',
          hunks: [
            {
              oldStart: 0,
              newStart: 0,
              oldLines: 1,
              newLines: 1,
              lines: ['-old', '+new'],
            },
          ],
        },
      ],
    },
    {
      name: 'unparsed extra source',
      patch: '--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+new\n+extra\n',
      files: [
        {
          oldFileName: 'a/a.txt',
          newFileName: 'b/a.txt',
          hunks: [
            {
              oldStart: 1,
              newStart: 1,
              oldLines: 1,
              newLines: 1,
              lines: ['-old', '+new'],
            },
          ],
        },
      ],
    },
    {
      name: 'no parsed files',
      patch: 'not a patch\n<script>literal</script>\n',
      files: [],
    },
    {
      name: 'unsupported combined diff',
      patch: 'diff --cc merged.ts\n@@@ -1 -1 +1 @@@\n++combined\n',
      files: [
        { oldFileName: 'a/merged.ts', newFileName: 'b/merged.ts', hunks: [] },
      ],
    },
    {
      name: 'unsupported trailing metadata',
      patch:
        '--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+new\nunknown metadata\n',
      files: [
        {
          oldFileName: 'a/a.txt',
          newFileName: 'b/a.txt',
          hunks: [
            {
              oldStart: 1,
              newStart: 1,
              oldLines: 1,
              newLines: 1,
              lines: ['-old', '+new'],
            },
          ],
        },
      ],
    },
  ])('preserves $name literally', ({ patch, files }) => {
    const rows = diffRows({ kind: 'text', patch }, files);
    expect(rows[0]?.text).toBe(
      'Diff could not be parsed. Original patch follows.',
    );
    expect(
      rows
        .slice(1)
        .map((row) => row.text)
        .join('\n'),
    ).toBe(patch);
    expect(
      rows.every(
        (row) => row.oldLine === undefined && row.newLine === undefined,
      ),
    ).toBe(true);
  });
});

describe('prepared source tokens', () => {
  it('keeps source literal while treating bounded strings, keywords, numbers and comments', () => {
    expect(
      diffRows(
        {
          kind: 'text',
          patch:
            '--- /dev/null\n+++ b/a.ts\n@@ -0,0 +1 @@\n+const n = "// text" + 42; // comment\n',
        },
        [
          {
            oldFileName: '/dev/null',
            newFileName: 'b/a.ts',
            hunks: [
              {
                oldStart: 1,
                newStart: 1,
                oldLines: 0,
                newLines: 1,
                lines: ['+const n = "// text" + 42; // comment'],
              },
            ],
          },
        ],
      ).find((row) => row.kind === 'addition')?.tokens,
    ).toEqual([
      { text: 'const', kind: 'keyword' },
      { text: ' n = ', kind: 'plain' },
      { text: '"// text"', kind: 'string' },
      { text: ' + ', kind: 'plain' },
      { text: '42', kind: 'number' },
      { text: '; ', kind: 'plain' },
      { text: '// comment', kind: 'comment' },
    ]);
    expect(
      diffRows(
        {
          kind: 'text',
          patch:
            '--- /dev/null\n+++ b/a.py\n@@ -0,0 +1 @@\n+return "<script>" # comment\n',
        },
        [
          {
            oldFileName: '/dev/null',
            newFileName: 'b/a.py',
            hunks: [
              {
                oldStart: 1,
                newStart: 1,
                oldLines: 0,
                newLines: 1,
                lines: ['+return "<script>" # comment'],
              },
            ],
          },
        ],
      ).find((row) => row.kind === 'addition')?.tokens,
    ).toEqual([
      { text: 'return', kind: 'keyword' },
      { text: ' ', kind: 'plain' },
      { text: '"<script>"', kind: 'string' },
      { text: ' ', kind: 'plain' },
      { text: '# comment', kind: 'comment' },
    ]);
    expect(
      diffRows(
        {
          kind: 'text',
          patch:
            '--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1 @@\n+  \t<unsafe>& literal\n',
        },
        [
          {
            oldFileName: '/dev/null',
            newFileName: 'b/a.txt',
            hunks: [
              {
                oldStart: 1,
                newStart: 1,
                oldLines: 0,
                newLines: 1,
                lines: ['+  \t<unsafe>& literal'],
              },
            ],
          },
        ],
      ).find((row) => row.kind === 'addition')?.tokens,
    ).toEqual([{ text: '  \t<unsafe>& literal', kind: 'plain' }]);
  });
});
