import {
  type GuideSource,
  type GuideSourceRead,
  guideSourceStatus,
} from '../../domain/guided-review';
import type { ReviewScope } from '../../domain/review';
import { CodeDocument } from './code-document';
import { fileEntry } from './diff-entries';
import {
  DocumentInteraction,
  useDocumentInteraction,
} from './document-interaction';

export function GuideSourcePanel({
  scope,
  source,
  read,
}: {
  scope: ReviewScope;
  source: GuideSource;
  read: GuideSourceRead;
}) {
  const interaction = useDocumentInteraction();
  if (read.kind === 'loading')
    return (
      <p role="status" className="p-4 text-sm">
        Loading source…
      </p>
    );
  if (read.kind === 'unavailable')
    return (
      <p role="alert" className="p-4 text-sm">
        {read.message}
      </p>
    );
  const status = guideSourceStatus(source, read.file);
  if (status !== 'current') {
    const message = {
      stale:
        'Source changed since this guide was published. Ask the agent to refresh the reference, or open the current full file without the old range.',
      unverified:
        'This server did not provide a source fingerprint. The guide cannot verify this range.',
      'invalid-range':
        'The referenced lines do not exist in this source. Ask the agent to correct the guide.',
      unavailable: 'The returned source does not match this reference.',
    }[status];
    return (
      <p role="alert" className="p-4 text-sm">
        {message}
      </p>
    );
  }
  const target = {
    filePath: source.path,
    comparison: { kind: 'file' as const },
    contentFingerprint: source.contentFingerprint,
  };
  return (
    <DocumentInteraction
      value={{
        ...interaction,
        reveal: {
          nonce: 0,
          anchor: {
            ...target,
            kind: 'codeRange',
            startLine: source.startLine,
            endLine: source.endLine,
          },
        },
      }}
    >
      <CodeDocument
        scope={scope}
        entries={[
          {
            ...fileEntry(
              `guide:${source.path}`,
              source.path,
              read.file.text,
              'Current working-tree source; not an index or commit snapshot',
            ),
            comment: target,
          },
        ]}
      />
    </DocumentInteraction>
  );
}
