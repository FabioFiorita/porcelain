import { useState } from 'react';
import { Alert } from 'react-native';
import {
  checkCounts,
  checkLogHeading,
  checkLogUnavailable,
  checkState,
  failedJobsRerunOffer,
  failedJobsRerunRequest,
  failingStep,
  groupChecks,
  jobRerunOffer,
  jobRerunRequest,
  stepState,
  toggledKey,
  type CheckGroup,
  type PullCheck,
  type PullCheckStep,
  type PullStatus,
  type RerunOffer,
  type RerunRequest,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { IconButton } from '../../../components/ui/icon-button';
import { Indent } from '../../../components/ui/indent';
import { Item } from '../../../components/ui/item';
import { LogLines } from '../../../components/ui/log-lines';
import { SectionHeading } from '../../../components/ui/section-heading';
import { Spinner } from '../../../components/ui/spinner';
import { StateIcon } from '../../../components/ui/state-icon';
import { StepRow } from '../../../components/ui/step-row';
import { Text } from '../../../components/ui/text';
import { usePreviewLink } from '../../../shared/adapters/preview-link';
import { useCheckLog, type PullRequestRef } from '../queries/pull-request';
import { useCopyLog, useRerunChecks } from '../commands/pull-request';
import {
  checkRowDetail,
  stepDetail,
  stepHasLog,
} from '../rules/pull-request-checks';

type Rerun = ReturnType<typeof useRerunChecks>;

export function PullRequestChecks({
  target,
  status,
  pendingReruns,
}: {
  target: PullRequestRef;
  status: PullStatus;
  pendingReruns: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const rerun = useRerunChecks(target);
  const counts = checkCounts(status.checks);
  const now = Date.now();
  const toggle = (key: string) =>
    setOpen((current) => toggledKey(current, key));
  const request = (item: RerunRequest, confirm: boolean) => {
    const start = () => void rerun.rerun(status, item);
    if (!confirm) {
      start();
      return;
    }
    Alert.alert(item.title, item.description, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Re-run', onPress: start },
    ]);
  };
  return (
    <Box gap={2}>
      <SectionHeading
        label="Checks"
        trailing={
          <Box className="flex-row" gap={2}>
            {counts.failed > 0 ? (
              <Text variant="caption" tone="del">
                {counts.failed} failed
              </Text>
            ) : null}
            {counts.running > 0 ? (
              <Text variant="caption">{counts.running} running</Text>
            ) : null}
            <Text variant="caption" tone="muted">
              {counts.passed} passed
            </Text>
          </Box>
        }
      />
      {rerun.failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {rerun.failure}
        </Text>
      ) : null}
      {status.checks.length === 0 ? (
        <Text variant="secondary" tone="muted">
          No checks reported by GitHub.
        </Text>
      ) : (
        groupChecks(status.checks).map((group) => (
          <ChecksGroup
            key={group.key}
            group={group}
            status={status}
            target={target}
            now={now}
            open={open}
            toggle={toggle}
            pendingReruns={pendingReruns}
            rerunning={rerun.pending}
            request={request}
          />
        ))
      )}
      {status.checksTruncated ? (
        <Text variant="caption" tone="muted">
          GitHub lists the first 100 checks. Open GitHub to see the rest.
        </Text>
      ) : null}
    </Box>
  );
}

type GroupProps = {
  group: CheckGroup;
  status: PullStatus;
  target: PullRequestRef;
  now: number;
  open: ReadonlySet<string>;
  toggle: (key: string) => void;
  pendingReruns: ReadonlySet<string>;
  rerunning: Rerun['pending'];
  request: (item: RerunRequest, confirm: boolean) => void;
};

