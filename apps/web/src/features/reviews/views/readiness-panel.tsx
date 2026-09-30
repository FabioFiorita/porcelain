import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
} from 'lucide-react';
import { Suspense } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAccessStore } from '@/features/access/index';
import { useBranchChanges } from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import { useReviewedMarks } from '../queries/reviewed';
import type { CommentThread } from '../rules/comments';
import {
  type ReadinessItem,
  type ReadinessKey,
  readinessItems,
  readinessSummary,
  type ReadinessTone,
} from '../rules/readiness';
import {
  mergeBranchChanges,
  type ReviewResponse,
  type ReviewScope,
  type ReviewStatus,
} from '../rules/review';
import { branchReviewRange, type ReviewsContext } from '../rules/reviewed';

type Select = (key: ReadinessKey, firstStale: string | undefined) => void;

export function ChangeReadiness({
  files,
  review,
  threads,
  onSelect,
}: {
  files: readonly { path: string; reviewStatus: ReviewStatus }[];
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  return (
    <ReadinessCard
      items={readinessItems({ files, review, explains: true, threads })}
      onSelect={(key) =>
        onSelect(key, files.find((file) => file.reviewStatus === 'stale')?.path)
      }
    />
  );
}

export function BranchReadiness({
  scope,
  context,
  base,
  review,
  threads,
  onSelect,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  base: string | undefined;
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const connection = useAccessStore((state) => state.connection);
  const changes = useBranchChanges(scope, connection, base);
  if (changes.data?.base == null) return null;
  return (
    <Suspense fallback={null}>
      <BranchReadinessMarks
        scope={scope}
        context={context}
        branch={changes.data}
        review={review}
        threads={threads}
        onSelect={onSelect}
      />
    </Suspense>
  );
}

function BranchReadinessMarks({
  scope,
  context,
  branch,
  review,
  threads,
  onSelect,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  branch: NonNullable<ReturnType<typeof useBranchChanges>['data']>;
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const marks = useReviewedMarks(scope, context, branchReviewRange(branch));
  if (branch.base == null) return null;
  const files = mergeBranchChanges(branch.files, marks);
  return (
    <ReadinessCard
      items={readinessItems({ files, review, explains: false, threads })}
      onSelect={(key) =>
        onSelect(key, files.find((file) => file.reviewStatus === 'stale')?.path)
      }
    />
  );
}

function ReadinessCard({
  items,
  onSelect,
}: {
  items: readonly ReadinessItem[];
  onSelect: (key: ReadinessKey) => void;
}) {
  const tone: ReadinessTone = items.some((item) => item.tone === 'failing')
    ? 'failing'
    : items.some((item) => item.tone === 'attention')
      ? 'attention'
      : 'ok';
  return (
    <section
      aria-label="Readiness"
      className="mx-2 mt-2 shrink-0 rounded-lg border bg-muted/20"
    >
      <Collapsible defaultOpen className="group/readiness">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-accent"
            />
          }
        >
          <ToneIcon tone={tone} />
          <span className="font-medium">Readiness</span>
          <span
            className={cn(
              'ml-auto truncate text-[11.5px] text-muted-foreground',
              tone === 'failing' && 'text-destructive',
            )}
          >
            {readinessSummary(items)}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-closed/readiness:-rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="px-1 pb-1">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground',
                    item.tone === 'failing' && 'font-medium text-destructive',
                  )}
                  onClick={() => onSelect(item.key)}
                >
                  <ToneIcon tone={item.tone} />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function ToneIcon({ tone }: { tone: ReadinessTone }) {
  if (tone === 'ok')
    return (
      <CircleCheckIcon aria-hidden className="size-3.5 shrink-0 text-graph-2" />
    );
  if (tone === 'failing')
    return (
      <CircleXIcon aria-hidden className="size-3.5 shrink-0 text-destructive" />
    );
  return (
    <CircleAlertIcon aria-hidden className="size-3.5 shrink-0 text-graph-4" />
  );
}
