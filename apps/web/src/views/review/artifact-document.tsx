import { formatDistanceToNowStrict } from 'date-fns';
import type {
  Artifact,
  ArtifactContent,
  ReviewScope,
} from '../../domain/review';
import { artifactKind } from '../../domain/review';
import { useArtifactContents, useArtifacts } from '../../query/review';
import { DocumentToolbar } from './document-toolbar';
import { HANDOFF_ARTIFACT_NAMES } from './handoff-artifact';
import { HtmlFrame } from './html-frame';
import { MarkdownView } from './markdown-view';
import { ReviewEmpty } from './review-empty';

/**
 * An agent upload opens as its own document. The lookup stays ID-addressed so
 * a stale tab cannot turn an artifact name into a different server resource.
 */
export function ArtifactDocument({
  scope,
  artifactId,
}: {
  scope: ReviewScope;
  artifactId: string;
}) {
  const artifact = useArtifacts(scope).find((item) => item.id === artifactId);
  const [content] = useArtifactContents(
    scope,
    artifact == null ? [] : [artifact.id],
  );

  if (!artifact)
    return (
      <ReviewEmpty
        title="Artifact unavailable"
        description="This upload is no longer available for the selected worktree."
      />
    );
  if (!content)
    return (
      <ReviewEmpty
        title="Artifact content unavailable"
        description="This upload no longer has readable content for the selected worktree."
      />
    );

  return <ArtifactDetails artifact={artifact} content={content} />;
}

/** The compact artifact document: metadata belongs in the artifact list, not above the report. */
export function ArtifactDetails({
  artifact,
  content,
}: {
  artifact: Artifact;
  content: ArtifactContent;
}) {
  const kind = artifactKind(artifact.name, content.content);
  const title =
    artifact.name === HANDOFF_ARTIFACT_NAMES.html ? 'Report' : artifact.name;
  const subtitle = `From the agent · ${formatDistanceToNowStrict(new Date(artifact.createdAt), { addSuffix: true })}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      <DocumentToolbar title={title} subtitle={subtitle} />
      {kind === 'html' ? (
        <HtmlFrame
          html={content.content}
          title={artifact.name}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {kind === 'markdown' ? (
            <MarkdownView
              text={content.content}
              className="mx-auto max-w-[78ch] px-6 py-4"
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs">
              {content.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
