import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { useCommitModels } from '../../query/git-actions';
import { usePreferences } from './preferences';

export function CommitModelSetting() {
  const models = useCommitModels();
  const { preferences, setPreference } = usePreferences();
  const value = models.data?.some(
    (entry) => entry.id === preferences.commitModel,
  )
    ? preferences.commitModel
    : '';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="commit-model" className="text-sm font-medium">
        Commit model
      </label>
      <NativeSelect
        id="commit-model"
        value={value}
        disabled={models.isPending || !models.data?.length}
        onChange={(event) => setPreference('commitModel', event.target.value)}
      >
        <NativeSelectOption value="">Automatic</NativeSelectOption>
        {models.data?.map((model) => (
          <NativeSelectOption key={model.id} value={model.id}>
            {model.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">
        {models.isError
          ? 'Could not load installed coding CLIs.'
          : !models.isPending && !models.data?.length
            ? 'Install and sign in to Codex or Claude Code on the server to generate drafts.'
            : 'Uses a signed-in coding CLI on the server. Codex models come from its local catalogue.'}
      </p>
    </div>
  );
}
