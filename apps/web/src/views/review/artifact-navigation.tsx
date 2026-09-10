import { FileBoxIcon } from 'lucide-react';
import type { ReviewScope } from '../../domain/review';
import { useArtifacts } from '../../query/review';
import { ReviewEmpty } from './review-empty';
import { ReviewRow } from './review-row';
export function ArtifactNavigation({
  scope,
  selected,
  onSelect,
}: {
  scope: ReviewScope;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const artifacts = useArtifacts(scope);
  if (!artifacts.length)
    return (
      <ReviewEmpty
        title="No artifacts yet"
        description="Artifacts associated with this worktree will appear here."
      />
    );
  return (
    <div className="flex flex-col gap-2">
      {artifacts.map((artifact) => (
        <ReviewRow
          key={artifact.id}
          label={artifact.name}
          detail={`${(artifact.sizeBytes / 1024).toFixed(1)} KB · ${artifact.createdAt.slice(0, 10)}`}
          selected={selected === artifact.id}
          onSelect={() => onSelect(artifact.id)}
          icon={<FileBoxIcon />}
        />
      ))}
      <p className="px-3 pt-3 text-xs leading-relaxed text-muted-foreground">
        Stored HTML · metadata only. Rendering and sharing are not available
        yet.
      </p>
    </div>
  );
}
