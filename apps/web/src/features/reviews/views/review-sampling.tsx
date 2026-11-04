import type {
  ReviewRevision,
  WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import { decisionKey } from '@porcelain/client/reviews/rules';
import { Button } from '@/components/ui/button';
export function ReviewSampling({
  revision,
  layerId,
  onGo,
}: {
  revision: ReviewRevision;
  layerId?: string;
  onGo: (key: WalkthroughKey) => void;
}) {
  const picks =
    revision.content.samples?.filter(
      (pick) => layerId === undefined || pick.layerId === layerId,
    ) ?? [];
  if (picks.length === 0) return null;
  return (
    <section
      aria-label="Suggested code samples"
      className="flex min-w-0 flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2"
    >
      <p className="text-xs font-medium">
        {picks.length === 1 ? 'Read this slice' : 'Read these two slices'}{' '}
        <span className="font-normal text-muted-foreground">
          · risk weighted, with a random pick
        </span>
      </p>
      <div className="flex flex-wrap gap-1">
        {picks.map((pick) => {
          const layer = revision.content.layers.find(
            (layer) => layer.id === pick.layerId,
          );
          const step = layer?.steps.find((step) => step.id === pick.stepId);
          return (
            <Button
              key={`${pick.layerId}:${pick.stepId}`}
              size="xs"
              variant="ghost"
              onClick={() => {
                onGo(decisionKey(pick.layerId));
                requestAnimationFrame(() =>
                  document
                    .getElementById(`slice-${pick.stepId}`)
                    ?.scrollIntoView({ block: 'start' }),
                );
              }}
            >
              {pick.sampled ? '✓ Sampled · ' : ''}
              {step?.title ?? 'Code slice'}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
