import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Link } from '@tanstack/react-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { SparklesIcon } from 'lucide-react';
import { readWalkthroughWriterSettings } from '@porcelain/client/projects';
import { walkthroughWriterStatus } from '@porcelain/client/projects/rules';
import { refLabel } from '@porcelain/client/history/rules';
import { Button } from '@/components/ui/button';
import {
  useInventory,
  walkthroughSettingsDialog,
} from '@/features/projects/index';
import { useLocalConnection } from '@/features/access/index';
import { NoWalkthroughWriters } from '@/shared/views/no-walkthrough-writers';
import { useBranchBases } from '@/features/changes/index';
import type { DocumentProps } from '@/features/workspace/index';

export function WalkthroughStart({
  document,
  waiting,
  onWrite,
}: {
  document: DocumentProps;
  waiting: boolean;
  onWrite: () => void;
}) {
  const { connection } = document.context;
  const local = useLocalConnection();
  const atom = readWalkthroughWriterSettings(connection);
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const settings = Option.getOrUndefined(AsyncResult.value(result));
  const project = useInventory(connection).projects.find(
    (entry) => entry.id === document.scope.projectId,
  );
  const writer = settings
    ? walkthroughWriterStatus(settings, project?.walkthroughSettings?.writer)
    : undefined;
  const branches = useBranchBases(
    document.scope,
    connection,
    document.base === undefined,
  );
  const availableBases = Option.getOrUndefined(
    AsyncResult.value(branches.result),
  );
  const base = document.base ?? availableBases?.defaultRef;
  const failed = AsyncResult.isFailure(result);
  const noWriters = settings?.models.length === 0;
  return (
    <header className="flex flex-col items-start gap-3">
      <h1 className="text-subpage-title font-semibold tracking-tight @3xl:text-page-title">
        No walkthrough yet.
      </h1>
      <p className="text-prose text-foreground-2">
        A fresh agent reads this change and explains it. It never edits the
        code.
      </p>
      <div className="grid gap-1 text-ui text-muted-foreground">
        <p>
          Whole change since {base ? refLabel(base) : 'the default branch'},
          including uncommitted work.
        </p>
        {writer && <p>Writer: {writer.label}</p>}
        {!writer && !AsyncResult.isFailure(result) && (
          <p role="status">Checking writers…</p>
        )}
      </div>
      {failed && (
        <p role="alert">
          Could not check writers on the connected computer.{' '}
          <Button variant="link" size="sm" onClick={refresh}>
            Check writers again
          </Button>
        </p>
      )}
      {!failed && noWriters && (
        <NoWalkthroughWriters checking={result.waiting} onCheck={refresh} />
      )}
      {!failed && !noWriters && writer && !writer.available && (
        <p role="status" className="text-ui text-muted-foreground">
          This writer is unavailable. Choose an available writer in{' '}
          {project?.walkthroughSettings?.writer ? (
            <Button
              variant="link"
              size="sm"
              onClick={() =>
                walkthroughSettingsDialog.openWithPayload({
                  project,
                  remote:
                    connection.environmentId === local?.environmentId
                      ? null
                      : connection.environmentId,
                })
              }
            >
              Project walkthrough settings
            </Button>
          ) : (
            <Link
              to="/settings/$section"
              params={{ section: 'git' }}
              className="underline underline-offset-4"
            >
              Settings → Changes &amp; Git
            </Link>
          )}
          .
        </p>
      )}
      <Button
        disabled={
          waiting || !writer?.available || AsyncResult.isFailure(result)
        }
        onClick={onWrite}
      >
        <SparklesIcon data-icon="inline-start" />
        Write walkthrough
      </Button>
    </header>
  );
}
