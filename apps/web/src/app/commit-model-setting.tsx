import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select';
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
      <Select
        items={
          choices?.map((model) => ({ value: model.id, label: model.label })) ??
          []
        }
        value={value || null}
        disabled={pending || !choices?.length}
        onValueChange={(value) => {
          if (value) setPreference('commitModel', value);
        }}
      >
        <SelectTrigger id="commit-model" className="w-full shrink-0 sm:w-56">
          <SelectValue
            placeholder={
              pending
                ? 'Loading models…'
                : choices?.length
                  ? 'Choose a model'
                  : 'No models available'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {groupedCommitModels(
            choices?.filter((model) => !model.id.endsWith(':default')) ?? [],
          ).map(([provider, entries]) => (
            <SelectGroup key={provider}>
              <SelectLabel>{provider}</SelectLabel>
              {entries.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
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
