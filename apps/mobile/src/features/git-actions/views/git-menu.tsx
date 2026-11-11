import { networkLabel } from '@porcelain/client/git-actions/rules';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Button } from '../../../components/ui/button';
import { TopBarActions } from '../../../shared/application/top-bar';
import { useGitMenu } from '../commands/git-menu';
import type { Workspace } from '../../projects';

export function GitMenu({
  selection,
}: {
  selection: Pick<Workspace, 'connection' | 'scope'>;
}) {
  const menu = useGitMenu(selection);
  return (
    <>
      <TopBarActions
        owner="git-actions"
        actions={[
          {
            kind: 'choice',
            id: 'git-actions',
            label: 'Git actions',
            icon: 'branch',
            choices: (['fetch', 'pull'] as const).map((action) => {
              const reason = menu.blocker(action);
              const label = action === 'fetch' ? 'Fetch' : 'Pull';
              return {
                label: reason ? `${label} — ${reason}` : label,
                disabled: Boolean(reason),
                onPress: () => menu.run(action),
              };
            }),
          },
        ]}
      />
      {menu.running ? (
        <Box gap={2}>
          <Loading label={`${networkLabel(menu.running.action)}…`} />
          {menu.running?.operation?.receipt?.progress
            .slice(-4)
            .map((line, index) => (
              <Text key={`${index}:${line}`} variant="code" tone="muted">
                {line}
              </Text>
            ))}
          {menu.running ? (
            <Button
              label="Check outcome"
              variant="tonal"
              onPress={menu.checkOutcome}
              pending={menu.checking}
            />
          ) : null}
        </Box>
      ) : null}
      {menu.result?.type === 'error' ? (
        <ErrorState
          message={[menu.result.title, menu.result.description]
            .filter(Boolean)
            .join('\n')}
          retry={{
            label: menu.running ? 'Check outcome' : 'Retry',
            onPress: menu.running ? menu.checkOutcome : menu.retry,
            pending: Boolean(menu.running) && menu.checking,
          }}
        />
      ) : null}
      {menu.result && menu.result.type !== 'error' ? (
        <Box gap={1}>
          <Text variant="secondary" weight="medium">
            {menu.result.title}
          </Text>
          <Text variant="caption" tone="muted">
            {menu.result.description}
          </Text>
        </Box>
      ) : null}
    </>
  );
}