function ChecksGroup({ group, ...props }: GroupProps) {
  const passedKey = `passed:${group.key}`;
  const offer = failedJobsRerunOffer(props.status, group);
  const failedJobs = failedJobsRerunRequest(group);
  const rows = (checks: readonly PullCheck[]) =>
    checks.map((check) => (
      <CheckRow key={check.key} check={check} {...props} />
    ));
  return (
    <Card>
      <Box
        className="flex-row flex-wrap items-center"
        gap={2}
        paddingX={4}
        paddingY={2}
      >
        <Text variant="secondary" weight="medium" numberOfLines={1}>
          {group.name}
        </Text>
        {group.runNumber === undefined ? null : (
          <Text variant="caption" tone="muted" className="flex-1">
            #{group.runNumber}
          </Text>
        )}
      </Box>
      {offer && failedJobs ? (
        <RerunAction
          offer={offer}
          label="Re-run failed jobs"
          pending={props.rerunning}
          onPress={(confirm) => props.request(failedJobs, confirm)}
        />
      ) : null}
      {rows(group.failed)}
      {rows(group.running)}
      {group.passed.length > 0 ? (
        <>
          <Item
            size="compact"
            title={`${group.passed.length} passed`}
            leading={
              <Box className="flex-row items-center" gap={1}>
                <Icon
                  name={props.open.has(passedKey) ? 'down' : 'chevron'}
                  tone="muted"
                  size="small"
                />
                <StateIcon state="passed" />
              </Box>
            }
            accessibilityLabel={`${props.open.has(passedKey) ? 'Hide' : 'Show'} ${group.passed.length} passed checks in ${group.name}`}
            onPress={() => props.toggle(passedKey)}
          />
          {props.open.has(passedKey) ? rows(group.passed) : null}
        </>
      ) : null}
    </Card>
  );
}

function RerunAction({
  offer,
  label,
  pending,
  onPress,
}: {
  offer: RerunOffer;
  label: string;
  pending: boolean;
  onPress: (confirm: boolean) => void;
}) {
  return (
    <Box paddingX={4} paddingY={1} gap={1}>
      <Button
        label={label}
        variant="tonal"
        size="sm"
        className="self-start"
        disabled={offer.kind === 'unavailable'}
        pending={pending}
        onPress={() => {
          if (offer.kind === 'available') onPress(offer.confirm);
        }}
      />
      {offer.kind === 'unavailable' ? (
        <Text variant="caption" tone="muted">
          {offer.reason}
        </Text>
      ) : null}
    </Box>
  );
}

