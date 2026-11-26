import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleMinusIcon,
  CircleXIcon,
  CopyIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  checkCounts,
  checkDurationLabel,
  checkNameInGroup,
  checkProgress,
  checkState,
  elapsedMs,
  failedJobsRerunOffer,
  failingStep,
  groupChecks,
  jobRerunOffer,
  stepState,
  type CheckGroup,
  type PullCheck,
  type PullCheckStep,
  type PullStatus,
  type RerunOffer,
  type StepState,
  type CheckLogLine,
  type PullRequestRerunTarget,
  type ReadCheckLogResponse,
} from '@porcelain/client/projects/rules';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PendingButton } from '@/shared/views/pending-button';
import { TruncatedText } from '@/shared/views/truncated-text';
import { cn } from '@/shared/lib/utils';
import type { Connection } from '@/shared/workspace/connection';
import { rerunChecksDialog } from '../overlays';
import { copyLog } from '../commands/pull-request-actions';
import { useCheckLog } from '../queries/pull-request-status';
import { useSecondsClock } from '../store';

const stateIcons: Record<
  StepState,
  { Icon: LucideIcon; color: string; label: string }
> = {
  failed: { Icon: CircleXIcon, color: 'text-del-fg', label: 'Failed' },
  running: {
    Icon: LoaderCircleIcon,
    color: 'text-foreground animate-spin motion-reduce:animate-none',
    label: 'Running',
  },
  passed: { Icon: CircleCheckIcon, color: 'text-add-fg', label: 'Passed' },
  skipped: {
    Icon: CircleMinusIcon,
    color: 'text-muted-foreground',
    label: 'Skipped',
  },
  pending: {
    Icon: CircleDashedIcon,
    color: 'text-muted-foreground',
    label: 'Waiting',
  },
};

export function StateIcon({
  state,
  className,
}: {
  state: StepState;
  className?: string;
}) {
  const { Icon, color, label } = stateIcons[state];
  return (
    <Icon
      role="img"
      aria-label={label}
      className={cn('size-3.5 shrink-0', color, className)}
    />
  );
}

export type ChecksController = {
  readonly open: ReadonlySet<string>;
  readonly toggle: (key: string, open?: boolean) => void;
};

export function checkRowSelector(key: string) {
  return `[data-check-row="${CSS.escape(key)}"]`;
}

type RerunRequest = {
  readonly title: string;
  readonly description: string;
  readonly target: PullRequestRerunTarget;
  readonly keys: readonly string[];
};

export function PullRequestChecks({
  status,
  connection,
  projectId,
  number,
  controller,
  pendingReruns,
  rerunning,
  onRerun,
  citations,
  onOpenStep,
}: {
  status: PullStatus;
  connection: Connection;
  projectId: string;
  number: number;
  controller: ChecksController;
  pendingReruns: ReadonlySet<string>;
  rerunning: boolean;
  onRerun: (target: PullRequestRerunTarget, keys: readonly string[]) => void;
  citations: ReadonlyMap<string, number>;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  const groups = groupChecks(status.checks);
  const counts = checkCounts(status.checks);
  const now = useSecondsClock(counts.running > 0 || pendingReruns.size > 0);
  const request = (item: RerunRequest, confirm: boolean) => {
    if (!confirm) {
      onRerun(item.target, item.keys);
      return;
    }
    void rerunChecksDialog.open({
      payload: {
        title: item.title,
        description: item.description,
        confirm: () => onRerun(item.target, item.keys),
      },
    });
  };
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    const keys: Record<string, number> = {
      j: 1,
      ArrowDown: 1,
      k: -1,
      ArrowUp: -1,
    };
    const step = keys[event.key];
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      step === undefined ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !target.matches('[data-check-row]')
    )
      return;
    const rows = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('[data-check-row]'),
    ];
    const next = rows[rows.indexOf(target) + step];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  return (
    <section aria-labelledby="pull-checks-heading" className="mt-8 min-w-0">
      <div className={sectionHeading}>
        <h2 id="pull-checks-heading">Checks</h2>
        <span className="ml-auto flex items-center gap-2 font-normal tabular-nums">
          {counts.failed > 0 && (
            <span className="text-del-fg">{counts.failed} failed</span>
          )}
          {counts.running > 0 && (
            <span className="text-foreground">{counts.running} running</span>
          )}
          <span>{counts.passed} passed</span>
        </span>
      </div>
      {status.checks.length === 0 ? (
        <p className="pt-3 text-ui text-muted-foreground">
          No checks reported by GitHub.
        </p>
      ) : (
        <div
          role="presentation"
          onKeyDown={moveFocus}
          className="flex min-w-0 flex-col"
        >
          {groups.map((group) => (
            <ChecksGroup
              key={group.key}
              group={group}
              status={status}
              connection={connection}
              projectId={projectId}
              number={number}
              now={now}
              controller={controller}
              pendingReruns={pendingReruns}
              rerunning={rerunning}
              request={request}
              citations={citations}
              onOpenStep={onOpenStep}
            />
          ))}
        </div>
      )}
      {status.checksTruncated && (
        <p className="mt-2 text-xs text-muted-foreground">
          GitHub lists the first 100 checks. Open GitHub to see the rest.
        </p>
      )}
      <AlertDialog controller={rerunChecksDialog}>
        {(payload) =>
          payload && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{payload.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {payload.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={() => {
                    payload.confirm();
                    rerunChecksDialog.close();
                  }}
                >
                  Re-run
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          )
        }
      </AlertDialog>
    </section>
  );
}

