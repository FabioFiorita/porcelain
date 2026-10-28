import { useState } from 'react';
import { useAtomRef } from '@effect/atom-react';
import {
  archiveSettings,
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
  reviewGitSettingsKeptMessage,
  shownReviewGitSettings,
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
import {
  useReviewGitSettings,
  useReviewGitSettingsTrust,
} from '../queries/review-git-settings';
import { useReviewGitSettingsCommands } from '../commands/review-git-settings';
import { PreferencesPage } from './preferences-page';
import { PreferenceChoice } from './preference-choice';
import { CommitModelSetting } from './commit-model-setting';

function ComputerReviewGitSettings({
  connection,
  computer,
  candidate,
  candidateReady,
}: {
  connection: RuntimeConnection;
  computer: string;
  candidate: ReviewGitSettings;
  candidateReady: boolean;
}) {
  const view = useReviewGitSettings(connection);
  const untrusted = useReviewGitSettingsTrust(connection);
  const { save, saving, failure, kept, readAgain } =
    useReviewGitSettingsCommands(connection);
  const settings = shownReviewGitSettings(view, candidate);
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
          message={`${block}\nPull and Archive wait until they can be read again.`}
          retry={{ label: 'Read settings again', onPress: readAgain }}
        />
      ) : null}
      {view.kind === 'unconfigured' ? (
        <Box gap={3}>
          <Text variant="ui">
            Every device connected to {computer} uses the same Reviews & Git
            settings. These are the ones this app used before; check the archive
            deletions below, then use them for {computer}.
          </Text>
          {untrusted ? (
            <Text variant="ui" tone="muted">
              {untrusted}
            </Text>
          ) : null}
          <Button
            label={`Use these settings for ${computer}`}
            pending={saving}
            disabled={!candidateReady || untrusted !== undefined}
            onPress={() => save({ kind: 'initialize', settings: candidate })}
          />
        </Box>
      ) : null}
      {kept ? (
        <Text variant="ui">{reviewGitSettingsKeptMessage(computer)}</Text>
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
                checked={settings?.[key] ?? false}
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
              checked={settings?.collapseSpecs ?? false}
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
          value={settings?.pullStrategy}
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
              computer={computer.remote.name}
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