function CheckRow({
  check,
  status,
  target,
  now,
  open,
  toggle,
  pendingReruns,
  rerunning,
  request,
}: Omit<GroupProps, 'group'> & { check: PullCheck }) {
  const link = usePreviewLink();
  const requested = pendingReruns.has(check.key);
  const expanded = open.has(check.key);
  const detailsUrl = check.detailsUrl;
  const detail = checkRowDetail(check, requested, now);
  return (
    <>
      <Item
        size="compact"
        title={check.name}
        titleNumberOfLines={1}
        {...(detail ? { description: detail } : {})}
        descriptionNumberOfLines={1}
        leading={
          <Box className="flex-row items-center" gap={1}>
            <Icon
              name={expanded ? 'down' : 'chevron'}
              tone="muted"
              size="small"
            />
            <StateIcon state={requested ? 'running' : checkState(check)} />
          </Box>
        }
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${check.name}`}
        onPress={() => toggle(check.key)}
        action={
          detailsUrl ? (
            <IconButton
              icon="external"
              size="sm"
              accessibilityLabel={`Open ${check.name} on ${check.kind === 'actions' ? 'GitHub' : check.group}`}
              onPress={() => link.open(detailsUrl)}
            />
          ) : undefined
        }
      />
      {expanded ? (
        <Indent kind="detail">
          {check.kind === 'actions' ? (
            <ActionsJob
              key={check.jobId}
              check={check}
              status={status}
              target={target}
              now={now}
              requested={requested}
              rerunning={rerunning}
              request={request}
            />
          ) : (
            <ExternalCheck check={check} />
          )}
        </Indent>
      ) : null}
    </>
  );
}

function ActionsJob({
  check,
  status,
  target,
  now,
  requested,
  rerunning,
  request,
}: {
  check: PullCheck;
  status: PullStatus;
  target: PullRequestRef;
  now: number;
  requested: boolean;
  rerunning: boolean;
  request: (item: RerunRequest, confirm: boolean) => void;
}) {
  const failed = failingStep(check);
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(
    () => new Set(failed ? [failed.number] : []),
  );
  const job = jobRerunRequest(check);
  const jobId = check.jobId;
  return (
    <Box gap={1}>
      {check.steps.length === 0 ? (
        <Text variant="secondary" tone="muted">
          {checkState(check) === 'running'
            ? 'Waiting for a runner.'
            : 'GitHub reported no steps for this job.'}
        </Text>
      ) : (
        check.steps.map((step) => {
          const expandable = jobId !== undefined && stepHasLog(step);
          const shown = expandable && openSteps.has(step.number);
          return (
            <Box key={step.number}>
              <StepRow
                number={step.number}
                name={step.name}
                state={stepState(step)}
                detail={stepDetail(step, now)}
                expanded={expandable ? shown : undefined}
                accessibilityLabel={`${shown ? 'Hide' : 'Show'} the log of step ${step.number}, ${step.name}, in ${check.name}`}
                onPress={
                  expandable
                    ? () =>
                        setOpenSteps((current) =>
                          toggledKey(current, step.number),
                        )
                    : undefined
                }
              />
              {shown && jobId !== undefined ? (
                <CheckLog
                  target={target}
                  check={check}
                  jobId={jobId}
                  step={step}
                />
              ) : null}
            </Box>
          );
        })
      )}
      {!requested && job ? (
        <RerunAction
          offer={jobRerunOffer(status, check)}
          label="Re-run this job"
          pending={rerunning}
          onPress={(confirm) => request(job, confirm)}
        />
      ) : null}
    </Box>
  );
}

function CheckLog({
  target,
  check,
  jobId,
  step,
}: {
  target: PullRequestRef;
  check: PullCheck;
  jobId: number;
  step: PullCheckStep;
}) {
  const link = usePreviewLink();
  const copy = useCopyLog();
  const { read, failed, retry } = useCheckLog({
    ...target,
    jobId,
    from: step.startedAt,
    to: step.completedAt,
  });
  const detailsUrl = check.detailsUrl;
  const fullLog = detailsUrl ? (
    <Button
      label="Full log"
      variant="plain"
      size="sm"
      onPress={() => link.open(detailsUrl)}
    />
  ) : null;
  if (read === undefined && !failed) return <Spinner inline />;
  if (read === undefined || read.kind === 'unavailable')
    return (
      <Card>
        <Box padding={2} gap={2}>
          <Text variant="secondary" tone="muted">
            {read === undefined
              ? 'The log could not be read.'
              : checkLogUnavailable(read.reason)}
          </Text>
          {check.annotations.length > 0 ? <Annotations check={check} /> : null}
          <Box className="flex-row flex-wrap" gap={2}>
            {read === undefined ? (
              <Button
                label="Read the log again"
                variant="tonal"
                size="sm"
                onPress={retry}
              />
            ) : null}
            {fullLog}
          </Box>
        </Box>
      </Card>
    );
  const { excerpt } = read;
  return (
    <Card>
      <Box
        className="flex-row items-center"
        gap={2}
        paddingX={2}
        divider="bottom"
      >
        <Text
          variant="caption"
          tone="muted"
          className="flex-1"
          numberOfLines={1}
        >
          {checkLogHeading(excerpt, step.number)}
        </Text>
        <Button
          label="Copy"
          variant="plain"
          size="sm"
          onPress={() =>
            void copy(excerpt.lines.map((line) => line.text).join('\n'))
          }
        />
        {fullLog}
      </Box>
      <LogLines
        lines={excerpt.lines}
        label={`Log of step ${step.number}, ${step.name}`}
      />
    </Card>
  );
}

function annotationLabel(level: string) {
  if (level === 'FAILURE') return 'Error';
  return level === 'WARNING' ? 'Warning' : 'Notice';
}

function Annotations({ check }: { check: PullCheck }) {
  return (
    <Box gap={1}>
      {check.annotations.map((annotation, index) => (
        <Box key={index} className="flex-row items-start" gap={2}>
          <StateIcon
            state={annotation.level === 'FAILURE' ? 'failed' : 'pending'}
            label={annotationLabel(annotation.level)}
          />
          <Box className="min-w-0 flex-1">
            {annotation.path ? (
              <Text variant="mono" tone="muted">
                {annotation.path}
                {annotation.line === undefined ? '' : `:${annotation.line}`}
              </Text>
            ) : null}
            <Text variant="secondary">
              {annotation.title ? `${annotation.title} · ` : ''}
              {annotation.message}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ExternalCheck({ check }: { check: PullCheck }) {
  const link = usePreviewLink();
  const detailsUrl = check.detailsUrl;
  return (
    <Box gap={2}>
      <Text variant="secondary" tone={check.summary ? 'default' : 'muted'}>
        {check.summary ??
          (check.kind === 'status'
            ? 'A commit status reported by an external service.'
            : 'No summary reported.')}
      </Text>
      {check.annotations.length > 0 ? <Annotations check={check} /> : null}
      {detailsUrl ? (
        <Button
          label={`Open on ${check.kind === 'status' ? 'its service' : check.group}`}
          variant="plain"
          size="sm"
          className="self-start"
          onPress={() => link.open(detailsUrl)}
        />
      ) : null}
    </Box>
  );
}