export const sectionHeading =
  'flex min-h-6 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b pb-1.5 text-xs leading-4 font-medium text-muted-foreground';

type Request = (item: RerunRequest, confirm: boolean) => void;

function ChecksGroup({
  group,
  status,
  controller,
  pendingReruns,
  rerunning,
  request,
  ...row
}: {
  group: CheckGroup;
  status: PullStatus;
  connection: Connection;
  projectId: string;
  number: number;
  now: number;
  controller: ChecksController;
  pendingReruns: ReadonlySet<string>;
  rerunning: boolean;
  request: Request;
  citations: ReadonlyMap<string, number>;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  const passedKey = `passed:${group.key}`;
  const showPassed = controller.open.has(passedKey);
  const offer = failedJobsRerunOffer(status, group);
  const failedJobs = group.failed.filter((check) => check.kind === 'actions');
  const rows = (checks: readonly PullCheck[]) =>
    checks.map((check) => (
      <CheckRow
        key={check.key}
        check={check}
        status={status}
        open={controller.open.has(check.key)}
        onToggle={() => controller.toggle(check.key)}
        requested={pendingReruns.has(check.key)}
        rerunning={rerunning}
        request={request}
        {...row}
      />
    ));
  return (
    <div role="group" aria-label={group.name} className="min-w-0 border-b py-1">
      <div className="flex h-7 min-w-0 items-center gap-2 text-xs leading-4 text-muted-foreground">
        <TruncatedText
          text={group.name}
          className="min-w-0 font-medium text-foreground"
        />
        {group.runNumber !== undefined && (
          <span className="shrink-0 tabular-nums">#{group.runNumber}</span>
        )}
        {offer && group.runId !== undefined && (
          <RerunButton
            offer={offer}
            label={`Re-run failed jobs`}
            className="ml-auto"
            pending={rerunning}
            onClick={(confirm) =>
              request(
                {
                  title: `Re-run ${failedJobs.length} failed ${failedJobs.length === 1 ? 'job' : 'jobs'} in ${group.name}?`,
                  description:
                    'GitHub starts a new attempt of the failed jobs and of the jobs that depend on them.',
                  target: { kind: 'failed-jobs', runId: group.runId ?? 0 },
                  keys: failedJobs.map((check) => check.key),
                },
                confirm,
              )
            }
          />
        )}
      </div>
      <ul className="min-w-0">
        {rows(group.failed)}
        {rows(group.running)}
      </ul>
      {group.passed.length > 0 && (
        <>
          <button
            type="button"
            data-check-row={passedKey}
            aria-expanded={showPassed}
            onClick={() => controller.toggle(passedKey)}
            className="flex h-7 w-full min-w-0 items-center gap-2 rounded-sm text-left text-ui leading-4.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={cn(
                'size-3.5 shrink-0 transition-transform motion-reduce:transition-none',
                showPassed && 'rotate-90',
              )}
            />
            <StateIcon state="passed" />
            <span className="tabular-nums">{group.passed.length} passed</span>
          </button>
          {showPassed && <ul className="min-w-0">{rows(group.passed)}</ul>}
        </>
      )}
    </div>
  );
}

