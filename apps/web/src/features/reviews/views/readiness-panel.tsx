import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
} from 'lucide-react';
import { Suspense } from 'react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useBranchChanges } from '@/features/changes/index';
import { cn } from '@/shared/lib/utils';
import { useReviewedMarks } from '../queries/reviewed';
import type { CommentThread } from '@porcelain/client/reviews/rules';
import {
  type ReadinessItem,
  type ReadinessKey,
  readinessItems,
  readinessSummary,
  type ReadinessTone,
} from '@porcelain/client/reviews/rules';
import {
  mergeBranchChanges,
  type ReviewResponse,
  type ReviewScope,
  type ReviewStatus,
} from '@porcelain/client/reviews/rules';
import { branchReviewRange } from '@porcelain/client/reviews/rules';
import { type ConnectionContext } from '@/shared/workspace/connection';

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
  context: ConnectionContext;
  base: string | undefined;
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const { connection } = context;
  const changes = useBranchChanges(scope, connection, base);
  const branch = Option.getOrUndefined(AsyncResult.value(changes.result));
  if (branch?.base === null || branch?.base === undefined) return null;
  return (
    <Suspense fallback={null}>
      <BranchReadinessMarks
        scope={scope}
        context={context}
        branch={branch}
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
  context: ConnectionContext;
  branch: AsyncResult.AsyncResult.Success<
    ReturnType<typeof useBranchChanges>['result']
  >;
  review: ReviewResponse | null;
  threads: readonly CommentThread[];
  onSelect: Select;
}) {
  const marks = useReviewedMarks(scope, context, branchReviewRange(branch));
  if (branch.base === null || branch.base === undefined) return null;
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
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-caption hover:bg-accent"
            />
          }
        >
          <ToneIcon tone={tone} />
          <span className="font-medium">Readiness</span>
          <span
            className={cn(
              'ml-auto truncate text-2xs text-muted-foreground',
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
                    'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-caption text-muted-foreground hover:bg-accent hover:text-foreground',
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
