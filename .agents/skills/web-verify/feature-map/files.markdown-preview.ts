import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.markdown-preview',
  route: '/',
  reach:
    'Review → Files → README.md → right-click → Open file → Reader or Source',
  behaviour:
    'A Markdown file opened from the file tree reads as formatted text and switches to its source, and one too large to read as text is not shown and says why.',
  server: ['files.read-text-file'],
  spec: 'apps/web/spec/browser/files-markdown-preview.browser.ts',
} satisfies JourneyEntry;
