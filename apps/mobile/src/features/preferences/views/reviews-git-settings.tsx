import { useState } from 'react';
import { useAtomRef } from '@effect/atom-react';
import {
  archiveSettings,
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
} from '@porcelain/client/preferences/rules';
import type { ReviewGitSettings } from '@porcelain/client/preferences';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Switch } from '../../../components/ui/switch';
import { Text } from '../../../components/ui/text';
import { remoteConnectionState } from '../../../shared/application/store';
import { useReviewGitSettings } from '../queries/review-git-settings';
import { useReviewGitSettingsCommands } from '../commands/review-git-settings';
import { PreferencesPage } from './preferences-page';
import { PreferenceChoice } from './preference-choice';
import { CommitModelSetting } from './commit-model-setting';

function ComputerReviewGitSettings({
  connection,
  candidate,
  candidateReady,
}: {
  connection: RuntimeConnection;
  candidate: ReviewGitSettings;
  candidateReady: boolean;
}) {
  const view = useReviewGitSettings(connection);
  const { save, saving, failure, readAgain } =
    useReviewGitSettingsCommands(connection);
  const settings = view.kind === 'configured' ? view.settings : candidate;
  const disabled = confirmedReviewGitSettings(view) === undefined || saving;
  const block = reviewGitSettingsBlock(view);
  const change = (next: Partial<ReviewGitSettings>) =>
    save({ kind: 'change', change: next });
  return (
    <>
      {view.kind === 'reading' ? (
        <Loading label="Reading Reviews & Git settings…" />
      ) : null}
      {view.kind === 'unsupported' ? (
        <ErrorState message="Update Porcelain on this computer to use its Reviews & Git settings." />
      ) : null}
      {block && (view.kind === 'unreadable' || view.kind === 'configured') ? (
        <ErrorState
          message={`${block} Pull and Archive wait until they can be read again.`}
          retry={{ label: 'Read settings again', onPress: readAgain }}
        />
      ) : null}
      {view.kind === 'unconfigured' ? (
        <Box gap={3}>
          <Text variant="ui">
            Every device connected to this computer uses the same Reviews & Git
            settings. These are the ones this app used before; check the archive
            deletions below, then use them for this computer.
          </Text>
          <Button
            label="Use these settings for this computer"
            pending={saving}
            disabled={!candidateReady}
            onPress={() => save({ kind: 'initialize', settings })}
          />
        </Box>
      ) : null}
      {failure ? <ErrorState message={failure} /> : null}
      <Box gap={3}>
        <Text variant="subheading">When archiving a review</Text>
        {archiveSettings.map(({ key, label }) => (
          <Item
            key={key}
            title={label}
            variant="outline"
            trailing={
              <Switch
                label={label}
                checked={settings[key]}
                disabled={disabled}
                onCheckedChange={(value) => change({ [key]: value })}
              />
            }
          />
        ))}
      </Box>
      <Box gap={3}>
        <Text variant="subheading">Reviews</Text>
        <Item
          title="Spec files"
          description="Group specs separately in a review on the web and desktop."
          variant="outline"
          trailing={
            <Switch
              label="Spec files"
              checked={settings.collapseSpecs}
              disabled={disabled}
              onCheckedChange={(collapseSpecs) => change({ collapseSpecs })}
            />
          }
        />
      </Box>
      <Box gap={3}>
        <Text variant="subheading">Git</Text>
        <PreferenceChoice
          label="Pull strategy"
          description="Used when pulling changes on this computer."
          value={settings.pullStrategy}
          options={[
            { value: 'merge', label: 'Merge', id: 'pull-merge' },
            { value: 'rebase', label: 'Rebase', id: 'pull-rebase' },
          ]}
          disabled={disabled}
          onChange={(pullStrategy) => change({ pullStrategy })}
        />
      </Box>
    </>
  );
}

export function ReviewsGitSettings() {
  const computers = useAtomRef(remoteConnectionState);
  const [chosen, setChosen] = useState<string>();
  const computer =
    computers.find((entry) => entry.remote.environmentId === chosen) ??
    computers[0];
  return (
    <PreferencesPage>
      {({ preferences, disabled }) => (
        <>
          {computers.length > 1 && computer ? (
            <PreferenceChoice
              label="Computer"
              description="Each computer keeps its own Reviews & Git settings."
              value={computer.remote.environmentId}
              options={computers.map((entry) => ({
                value: entry.remote.environmentId,
                label: entry.remote.name,
                id: `computer-${entry.remote.environmentId}`,
              }))}
              disabled={false}
              onChange={setChosen}
            />
          ) : null}
          {computers.length === 1 && computer ? (
            <Text variant="subheading" numberOfLines={2}>
              Settings for {computer.remote.name}
            </Text>
          ) : null}
          {computer ? null : (
            <Text variant="ui" tone="muted">
              Pair a computer to choose its Reviews & Git settings.
            </Text>
          )}
          {computer ? (
            <ComputerReviewGitSettings
              key={computer.remote.environmentId}
              connection={computer.connection}
              candidate={preferences.reviewGitSettingsImportCandidate}
              candidateReady={!disabled}
            />
          ) : null}
          <Box gap={3}>
            <Text variant="subheading">On this device</Text>
            <CommitModelSetting />
          </Box>
        </>
      )}
    </PreferencesPage>
  );
}
