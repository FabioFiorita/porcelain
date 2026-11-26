import { useId, useState } from 'react';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  mergeFailureMessage,
  pullRequestMergeBlock,
  pullRequestMergeMethods,
  type PullRequestMergeMethod,
  type PullRequestMergeReview,
  type PullRequestRead,
} from '@porcelain/client/projects/rules';
import { shortOid } from '@porcelain/client/history/rules';
import {
  useWorkspaceWriteBlock,
  type ConnectionContext,
} from '@/shared/workspace/connection';
import { PendingButton } from '@/shared/views/pending-button';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/shared/lib/utils';
import { mergePullRequestDialog } from '../overlays';
import { useMergePullRequest } from '../commands/merge-pull-request';

type PullRequest = Extract<
  PullRequestRead,
  { kind: 'available' }
>['pullRequest'];

export function MergePullRequest({
  context,
  projectId,
  pull,
  review,
  label = 'Merge',
  showBlock = true,
  reason,
  className,
}: {
  context: ConnectionContext;
  projectId: string;
  pull: PullRequest;
  review?: PullRequestMergeReview | undefined;
  label?: string;
  showBlock?: boolean;
  reason?: string | undefined;
  className?: string;
}) {
  const reasonId = useId();
  const writeBlock = useWorkspaceWriteBlock(context);
  const block = writeBlock ?? pullRequestMergeBlock(pull, review);
  const shown =
    writeBlock ?? (block === undefined ? undefined : (reason ?? block));
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5',
        className,
      )}
    >
      <Button
        size="sm"
        disabled={block !== undefined}
        focusableWhenDisabled
        aria-describedby={block ? reasonId : undefined}
        onClick={() =>
          void mergePullRequestDialog.open({
            payload: {
              context,
              projectId,
              number: pull.number,
              headSha: pull.headSha,
              headBranch: pull.headBranch,
              baseBranch: pull.baseBranch,
              methods: pullRequestMergeMethods(pull).map(
                ({ method }) => method,
              ),
              requestId: crypto.randomUUID(),
            },
          })
        }
      >
        {label}
      </Button>
      {shown && (
        <p
          id={reasonId}
          className={cn(
            'min-w-0 text-ui leading-4.5 text-muted-foreground',
            !showBlock && 'sr-only',
          )}
        >
          {shown}
        </p>
      )}
    </div>
  );
}

export function MergePullRequestDialog() {
  return (
    <AlertDialog controller={mergePullRequestDialog}>
      {(payload) =>
        payload && <MergeContent key={payload.requestId} {...payload} />
      }
    </AlertDialog>
  );
}

function MergeContent({
  context,
  projectId,
  number,
  headSha,
  headBranch,
  baseBranch,
  methods,
}: {
  context: ConnectionContext;
  projectId: string;
  number: number;
  headSha: string;
  headBranch: string;
  baseBranch: string;
  methods: readonly PullRequestMergeMethod[];
}) {
  const writeBlock = useWorkspaceWriteBlock(context);
  const options = pullRequestMergeMethods({ mergeMethods: methods });
  const [method, setMethod] = useState(options[0]?.method);
  const { result, submit } = useMergePullRequest(
    context.connection,
    projectId,
    number,
    () => mergePullRequestDialog.close(),
  );
  const chosen = options.find((option) => option.method === method);
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Merge pull request #{number}?</AlertDialogTitle>
        <AlertDialogDescription className="[overflow-wrap:anywhere]">
          {headBranch} at {shortOid(headSha)} goes into {baseBranch} on GitHub.
          A merge cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {options.length > 1 && (
        <div className="grid gap-1.5">
          <Label htmlFor="merge-method">Method</Label>
          <Select
            value={method ?? null}
            disabled={result.waiting}
            onValueChange={setMethod}
          >
            <SelectTrigger
              id="merge-method"
              aria-label="Merge method"
              className="w-full"
            >
              <SelectValue>{chosen?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.method} value={option.method}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {AsyncResult.isFailure(result) && (
        <p role="alert" className="text-ui text-destructive">
          {mergeFailureMessage(Cause.squash(result.cause))}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={result.waiting}>Cancel</AlertDialogCancel>
        <PendingButton
          pending={result.waiting}
          disabled={Boolean(writeBlock) || result.waiting || !chosen}
          aria-description={writeBlock}
          onClick={() => {
            if (chosen && !writeBlock)
              void submit({ method: chosen.method, headSha });
          }}
        >
          {chosen?.label ?? 'Merge'}
        </PendingButton>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
