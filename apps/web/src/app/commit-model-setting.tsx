import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  groupedCommitModels,
  resolveCommitModel,
} from '@porcelain/client/git-actions/rules';
import { useCommitModels } from '@/features/git-actions/index';
import { useConnectedContext } from '@/features/access/index';
import { usePreferences } from '@/features/preferences/index';

export function CommitModelSetting() {
  const models = useCommitModels(useConnectedContext());
  const choices = Option.getOrUndefined(AsyncResult.value(models));
  const pending = AsyncResult.isInitial(models);
  const { preferences, setPreference } = usePreferences();
  const value = resolveCommitModel(choices, preferences.commitModel) ?? '';
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
      <div className="min-w-0 flex-1">
        <label htmlFor="commit-model" className="text-sm font-medium">
          Commit model
        </label>
        <p className="text-xs text-muted-foreground">
          Drafts messages and groups in the commit dialog.
        </p>
      </div>
      <NativeSelect
        id="commit-model"
        className="w-full shrink-0 sm:w-56"
        value={value}
        disabled={pending || !choices?.length}
        onChange={(event) => setPreference('commitModel', event.target.value)}
      >
        {!value && (
          <NativeSelectOption value="" disabled>
            {pending
              ? 'Loading models…'
              : choices?.length
                ? 'Choose a model'
                : 'No models available'}
          </NativeSelectOption>
        )}
        {groupedCommitModels(
          choices?.filter((model) => !model.id.endsWith(':default')) ?? [],
        ).map(([provider, entries]) => (
          <NativeSelectOptGroup key={provider} label={provider}>
            {entries.map((model) => (
              <NativeSelectOption key={model.id} value={model.id}>
                {model.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
      <p className="w-full text-xs text-muted-foreground">
        {AsyncResult.isFailure(models)
          ? 'Could not load installed coding CLIs.'
          : !pending && !choices?.length
            ? 'Install and sign in to Codex or Claude Code on the server to generate drafts.'
            : 'Uses a signed-in coding CLI on the server. Codex models come from its local catalogue.'}
      </p>
    </div>
  );
}
