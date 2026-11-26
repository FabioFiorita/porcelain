import { useState } from 'react';
import { useAtom } from '@effect/atom-react';
import { saveWalkthroughSettings } from '@porcelain/client/projects';
import {
  chooseWalkthroughWriter,
  isProjectDefaultWriter,
  walkthroughEfforts,
  walkthroughWriterKey,
  walkthroughWriterMenu,
  withWalkthroughEffort,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { CardRows } from '../../../components/ui/card';
import { Empty } from '../../../components/ui/empty';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Sheet } from '../../../components/ui/sheet';
import { Spinner } from '../../../components/ui/spinner';
import { Text } from '../../../components/ui/text';
import { useWritesBlocked } from '../../access';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { useWalkthroughWriter } from '../queries/writer';

export function WalkthroughWriterSheet({
  workspace,
}: {
  workspace: string | undefined;
}) {
  return (
    <Sheet title="Writer">
      <WorkspaceGate
        frame="pane"
        expectedWorkspace={workspace ?? ''}
        changed={<Empty title="Another worktree is selected now." />}
      >
        {(selected) => <WriterChoice workspace={selected} />}
      </WorkspaceGate>
    </Sheet>
  );
}

function GroupTitle({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="muted" accessibilityRole="header">
      {children}
    </Text>
  );
}

function WriterChoice({ workspace }: { workspace: Workspace }) {
  const check = useWalkthroughWriter(workspace);
  const blocked = useWritesBlocked(workspace.connection.environmentId);
  const [saving, save] = useAtom(
    saveWalkthroughSettings(workspace.connection),
    {
      mode: 'promiseExit',
    },
  );
  const [failure, setFailure] = useState<string>();
  const { settings, writer } = check;
  if (!settings || !writer) return check.failed ? null : <Spinner />;
  const { models } = settings;
  if (models.length === 0)
    return (
      <Empty title="Sign in to Claude Code or Codex on the connected computer." />
    );
  const key = walkthroughWriterKey(writer);
  const groups = walkthroughWriterMenu(models);
  const efforts = walkthroughEfforts(writer, models);
  const project = workspace.project;
  const isDefault = isProjectDefaultWriter(
    project.walkthroughSettings?.writer,
    writer,
    models,
  );
  const choose = (next: string) =>
    check.choose(chooseWalkthroughWriter(next, writer, models));
  const chosen = (itemKey: string) =>
    itemKey === key ? <Icon name="check" tone="brand" /> : undefined;
  return (
    <>
      <Text variant="secondary" tone="muted">
        Writer for the next run of this worktree.
      </Text>
      {groups.map((group) => (
        <Box key={group.provider} gap={2}>
          <GroupTitle>{group.label}</GroupTitle>
          <CardRows>
            {[
              ...group.latest,
              ...group.exact.map((item) => ({ ...item, model: undefined })),
            ].map((item) => (
              <Item
                key={item.key}
                size="compact"
                title={item.label}
                {...(item.model ? { detail: item.model } : {})}
                selected={item.key === key}
                trailing={chosen(item.key)}
                accessibilityLabel={
                  item.model ? `${item.label}, ${item.model}` : item.label
                }
                onPress={() => choose(item.key)}
              />
            ))}
          </CardRows>
        </Box>
      ))}
      {efforts.length > 0 ? (
        <Box gap={2}>
          <GroupTitle>Effort</GroupTitle>
          <Box className="flex-row flex-wrap" gap={2}>
            {efforts.map((effort) => (
              <Button
                key={effort}
                label={effort}
                size="sm"
                variant={effort === writer.effort ? 'filled' : 'tonal'}
                accessibilityLabel={`Effort ${effort}`}
                onPress={() =>
                  check.choose(withWalkthroughEffort(writer, effort))
                }
              />
            ))}
          </Box>
        </Box>
      ) : null}
      <Button
        label={isDefault ? 'Project default' : 'Make project default'}
        variant="tonal"
        pending={saving.waiting}
        disabled={isDefault || blocked}
        onPress={() => {
          setFailure(undefined);
          void save({
            projectId: project.id,
            mode: project.walkthroughSettings?.mode ?? 'manual',
            writer,
          }).then((exit) => {
            if (exit._tag === 'Success') check.choose(undefined);
            else setFailure('The project default was not saved.');
          });
        }}
      />
      {failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
    </>
  );
}