function RerunButton({
  offer,
  label,
  className,
  pending,
  onClick,
}: {
  offer: RerunOffer;
  label: string;
  className?: string;
  pending: boolean;
  onClick: (confirm: boolean) => void;
}) {
  const reasonId = useId();
  if (offer.kind === 'unavailable')
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled
              focusableWhenDisabled
              aria-describedby={reasonId}
              className={className}
            />
          }
        >
          <RotateCcwIcon aria-hidden="true" />
          {label}
        </TooltipTrigger>
        <TooltipContent id={reasonId}>{offer.reason}</TooltipContent>
      </Tooltip>
    );
  return (
    <PendingButton
      variant="ghost"
      size="sm"
      pending={pending}
      className={className}
      onClick={() => onClick(offer.confirm)}
    >
      <RotateCcwIcon aria-hidden="true" />
      {label}
    </PendingButton>
  );
}

function CheckRow({
  check,
  status,
  open,
  onToggle,
  requested,
  rerunning,
  request,
  connection,
  projectId,
  number,
  now,
  citations,
  onOpenStep,
}: {
  check: PullCheck;
  status: PullStatus;
  open: boolean;
  onToggle: () => void;
  requested: boolean;
  rerunning: boolean;
  request: Request;
  connection: Connection;
  projectId: string;
  number: number;
  now: number;
  citations: ReadonlyMap<string, number>;
  onOpenStep: ((step: number) => void) | undefined;
}) {
  const panelId = useId();
  const state = requested ? 'running' : checkState(check);
  const progress = checkProgress(check);
  const failed = failingStep(check);
  const cited = citations.get(check.name);
  const duration = checkDurationLabel(
    elapsedMs(check.startedAt, check.completedAt, now),
  );
  let detail: ReactNode = duration;
  if (requested) detail = 'Re-run requested';
  else if (state === 'running' && progress)
    detail = (
      <>
        <span className="text-foreground">
          Step {progress.position} of {progress.total}
        </span>
        <span className="hidden @min-2xl/pr:inline">
          {' · '}
          {progress.step.name}
        </span>
        {duration && ` · ${duration}`}
      </>
    );
  else if (state === 'running') detail = 'Queued';
  else if (failed)
    detail = (
      <>
        <span className="hidden text-del-fg @min-2xl/pr:inline">
          Step {failed.number} · {failed.name} ·{' '}
        </span>
        <span className="hidden @min-2xl/pr:inline">{duration}</span>
      </>
    );
  return (
    <li className="min-w-0">
      <div className="flex min-h-7 min-w-0 items-start gap-1">
        <button
          type="button"
          data-check-row={check.key}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="grid min-h-7 min-w-0 flex-1 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm text-left text-ui leading-4.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRightIcon
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
          <StateIcon state={state} />
          <span className="flex min-w-0 items-center gap-2">
            <TruncatedText text={checkNameInGroup(check)} className="min-w-0" />
            {check.required && (
              <span className="hidden shrink-0 text-xs text-muted-foreground @min-xl/pr:inline">
                Required
              </span>
            )}
          </span>
          <span className="shrink-0 pl-2 text-xs leading-4 text-muted-foreground tabular-nums">
            {detail}
          </span>
          {failed && (
            <span className="col-span-2 col-start-3 -mt-0.5 pb-1 text-xs leading-4 text-del-fg @min-2xl/pr:hidden">
              {check.required && (
                <span className="text-muted-foreground @min-xl/pr:hidden">
                  Required ·{' '}
                </span>
              )}
              Step {failed.number} · {failed.name}
            </span>
          )}
        </button>
        {cited !== undefined && onOpenStep && (
          <button
            type="button"
            className="h-7 shrink-0 rounded-sm px-1.5 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${check.name} is cited in Walkthrough step ${cited}`}
            onClick={() => onOpenStep(cited)}
          >
            cited in Walkthrough step {cited}
          </button>
        )}
        {check.detailsUrl && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  render={
                    <a
                      href={check.detailsUrl}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                  aria-label={`Open ${check.name} on ${check.kind === 'actions' ? 'GitHub' : check.group}`}
                />
              }
            >
              <ArrowUpRightIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              Open on {check.kind === 'actions' ? 'GitHub' : check.group}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {open && (
        <div id={panelId} className="mb-2 min-w-0 pl-5.5">
          {check.kind === 'actions' ? (
            <ActionsJob
              key={check.jobId}
              check={check}
              status={status}
              connection={connection}
              projectId={projectId}
              number={number}
              now={now}
              requested={requested}
              rerunning={rerunning}
              request={request}
            />
          ) : (
            <ExternalCheck check={check} />
          )}
        </div>
      )}
    </li>
  );
}

function ActionsJob({
  check,
  status,
  connection,
  projectId,
  number,
  now,
  requested,
  rerunning,
  request,
}: {
  check: PullCheck;
  status: PullStatus;
  connection: Connection;
  projectId: string;
  number: number;
  now: number;
  requested: boolean;
  rerunning: boolean;
  request: Request;
}) {
  const failed = failingStep(check);
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(
    () => new Set(failed ? [failed.number] : []),
  );
  const offer = jobRerunOffer(status, check);
  const jobId = check.jobId;
  return (
    <div className="min-w-0">
      {check.steps.length === 0 ? (
        <p className="py-1 text-ui text-muted-foreground">
          {checkState(check) === 'running'
            ? 'Waiting for a runner.'
            : 'GitHub reported no steps for this job.'}
        </p>
      ) : (
        <ol aria-label={`Steps of ${check.name}`} className="min-w-0">
          {check.steps.map((step) => (
            <JobStep
              key={step.number}
              step={step}
              check={check}
              now={now}
              open={openSteps.has(step.number)}
              onToggle={() =>
                setOpenSteps((current) => {
                  const next = new Set(current);
                  if (next.has(step.number)) next.delete(step.number);
                  else next.add(step.number);
                  return next;
                })
              }
              log={
                jobId === undefined ? undefined : (
                  <CheckLog
                    connection={connection}
                    projectId={projectId}
                    number={number}
                    check={check}
                    jobId={jobId}
                    step={step}
                  />
                )
              }
            />
          ))}
        </ol>
      )}
      {!requested && jobId !== undefined && (
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <RerunButton
            offer={offer}
            label="Re-run this job"
            pending={rerunning}
            onClick={(confirm) =>
              request(
                {
                  title: `Re-run ${check.name}?`,
                  description:
                    'GitHub starts a new attempt of this job and re-runs the jobs in its workflow that depend on it, including ones that already finished.',
                  target: { kind: 'job', jobId },
                  keys: [check.key],
                },
                confirm,
              )
            }
          />
        </div>
      )}
    </div>
  );
}

function JobStep({
  step,
  check,
  now,
  open,
  onToggle,
  log,
}: {
  step: PullCheckStep;
  check: PullCheck;
  now: number;
  open: boolean;
  onToggle: () => void;
  log: ReactNode;
}) {
  const state = stepState(step);
  const duration = checkDurationLabel(
    elapsedMs(step.startedAt, step.completedAt, now),
  );
  const expandable =
    log !== undefined && (state === 'passed' || state === 'failed');
  const content = (
    <>
      <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {step.number}
      </span>
      <StateIcon state={state} className="size-3" />
      <TruncatedText
        text={step.name}
        className={cn('min-w-0', stepNameStyles[state])}
      />
      <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground tabular-nums">
        {state === 'running' ? `running ${duration ?? ''}` : duration}
      </span>
    </>
  );
  return (
    <li
      className="min-w-0"
      aria-current={state === 'running' ? 'step' : undefined}
    >
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} the log of step ${step.number}, ${step.name}, in ${check.name}`}
          onClick={onToggle}
          className="flex h-6 w-full min-w-0 items-center gap-2 rounded-sm text-left text-ui leading-4.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      ) : (
        <div className="flex h-6 min-w-0 items-center gap-2 text-ui leading-4.5">
          {content}
        </div>
      )}
      {open && expandable && log}
    </li>
  );
}

const stepNameStyles: Record<StepState, string> = {
  pending: 'text-muted-foreground',
  skipped: 'text-muted-foreground',
  failed: 'font-medium text-del-fg',
  running: 'font-medium',
  passed: '',
};

const logUnavailable: Partial<
  Record<
    Extract<ReadCheckLogResponse, { kind: 'unavailable' }>['reason'],
    string
  >
> = {
  'log-missing': 'GitHub has no log for this job yet, or it has expired.',
  'log-too-large': 'The job log is larger than 16 MB.',
  'rate-limited': 'GitHub rate limit reached.',
};

const logLevels: Record<CheckLogLine['level'], string> = {
  plain: '',
  error: 'bg-del-bg text-del-fg',
  warning: 'text-foreground',
  group: 'font-semibold text-foreground',
  command: 'text-muted-foreground',
};

function CheckLog({
  connection,
  projectId,
  number,
  check,
  jobId,
  step,
}: {
  connection: Connection;
  projectId: string;
  number: number;
  check: PullCheck;
  jobId: number;
  step: PullCheckStep;
}) {
  const { read, failed } = useCheckLog({
    connection,
    projectId,
    number,
    jobId,
    from: step.startedAt,
    to: step.completedAt,
  });
  const shell =
    'mt-1 mb-2 ml-7 min-w-0 overflow-hidden rounded-md border bg-muted/40';
  if (read === undefined && failed)
    return (
      <div className={shell}>
        <LogFallback check={check} reason="The log could not be read." />
      </div>
    );
  if (read === undefined)
    return (
      <div
        className={cn(shell, 'flex h-8 items-center gap-2 px-2.5')}
        aria-busy="true"
      >
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
        />
        <span className="sr-only">Reading the log</span>
      </div>
    );
  if (read.kind === 'unavailable')
    return (
      <div className={shell}>
        <LogFallback
          check={check}
          reason={
            logUnavailable[read.reason] ?? 'GitHub did not return the log.'
          }
        />
      </div>
    );
  const { excerpt } = read;
  const text = excerpt.lines.map((line) => line.text).join('\n');
  return (
    <div className={shell}>
      <div className="flex h-7 min-w-0 items-center gap-2 border-b px-2.5 text-xs text-muted-foreground">
        <TruncatedText
          className="min-w-0"
          text={`${excerpt.source === 'step' ? `Step ${step.number}` : 'End of the job log'} · ${excerpt.omitted > 0 ? 'last ' : ''}${excerpt.lines.length} lines`}
        />
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void copyLog(text)}
        >
          <CopyIcon aria-hidden="true" />
          Copy
        </Button>
        {check.detailsUrl && (
          <Button
            variant="ghost"
            size="sm"
            render={
              <a href={check.detailsUrl} target="_blank" rel="noreferrer" />
            }
          >
            Full log
            <ArrowUpRightIcon aria-hidden="true" />
          </Button>
        )}
      </div>
      <pre
        ref={showEnd}
        tabIndex={0}
        aria-label={`Log of step ${step.number}, ${step.name}`}
        className="max-h-96 min-w-0 overflow-auto py-1.5 font-mono text-xs leading-4.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="w-max min-w-full">
          {excerpt.lines.map((line, index) => (
            <div
              key={index}
              className={cn('px-2.5 whitespace-pre', logLevels[line.level])}
            >
              {line.text || ' '}
            </div>
          ))}
        </div>
      </pre>
    </div>
  );
}

function showEnd(node: HTMLPreElement | null) {
  if (node) node.scrollTop = node.scrollHeight;
}

function LogFallback({ check, reason }: { check: PullCheck; reason: string }) {
  return (
    <div className="min-w-0 px-2.5 py-2 text-ui">
      <p className="text-muted-foreground">{reason}</p>
      {check.annotations.length > 0 && <Annotations check={check} />}
      {check.detailsUrl && (
        <Button
          variant="link"
          size="flush"
          className="mt-1"
          render={
            <a href={check.detailsUrl} target="_blank" rel="noreferrer" />
          }
        >
          Open the job on GitHub
          <ArrowUpRightIcon aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

function Annotations({ check }: { check: PullCheck }) {
  return (
    <ul aria-label={`Annotations of ${check.name}`} className="mt-1.5 min-w-0">
      {check.annotations.map((annotation, index) => (
        <li
          key={index}
          className="flex min-w-0 items-start gap-2 py-1 text-ui leading-4.5"
        >
          {annotation.level === 'FAILURE' ? (
            <CircleXIcon
              aria-label="Error"
              className="mt-0.5 size-3.5 shrink-0 text-del-fg"
            />
          ) : (
            <TriangleAlertIcon
              aria-label={annotation.level === 'WARNING' ? 'Warning' : 'Notice'}
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <div className="min-w-0">
            {annotation.path && (
              <span className="font-mono text-xs text-muted-foreground">
                {annotation.path}
                {annotation.line === undefined ? '' : `:${annotation.line}`}
              </span>
            )}
            <p className="wrap-anywhere">
              {annotation.title && (
                <span className="font-medium">{annotation.title} · </span>
              )}
              {annotation.message}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ExternalCheck({ check }: { check: PullCheck }) {
  return (
    <div className="min-w-0 pb-1">
      {check.summary ? (
        <p className="py-1 text-ui leading-5 whitespace-pre-line text-foreground-2 wrap-anywhere">
          {check.summary}
        </p>
      ) : (
        <p className="py-1 text-ui text-muted-foreground">
          {check.kind === 'status'
            ? 'A commit status reported by an external service.'
            : 'No summary reported.'}
        </p>
      )}
      {check.annotations.length > 0 && <Annotations check={check} />}
      {check.detailsUrl && (
        <Button
          variant="link"
          size="flush"
          render={
            <a href={check.detailsUrl} target="_blank" rel="noreferrer" />
          }
        >
          Open on {check.kind === 'status' ? 'its service' : check.group}
          <ArrowUpRightIcon aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
