import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'files.image-preview',
  route: '/',
  reach: 'Review → Files → logo.svg, or data.bin → right-click → Open file',
  behaviour:
    'An image opened from the file tree shows as a picture, and a binary file is not shown as text and says why.',
  server: ['files.read-file-asset', 'files.read-text-file'],
  spec: 'apps/web/spec/browser/files-image-preview.browser.ts',
} satisfies JourneyEntry;
