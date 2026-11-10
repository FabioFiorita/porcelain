import { useState } from 'react';
import { useAtomRef } from '@effect/atom-react';
import { archiveSettings } from '@porcelain/client/projects/rules';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
  reviewGitSettingsKeptMessage,
  shownReviewGitSettings,
} from '@porcelain/client/preferences/rules';
import type { ReviewGitSettings } from '@porcelain/client/preferences';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { CardRows } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { GroupHeader } from '../../../components/ui/group-header';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { remoteConnectionState } from '../../../shared/application/store';
import {
  useReviewGitSettings,
  useReviewGitSettingsTrust,
} from '../queries/review-git-settings';
import { useReviewGitSettingsCommands } from '../commands/review-git-settings';
import { PreferencesPage } from './preferences-page';
import { PreferenceChoice, PreferenceSwitch } from './preference-choice';

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
  const { save, saving, failure, kept, readAgain, checkTrustAgain } =
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
        <ErrorState
          message={`Update Porcelain on ${computer} to use its Reviews & Git settings.`}
        />
      ) : null}
      {block && (view.kind === 'unreadable' || view.kind === 'configured') ? (
        <ErrorState
          message={`${block}\nPull and Archive wait until they can be read again.`}
          retry={{ label: 'Read settings again', onPress: readAgain }}
        />
      ) : null}
      {view.kind === 'unconfigured' ? (
        <Box gap={3}>
          <Text variant="secondary">
            Every device connected to {computer} uses the same Reviews & Git
            settings. These are the ones this app used before; check the archive
            deletions below, then use them for {computer}.
          </Text>
          {untrusted ? (
            <Text variant="secondary" tone="muted">
              {untrusted}
            </Text>
          ) : null}
          {untrusted ? (
            <Button
              label="Check again"
              variant="tonal"
              onPress={checkTrustAgain}
            />
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
        <Text variant="secondary">
          {reviewGitSettingsKeptMessage(computer)}
        </Text>
      ) : null}
      {failure ? <ErrorState message={failure} /> : null}
      <Box>
        <GroupHeader variant="section" label="When archiving a review" />
        <CardRows>
          {archiveSettings.map(({ key, label, description }) => (
            <PreferenceSwitch
              key={key}
              label={label}
              description={description}
              checked={settings?.[key] ?? false}
              disabled={disabled}
              onChange={(value) => change({ [key]: value })}
            />
          ))}
        </CardRows>
      </Box>
      <Box>
        <GroupHeader variant="section" label="Reviews" />
        <CardRows>
          <PreferenceSwitch
            label="Spec files"
            description="Group specs separately in a review on the web and desktop."
            checked={settings?.collapseSpecs ?? false}
            disabled={disabled}
            onChange={(collapseSpecs) => change({ collapseSpecs })}
          />
        </CardRows>
      </Box>
      <Box>
        <GroupHeader variant="section" label="Git" />
        <PreferenceChoice
          label="Pull strategy"
          description={`Used when pulling changes on ${computer}.`}
          value={settings?.pullStrategy}
          options={[
            { value: 'merge', label: 'Merge', id: 'pull-merge' },
            { value: 'rebase', label: 'Rebase', id: 'pull-rebase' },
          ]}
          disabled={disabled}
          onChange={(pullStrategy) => change({ pullStrategy })}
        />
      </Box>
      <Text variant="caption" tone="muted">
        Saved on the computer, for every device connected to it. Archive and
        pull run on the computer that holds the worktree.
      </Text>
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
            <Text variant="secondary" tone="muted" numberOfLines={2}>
              Settings for {computer.remote.name}
            </Text>
          ) : null}
          {computer ? null : (
            <Text variant="secondary" tone="muted">
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
        </>
      )}
    </PreferencesPage>
  );
}
