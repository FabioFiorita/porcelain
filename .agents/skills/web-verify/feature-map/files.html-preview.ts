import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.html-preview',
  route: '/',
  reach: 'Review → Files → page.html',
  behaviour:
    'An HTML page opened from the file tree previews in a sandboxed frame with its local images inlined, and names the references it could not load.',
  server: ['files.read-preview-assets', 'files.read-text-file'],
  spec: 'apps/web/spec/browser/files-html-preview.browser.ts',
} satisfies JourneyEntry;
